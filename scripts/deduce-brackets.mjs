import sql from 'mssql';

const pool = await sql.connect({
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 30000 },
});

// Get playoff teams for seasons 26-35
const playoffs = await pool.query(`
  SELECT pr.seasonID, pr.round, pr.team1ID, pr.team2ID, pr.winnerTeamID,
         pr.playoffID,
         t1.teamName AS team1Name, t2.teamName AS team2Name
  FROM playoffResults pr
  LEFT JOIN teams t1 ON pr.team1ID = t1.teamID
  LEFT JOIN teams t2 ON pr.team2ID = t2.teamID
  WHERE pr.playoffType = 'Team' AND pr.seasonID >= 26
  ORDER BY pr.seasonID, pr.round DESC, pr.playoffID
`);

// Get division assignments
const divisions = await pool.query(`
  SELECT sd.seasonID, sd.teamID, sd.divisionName, t.teamName
  FROM seasonDivisions sd
  JOIN teams t ON sd.teamID = t.teamID
  WHERE sd.seasonID >= 26
  ORDER BY sd.seasonID, sd.divisionName
`);

// Build division lookup: "seasonID-teamID" -> divisionName
const divMap = new Map();
for (const row of divisions.recordset) {
  divMap.set(`${row.seasonID}-${row.teamID}`, row.divisionName);
}

// Build playoff lookup per season
const playoffMap = new Map();
for (const row of playoffs.recordset) {
  if (!playoffMap.has(row.seasonID)) playoffMap.set(row.seasonID, { finals: null, semis: [] });
  const entry = playoffMap.get(row.seasonID);
  if (row.round === 'final') entry.finals = row;
  else entry.semis.push(row);
}

// Deduce brackets using division info
// Rule: first round is within the same division
const updates = [];

for (let sid = 26; sid <= 35; sid++) {
  const p = playoffMap.get(sid);
  if (!p || !p.finals) { console.log(`Season ${sid}: no playoff data`); continue; }

  const champID = p.finals.team1ID;
  const ruID = p.finals.team2ID;
  const semi1ID = p.semis[0]?.team1ID;
  const semi2ID = p.semis[1]?.team1ID;

  const champDiv = divMap.get(`${sid}-${champID}`);
  const ruDiv = divMap.get(`${sid}-${ruID}`);
  const s1Div = divMap.get(`${sid}-${semi1ID}`);
  const s2Div = divMap.get(`${sid}-${semi2ID}`);

  console.log(`\nSeason ${sid}:`);
  console.log(`  Champion:  ${p.finals.team1Name} (${champDiv})`);
  console.log(`  Runner-Up: ${p.finals.team2Name} (${ruDiv})`);
  console.log(`  Semi 1:    ${p.semis[0]?.team1Name} (${s1Div})`);
  console.log(`  Semi 2:    ${p.semis[1]?.team1Name} (${s2Div})`);

  // Match semifinalists to finalists by division
  let champOpponent = null;
  let ruOpponent = null;

  if (champDiv === s1Div && ruDiv === s2Div) {
    champOpponent = semi1ID;
    ruOpponent = semi2ID;
    console.log(`  -> Champion beat Semi 1 (same div: ${champDiv}), Runner-Up beat Semi 2 (same div: ${ruDiv})`);
  } else if (champDiv === s2Div && ruDiv === s1Div) {
    champOpponent = semi2ID;
    ruOpponent = semi1ID;
    console.log(`  -> Champion beat Semi 2 (same div: ${champDiv}), Runner-Up beat Semi 1 (same div: ${ruDiv})`);
  } else {
    console.log(`  X Division matching failed! Champ=${champDiv}, RU=${ruDiv}, S1=${s1Div}, S2=${s2Div}`);
    continue;
  }

  updates.push({ seasonID: sid, loserID: champOpponent, winnerID: champID });
  updates.push({ seasonID: sid, loserID: ruOpponent, winnerID: ruID });
}

if (process.argv.includes('--apply')) {
  console.log('\n--- Applying updates ---');
  for (const u of updates) {
    const result = await pool.request()
      .input('seasonID', sql.Int, u.seasonID)
      .input('loserID', sql.Int, u.loserID)
      .input('winnerID', sql.Int, u.winnerID)
      .query(`
        UPDATE playoffResults
        SET team2ID = @winnerID, winnerTeamID = @winnerID
        WHERE seasonID = @seasonID AND playoffType = 'Team' AND round = 'semifinal' AND team1ID = @loserID
      `);
    console.log(`  Season ${u.seasonID}: semi loser ${u.loserID} -> winner ${u.winnerID} (${result.rowsAffected[0]} rows)`);
  }
  console.log(`\nUpdated ${updates.length} semifinal rows.`);
} else {
  console.log(`\n${updates.length} updates ready. Run with --apply to write to DB.`);
}

await pool.close();
