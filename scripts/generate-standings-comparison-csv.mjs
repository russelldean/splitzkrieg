import sql from 'mssql';
import { readFileSync, writeFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const dbConfig = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 120000,
    requestTimeout: 30000,
  },
};

function parseStandingsCSV(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith(','));
  const rows = [];
  for (const line of lines) {
    const cols = line.split(',');
    if (!cols[0] || cols[0] === '' || cols[9] === 'Season') continue;
    rows.push({
      division: cols[0].trim(),
      rank: parseInt(cols[1]),
      teamName: cols[2].trim(),
      totalPts: parseFloat(cols[3]),
      wins: parseFloat(cols[5]),
      xp: parseFloat(cols[6]),
      season: cols[9].trim(),
    });
  }
  return rows;
}

async function main() {
  const pool = await new sql.ConnectionPool(dbConfig).connect();

  // Season IDs
  const seasonsResult = await pool.request().query('SELECT seasonID, romanNumeral FROM seasons ORDER BY seasonID');
  const seasonMap = {};
  for (const s of seasonsResult.recordset) seasonMap[s.romanNumeral] = s.seasonID;

  // Team name history
  const allNames = await pool.request().query('SELECT seasonID, teamID, teamName FROM teamNameHistory');
  const namesBySeason = {};
  const idsBySeason = {};
  for (const n of allNames.recordset) {
    if (!namesBySeason[n.seasonID]) namesBySeason[n.seasonID] = {};
    if (!idsBySeason[n.seasonID]) idsBySeason[n.seasonID] = {};
    namesBySeason[n.seasonID][n.teamID] = n.teamName;
    idsBySeason[n.seasonID][n.teamName.toLowerCase()] = n.teamID;
  }

  // Parse CSV
  const csvRows = parseStandingsCSV('docs/Splitzkrieg Raw Data - Standings Import.csv');
  const csvBySeason = {};
  for (const r of csvRows) {
    if (!csvBySeason[r.season]) csvBySeason[r.season] = [];
    csvBySeason[r.season].push(r);
  }

  const targetSeasons = ['XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX', 'XXXI', 'XXXII', 'XXXIII', 'XXXIV', 'XXXV'];
  const normalize = s => s.toLowerCase().replace(/[\s\-']/g, '');
  const aliases = { 'pindemix': 'pindemics', 'pindemics': 'pindemics' };

  const outputRows = [];

  for (const season of targetSeasons) {
    const sid = seasonMap[season];
    if (!sid) { console.error(`No seasonID for ${season}`); continue; }

    const idMap = idsBySeason[sid] || {};
    const nameMap = namesBySeason[sid] || {};
    const csvTeams = csvBySeason[season] || [];
    if (csvTeams.length === 0) { console.error(`No CSV data for ${season}`); continue; }

    // Get match results for game wins
    const matchResults = await pool.request().input('sid', sql.Int, sid).query(`
      SELECT sch.week, sch.team1ID, sch.team2ID,
        mr.team1GamePts, mr.team2GamePts
      FROM matchResults mr
      JOIN schedule sch ON sch.scheduleID = mr.scheduleID
      WHERE sch.seasonID = @sid
    `);

    // Get weekly team series for XP calculation
    const weeklyScores = await pool.request().input('sid', sql.Int, sid).query(`
      SELECT week, teamID, SUM(hcpGame1+hcpGame2+hcpGame3) as series, COUNT(*) as bowlers
      FROM scores WHERE seasonID = @sid
      GROUP BY week, teamID
      HAVING COUNT(*) = 4
      ORDER BY week, series DESC
    `);

    const weeks = new Map();
    for (const r of weeklyScores.recordset) {
      if (!weeks.has(r.week)) weeks.set(r.week, []);
      weeks.get(r.week).push({ teamID: r.teamID, series: r.series });
    }

    // Compute standings
    const computed = {};
    for (const mr of matchResults.recordset) {
      if (!computed[mr.team1ID]) computed[mr.team1ID] = { wins: 0, xp: 0 };
      if (!computed[mr.team2ID]) computed[mr.team2ID] = { wins: 0, xp: 0 };
      computed[mr.team1ID].wins += mr.team1GamePts / 2;
      computed[mr.team2ID].wins += mr.team2GamePts / 2;
    }

    // XP from weekly series ranking — use bucket boundaries based on team count
    // Standard: 20 teams → buckets of 5 (top5=3, next5=2, next5=1, bottom5=0)
    // Fewer teams: scale buckets proportionally (e.g. 18 teams → ~4.5 per bucket)
    // We use the >= cutoff approach: rank teams by series, assign XP by position
    for (const [week, teams] of weeks) {
      const sorted = [...teams].sort((a, b) => b.series - a.series);
      const n = sorted.length;
      if (n === 0) continue;
      // Bucket boundaries: top 25% = 3, next 25% = 2, next 25% = 1, bottom 25% = 0
      const b1 = Math.round(n * 0.25);  // top bucket cutoff
      const b2 = Math.round(n * 0.50);
      const b3 = Math.round(n * 0.75);
      for (let i = 0; i < sorted.length; i++) {
        const team = sorted[i];
        if (!computed[team.teamID]) computed[team.teamID] = { wins: 0, xp: 0 };
        let bonus;
        if (i < b1) bonus = 3;
        else if (i < b2) bonus = 2;
        else if (i < b3) bonus = 1;
        else bonus = 0;
        computed[team.teamID].xp += bonus;
      }
    }

    // Build comparison rows for this season
    const seasonRows = [];
    for (const csv of csvTeams) {
      const csvLower = csv.teamName.toLowerCase();
      let teamID = idMap[csvLower] || idMap[aliases[csvLower] || ''];
      if (!teamID) {
        const csvNorm = normalize(csv.teamName);
        for (const [name, id] of Object.entries(idMap)) {
          if (normalize(name) === csvNorm) { teamID = id; break; }
        }
      }
      if (!teamID) {
        // Fuzzy substring
        for (const [name, id] of Object.entries(idMap)) {
          if (name.includes(csvLower) || csvLower.includes(name)) { teamID = id; break; }
        }
      }

      const comp = teamID ? computed[teamID] : null;
      const compWins = comp ? comp.wins : '';
      const compXP = comp ? comp.xp : '';
      const compTotal = comp ? (comp.wins * 2 + comp.xp) : '';

      seasonRows.push({
        season,
        division: csv.division,
        team: csv.teamName,
        csvRank: csv.rank,
        csvWins: csv.wins,
        csvXP: csv.xp,
        csvTotal: csv.totalPts,
        compWins,
        compXP,
        compTotal,
        winDiff: comp ? compWins - csv.wins : '',
        xpDiff: comp ? compXP - csv.xp : '',
        totalDiff: comp ? compTotal - csv.totalPts : '',
      });
    }

    // Compute ranks by division from computed totals
    for (const div of ['A', 'B', 'C']) {
      const divTeams = seasonRows.filter(r => r.division === div && r.compTotal !== '');
      divTeams.sort((a, b) => b.compTotal - a.compTotal);
      let rank = 1;
      for (let i = 0; i < divTeams.length; i++) {
        if (i > 0 && divTeams[i].compTotal < divTeams[i - 1].compTotal) rank = i + 1;
        divTeams[i].compRank = rank;
      }
    }

    for (const r of seasonRows) {
      const compRank = r.compRank || '';
      const rankChange = (compRank !== '' && r.csvRank) ? r.csvRank - compRank : '';
      outputRows.push({
        ...r,
        compRank,
        rankChange,
      });
    }
  }

  // Write CSV
  const header = 'Season,Division,Team,CSV Rank,CSV Wins,CSV XP,CSV Total,Computed Wins,Computed XP,Computed Total,Win Diff,XP Diff,Total Diff,Computed Rank,Rank Change';
  const lines = outputRows.map(r =>
    [r.season, r.division, `"${r.team}"`, r.csvRank, r.csvWins, r.csvXP, r.csvTotal,
     r.compWins, r.compXP, r.compTotal, r.winDiff, r.xpDiff, r.totalDiff, r.compRank, r.rankChange].join(',')
  );

  const csv = [header, ...lines].join('\n');
  const outPath = 'docs/standings-comparison.csv';
  writeFileSync(outPath, csv);
  console.log(`Wrote ${outputRows.length} rows to ${outPath}`);

  // Quick summary
  let perfect = 0, winDiffs = 0, xpDiffs = 0;
  for (const r of outputRows) {
    if (r.totalDiff === 0) perfect++;
    if (r.winDiff !== '' && r.winDiff !== 0) winDiffs++;
    if (r.xpDiff !== '' && r.xpDiff !== 0) xpDiffs++;
  }
  console.log(`Perfect matches: ${perfect}/${outputRows.length}`);
  console.log(`Teams with win diffs: ${winDiffs}`);
  console.log(`Teams with XP diffs: ${xpDiffs}`);

  await pool.close();
}

main().catch(err => { console.error(err); process.exit(1); });
