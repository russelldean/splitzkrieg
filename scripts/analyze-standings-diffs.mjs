import sql from 'mssql';
import { readFileSync } from 'fs';

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

// Parse standings CSV
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

  // Get all team name history
  const allNames = await pool.request().query('SELECT seasonID, teamID, teamName FROM teamNameHistory');
  const namesBySeason = {};
  const idsBySeason = {};
  for (const n of allNames.recordset) {
    if (!namesBySeason[n.seasonID]) namesBySeason[n.seasonID] = {};
    if (!idsBySeason[n.seasonID]) idsBySeason[n.seasonID] = {};
    namesBySeason[n.seasonID][n.teamID] = n.teamName;
    idsBySeason[n.seasonID][n.teamName.toLowerCase()] = n.teamID;
  }

  // Season IDs
  const seasonsResult = await pool.request().query('SELECT seasonID, romanNumeral FROM seasons ORDER BY seasonID');
  const seasonMap = {};
  for (const s of seasonsResult.recordset) seasonMap[s.romanNumeral] = s.seasonID;

  // Parse CSV
  const csvRows = parseStandingsCSV('docs/Splitzkrieg Raw Data - Standings Import.csv');
  const csvBySeason = {};
  for (const r of csvRows) {
    if (!csvBySeason[r.season]) csvBySeason[r.season] = [];
    csvBySeason[r.season].push(r);
  }

  // Analyze complete seasons
  const seasonOrder = ['XXXIV', 'XXXIII', 'XXX', 'XXIX', 'XXVIII', 'XXVII', 'XXVI'];

  for (const season of seasonOrder) {
    const sid = seasonMap[season];
    if (!sid) continue;

    const nameMap = namesBySeason[sid] || {};
    const idMap = idsBySeason[sid] || {};

    // Get weekly team scores
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

    // Get match results for game win analysis
    const matchResults = await pool.request().input('sid', sql.Int, sid).query(`
      SELECT sch.week, sch.team1ID, sch.team2ID,
        mr.team1Game1, mr.team1Game2, mr.team1Game3,
        mr.team2Game1, mr.team2Game2, mr.team2Game3,
        mr.team1GamePts, mr.team2GamePts
      FROM matchResults mr
      JOIN schedule sch ON sch.scheduleID = mr.scheduleID
      WHERE sch.seasonID = @sid
      ORDER BY sch.week
    `);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`SEASON ${season} (ID ${sid})`);
    console.log('='.repeat(70));

    // 1. XP tie analysis
    let tieWeeks = 0;
    const tieDetails = [];
    for (const [week, teams] of weeks) {
      const sorted = [...teams].sort((a, b) => b.series - a.series);
      const cutoffs = [
        { pos: 5, label: '3→2 XP' },
        { pos: 10, label: '2→1 XP' },
        { pos: 15, label: '1→0 XP' },
      ];

      for (const c of cutoffs) {
        if (sorted.length > c.pos && sorted[c.pos - 1].series === sorted[c.pos].series) {
          tieWeeks++;
          const tiedTeams = sorted.filter(t => t.series === sorted[c.pos - 1].series);
          const aboveCutoff = tiedTeams.filter(t => sorted.indexOf(t) < c.pos);
          const belowCutoff = tiedTeams.filter(t => sorted.indexOf(t) >= c.pos);
          tieDetails.push(
            `  Wk${week} ${c.label}: ${tiedTeams.map(t => (nameMap[t.teamID] || 'T' + t.teamID)).join(' = ')} ` +
            `(series ${sorted[c.pos - 1].series}) → our rule gives ${belowCutoff.map(t => nameMap[t.teamID] || 'T' + t.teamID).join(', ')} the higher bucket`
          );
        }
      }
    }

    console.log(`\nXP CUTOFF TIES (${tieWeeks} instances):`);
    if (tieDetails.length === 0) {
      console.log('  None');
    } else {
      for (const d of tieDetails) console.log(d);
    }

    // 2. Game tie analysis (ties in individual games)
    let gameTies = 0;
    const gameTieDetails = [];
    for (const mr of matchResults.recordset) {
      const games = [
        { t1: mr.team1Game1, t2: mr.team2Game1, g: 1 },
        { t1: mr.team1Game2, t2: mr.team2Game2, g: 2 },
        { t1: mr.team1Game3, t2: mr.team2Game3, g: 3 },
      ];
      for (const game of games) {
        if (game.t1 === game.t2) {
          gameTies++;
          gameTieDetails.push(
            `  Wk${mr.week}: ${nameMap[mr.team1ID] || 'T' + mr.team1ID} vs ${nameMap[mr.team2ID] || 'T' + mr.team2ID} — Game ${game.g} tied at ${game.t1}`
          );
        }
      }
    }

    console.log(`\nGAME TIES (${gameTies} tied games across ${matchResults.recordset.length} matches):`);
    if (gameTies <= 10) {
      for (const d of gameTieDetails) console.log(d);
    } else {
      console.log(`  (showing first 5 of ${gameTies})`);
      for (let i = 0; i < 5; i++) console.log(gameTieDetails[i]);
    }
    console.log(`  Each tied game = 1pt each (0.5 wins each). Different scoring → different totals.`);

    // 3. Standings impact — show CSV vs computed side by side, sorted by total pts diff
    const csvTeams = csvBySeason[season] || [];
    const normalize = s => s.toLowerCase().replace(/[\s\-']/g, '');
    const aliases = { 'pindemix': 'pindemics' };

    // Compute our standings
    const computed = {};
    for (const mr of matchResults.recordset) {
      if (!computed[mr.team1ID]) computed[mr.team1ID] = { wins: 0, xp: 0 };
      if (!computed[mr.team2ID]) computed[mr.team2ID] = { wins: 0, xp: 0 };
      computed[mr.team1ID].wins += mr.team1GamePts / 2;
      computed[mr.team2ID].wins += mr.team2GamePts / 2;
    }

    // XP from bonusMap
    for (const [week, teams] of weeks) {
      const sorted = [...teams].sort((a, b) => b.series - a.series);
      const cutoff3 = sorted.length >= 5 ? sorted[4].series : -1;
      const cutoff2 = sorted.length >= 10 ? sorted[9].series : -1;
      const cutoff1 = sorted.length >= 15 ? sorted[14].series : -1;

      for (const team of sorted) {
        if (!computed[team.teamID]) computed[team.teamID] = { wins: 0, xp: 0 };
        let bonus;
        if (team.series >= cutoff3 && cutoff3 >= 0) bonus = 3;
        else if (team.series >= cutoff2 && cutoff2 >= 0) bonus = 2;
        else if (team.series >= cutoff1 && cutoff1 >= 0) bonus = 1;
        else bonus = 0;
        computed[team.teamID].xp += bonus;
      }
    }

    console.log(`\nSTANDINGS COMPARISON (sorted by total pts impact):`);
    console.log('  ' + 'Team'.padEnd(25) + 'CSV'.padStart(5) + 'Comp'.padStart(5) + 'Diff'.padStart(6) + '  |  ' + 'CSV W'.padStart(6) + 'Comp W'.padStart(7) + '  |  ' + 'CSV XP'.padStart(6) + 'Comp XP'.padStart(8) + '  |  Rank Impact');
    console.log('  ' + '-'.repeat(100));

    const comparisons = [];
    for (const csv of csvTeams) {
      const csvLower = csv.teamName.toLowerCase();
      let teamID = idMap[csvLower] || idMap[aliases[csvLower] || ''];
      if (!teamID) {
        const csvNorm = normalize(csv.teamName);
        for (const [name, id] of Object.entries(idMap)) {
          if (normalize(name) === csvNorm) { teamID = id; break; }
        }
      }
      if (!teamID) continue;

      const comp = computed[teamID];
      if (!comp) continue;

      const compTotal = comp.wins * 2 + comp.xp;
      const totalDiff = compTotal - csv.totalPts;
      const winDiff = comp.wins - csv.wins;
      const xpDiff = comp.xp - csv.xp;

      comparisons.push({
        team: csv.teamName,
        div: csv.division,
        csvRank: csv.rank,
        csvTotal: csv.totalPts,
        compTotal,
        totalDiff,
        csvWins: csv.wins,
        compWins: comp.wins,
        winDiff,
        csvXP: csv.xp,
        compXP: comp.xp,
        xpDiff,
      });
    }

    // Sort by absolute total diff descending
    comparisons.sort((a, b) => Math.abs(b.totalDiff) - Math.abs(a.totalDiff));

    // Compute rank by division using computed totals
    for (const div of ['A', 'B', 'C']) {
      const divTeams = comparisons.filter(c => c.div === div).sort((a, b) => b.compTotal - a.compTotal);
      let rank = 1;
      for (let i = 0; i < divTeams.length; i++) {
        if (i > 0 && divTeams[i].compTotal < divTeams[i - 1].compTotal) rank = i + 1;
        divTeams[i].compRank = rank;
      }
    }

    for (const c of comparisons) {
      const rankChange = c.csvRank - (c.compRank || c.csvRank);
      const rankStr = rankChange === 0 ? 'same' :
        rankChange > 0 ? `↑${rankChange}` : `↓${Math.abs(rankChange)}`;
      const flag = Math.abs(c.totalDiff) >= 3 ? ' ⚠' : '';

      console.log(
        `  ${c.team.padEnd(25)}` +
        `${String(c.csvTotal).padStart(5)}${String(c.compTotal).padStart(5)}${((c.totalDiff >= 0 ? '+' : '') + c.totalDiff.toFixed(0)).padStart(6)}` +
        `  |  ${String(c.csvWins).padStart(6)}${String(c.compWins).padStart(7)}` +
        `  |  ${String(c.csvXP).padStart(6)}${String(c.compXP).padStart(8)}` +
        `  |  ${c.div}${c.csvRank}→${c.div}${c.compRank || '?'} ${rankStr}${flag}`
      );
    }
  }

  // XXXI and XXXII — explain the Bowl'd Peanuts impact
  console.log(`\n${'='.repeat(70)}`);
  console.log('SEASONS XXXI & XXXII — BOWL\'D PEANUTS FORFEIT IMPACT');
  console.log('='.repeat(70));
  console.log('Bowl\'d Peanuts (team 5) had 0 bowlers all season in both XXXI and XXXII.');
  console.log('Their 9 opponents each got free wins in the CSV standings.');
  console.log('Our matchResults cannot compute these matches (no scores to compare).');
  console.log('Each opponent is missing ~1 match worth of points (up to 9 pts: 6 game + 3 XP).');

  await pool.close();
}

main().catch(err => { console.error(err); process.exit(1); });
