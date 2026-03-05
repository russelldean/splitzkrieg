import sql from 'mssql';
import { readFileSync } from 'fs';

// Load env
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

// Parse CSV: Division, Rank, TeamName, TotalPts, PtsLastWeek, Wins, XP, ScratchAvg, HcpAvg, Season
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
      ptsLastWeek: parseFloat(cols[4]),
      wins: parseFloat(cols[5]),       // game wins (1 per win)
      xp: parseFloat(cols[6]),         // bonus points
      season: cols[9].trim(),
    });
  }
  return rows;
}

async function main() {
  const csvRows = parseStandingsCSV('docs/Splitzkrieg Raw Data - Standings Import.csv');

  // Group by season
  const csvBySeason = {};
  for (const r of csvRows) {
    if (!csvBySeason[r.season]) csvBySeason[r.season] = [];
    csvBySeason[r.season].push(r);
  }

  console.log('Standings formula: Total Points = Wins × 2 + XP');
  console.log('matchResults gamePts = 2 per game win (already on 2x scale)');
  console.log('CSV wins = 1 per game win');
  console.log('');

  const pool = await new sql.ConnectionPool(dbConfig).connect();

  // Get season ID mapping
  const seasonsResult = await pool.request().query(
    'SELECT seasonID, romanNumeral FROM seasons ORDER BY seasonID'
  );
  const seasonMap = {};
  for (const s of seasonsResult.recordset) {
    seasonMap[s.romanNumeral] = s.seasonID;
  }

  // Get team name history for matching
  const teamNames = await pool.request().query(
    'SELECT seasonID, teamID, teamName FROM teamNameHistory'
  );
  const teamNameMap = {}; // seasonID -> teamName(lower) -> teamID
  for (const r of teamNames.recordset) {
    if (!teamNameMap[r.seasonID]) teamNameMap[r.seasonID] = {};
    teamNameMap[r.seasonID][r.teamName.toLowerCase()] = r.teamID;
  }

  // Week completeness per season
  const weekData = await pool.request().query(`
    SELECT sch.seasonID, sch.week,
      COUNT(sch.scheduleID) as scheduled,
      COUNT(mr.resultID) as withResults
    FROM schedule sch
    LEFT JOIN matchResults mr ON mr.scheduleID = sch.scheduleID
    GROUP BY sch.seasonID, sch.week
    ORDER BY sch.seasonID, sch.week
  `);
  const weekCompleteness = {}; // seasonID -> { totalWeeks, completeWeeks, totalMatches, matchesWithResults }
  for (const r of weekData.recordset) {
    if (!weekCompleteness[r.seasonID]) {
      weekCompleteness[r.seasonID] = { totalWeeks: 0, completeWeeks: 0, totalMatches: 0, matchesWithResults: 0 };
    }
    const wc = weekCompleteness[r.seasonID];
    wc.totalWeeks++;
    wc.totalMatches += r.scheduled;
    wc.matchesWithResults += r.withResults;
    if (r.withResults === r.scheduled) wc.completeWeeks++;
  }

  // Compute standings from matchResults
  // gamePts is already on 2x scale (2 pts per game win)
  // bonusPts is 1:1 with XP
  const computedResult = await pool.request().query(`
    SELECT
      sch.seasonID,
      t.teamID,
      SUM(t.gamePts) as totalGamePts,
      SUM(COALESCE(t.bonusPts, 0)) as totalBonusPts,
      COUNT(*) as matchCount
    FROM (
      SELECT mr.scheduleID, sch.team1ID as teamID, mr.team1GamePts as gamePts, mr.team1BonusPts as bonusPts
      FROM matchResults mr
      JOIN schedule sch ON sch.scheduleID = mr.scheduleID
      UNION ALL
      SELECT mr.scheduleID, sch.team2ID as teamID, mr.team2GamePts as gamePts, mr.team2BonusPts as bonusPts
      FROM matchResults mr
      JOIN schedule sch ON sch.scheduleID = mr.scheduleID
    ) t
    JOIN schedule sch ON sch.scheduleID = t.scheduleID
    GROUP BY sch.seasonID, t.teamID
    ORDER BY sch.seasonID, t.teamID
  `);

  // Build computed map
  const computed = {};
  for (const r of computedResult.recordset) {
    if (!computed[r.seasonID]) computed[r.seasonID] = {};
    computed[r.seasonID][r.teamID] = {
      gamePts: r.totalGamePts,      // already 2x scale
      bonusPts: r.totalBonusPts,
      totalPts: r.totalGamePts + r.totalBonusPts,
      matches: r.matchCount,
    };
  }

  // Compare each season
  const seasonOrder = ['XXXV', 'XXXIV', 'XXXIII', 'XXXII', 'XXXI', 'XXX', 'XXIX', 'XXVIII', 'XXVII', 'XXVI', 'XXV', 'XXIV', 'XXIII'];

  let overallWinMatch = 0, overallWinMismatch = 0;
  let overallXpMatch = 0, overallXpMismatch = 0;
  let overallTotalMatch = 0, overallTotalMismatch = 0;

  for (const season of seasonOrder) {
    const csvTeams = csvBySeason[season];
    if (!csvTeams) continue;

    const seasonID = seasonMap[season];
    if (!seasonID) {
      console.log(`⚠ Season ${season}: no seasonID found`);
      continue;
    }

    const seasonComputed = computed[seasonID];
    const wc = weekCompleteness[seasonID];

    if (!seasonComputed) {
      console.log(`\n--- Season ${season} (ID ${seasonID}): NO matchResults data ---`);
      continue;
    }

    const completePct = wc ? Math.round(wc.matchesWithResults / wc.totalMatches * 100) : 0;
    const completeLabel = completePct === 100 ? '✅ COMPLETE' : `⚠ ${completePct}% complete (${wc.matchesWithResults}/${wc.totalMatches} matches)`;
    console.log(`\n=== Season ${season} (ID ${seasonID}) — ${completeLabel} ===`);

    if (wc) {
      const incompleteWeeks = [];
      // Re-query would be needed but we can note it
    }

    const rows = [];
    let unmatchedTeams = [];

    for (const csv of csvTeams) {
      // Find teamID — normalize names for matching (strip spaces, hyphens, apostrophes)
      const normalize = s => s.toLowerCase().replace(/[\s\-']/g, '');
      // Known CSV→DB name aliases
      const aliases = { 'pindemix': 'pindemics' };
      const seasonNames = teamNameMap[seasonID] || {};
      const csvNameLower = csv.teamName.toLowerCase();
      let teamID = seasonNames[csvNameLower] || seasonNames[aliases[csvNameLower] || ''];
      if (!teamID) {
        // Try normalized match
        const csvNorm = normalize(csv.teamName);
        for (const [name, id] of Object.entries(seasonNames)) {
          if (normalize(name) === csvNorm) {
            teamID = id;
            break;
          }
        }
      }
      if (!teamID) {
        // Fuzzy substring match as fallback
        const csvLower = csv.teamName.toLowerCase();
        for (const [name, id] of Object.entries(seasonNames)) {
          if (name.includes(csvLower) || csvLower.includes(name)) {
            teamID = id;
            break;
          }
        }
      }

      if (!teamID) {
        unmatchedTeams.push(csv.teamName);
        continue;
      }

      const comp = seasonComputed[teamID];
      if (!comp) {
        unmatchedTeams.push(`${csv.teamName} (team ${teamID}, no results)`);
        continue;
      }

      // CSV: totalPts = wins × 2 + xp
      const csvWinPts = csv.wins * 2;  // Convert to 2x scale for comparison
      const csvTotalCheck = csvWinPts + csv.xp;

      // Compare game win points (both on 2x scale now)
      const winDiff = comp.gamePts - csvWinPts;
      const winsOk = Math.abs(winDiff) < 0.01;
      if (winsOk) overallWinMatch++; else overallWinMismatch++;

      // Compare XP (only meaningful if we have bonusPts data)
      let xpDiff = null;
      let xpOk = null;
      if (comp.bonusPts !== null && comp.bonusPts !== undefined) {
        xpDiff = comp.bonusPts - csv.xp;
        xpOk = Math.abs(xpDiff) < 0.01;
        if (xpOk) overallXpMatch++; else overallXpMismatch++;
      }

      // Compare total points
      const totalDiff = comp.totalPts - csv.totalPts;
      const totalOk = Math.abs(totalDiff) < 0.01;
      if (totalOk) overallTotalMatch++; else overallTotalMismatch++;

      if (!winsOk || (xpOk === false) || !totalOk) {
        rows.push({
          team: csv.teamName,
          div: csv.division,
          csvWins: csv.wins,
          compWins: comp.gamePts / 2, // Back to 1x for readability
          winDiff: winDiff / 2,
          csvXP: csv.xp,
          compXP: comp.bonusPts,
          xpDiff,
          csvTotal: csv.totalPts,
          compTotal: comp.totalPts,
          totalDiff,
          matches: comp.matches,
        });
      }
    }

    if (rows.length === 0 && unmatchedTeams.length === 0) {
      console.log('  ✅ All teams match!');
    } else {
      if (rows.length > 0) {
        // Header
        console.log('  ' + 'Team'.padEnd(25) + 'Div  ' + 'CSV W  Comp W  Diff   ' + 'CSV XP  Comp XP  Diff   ' + 'CSV Tot  Comp Tot  Diff');
        console.log('  ' + '-'.repeat(110));
        for (const r of rows) {
          const winStr = `${String(r.csvWins).padEnd(7)}${String(r.compWins).padEnd(8)}${(r.winDiff > 0 ? '+' : '') + r.winDiff.toFixed(1).padEnd(7)}`;
          const xpStr = r.xpDiff !== null
            ? `${String(r.csvXP).padEnd(8)}${String(r.compXP).padEnd(9)}${(r.xpDiff > 0 ? '+' : '') + r.xpDiff.toFixed(1).padEnd(7)}`
            : `${String(r.csvXP).padEnd(8)}${'N/A'.padEnd(9)}${''.padEnd(7)}`;
          const totStr = `${String(r.csvTotal).padEnd(9)}${String(r.compTotal).padEnd(10)}${(r.totalDiff > 0 ? '+' : '') + r.totalDiff.toFixed(1)}`;
          console.log(`  ${r.team.padEnd(25)}${(r.div + '    ').slice(0, 5)}${winStr}${xpStr}${totStr}`);
        }
      }
      if (unmatchedTeams.length > 0) {
        console.log('  ❓ Unmatched: ' + unmatchedTeams.join(', '));
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Game wins (2x scale): ${overallWinMatch} match, ${overallWinMismatch} mismatch`);
  console.log(`XP (bonus pts):       ${overallXpMatch} match, ${overallXpMismatch} mismatch`);
  console.log(`Total points:         ${overallTotalMatch} match, ${overallTotalMismatch} mismatch`);

  await pool.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
