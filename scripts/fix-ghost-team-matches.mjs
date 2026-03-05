import sql from 'mssql';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const pool = await new sql.ConnectionPool({
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 30000 },
}).connect();

const GHOST_TEAM_ID = 45;
const BOWLD_PEANUTS_ID = 5;
const DRY_RUN = process.argv.includes('--dry-run');

if (DRY_RUN) console.log('=== DRY RUN — no changes will be made ===\n');

// Get season IDs for XXXI and XXXII
const seasons = await pool.request().query(
  "SELECT seasonID, romanNumeral FROM seasons WHERE romanNumeral IN ('XXXI','XXXII')"
);
const seasonIDs = {};
for (const s of seasons.recordset) seasonIDs[s.romanNumeral] = s.seasonID;
console.log('Season IDs:', seasonIDs);

// Get all Bowl'd Peanuts schedule entries
const schedRows = await pool.request().query(`
  SELECT sch.scheduleID, sch.seasonID, sch.week, sch.team1ID, sch.team2ID
  FROM schedule sch
  WHERE (sch.team1ID = ${BOWLD_PEANUTS_ID} OR sch.team2ID = ${BOWLD_PEANUTS_ID})
    AND sch.seasonID IN (${Object.values(seasonIDs).join(',')})
  ORDER BY sch.seasonID, sch.week
`);

console.log(`\nFound ${schedRows.recordset.length} Bowl'd Peanuts schedule entries to update\n`);

// Step 1: Update schedule to replace Bowl'd Peanuts with Ghost Team
console.log('--- Step 1: Update schedule (team 5 → team 45) ---');
for (const sch of schedRows.recordset) {
  const field = sch.team1ID === BOWLD_PEANUTS_ID ? 'team1ID' : 'team2ID';
  console.log(`  schedID ${sch.scheduleID}: S${sch.seasonID} Wk${sch.week} — ${field} = ${BOWLD_PEANUTS_ID} → ${GHOST_TEAM_ID}`);
  if (!DRY_RUN) {
    await pool.request().query(
      `UPDATE schedule SET ${field} = ${GHOST_TEAM_ID} WHERE scheduleID = ${sch.scheduleID}`
    );
  }
}

// Step 2: Insert 4 penalty rows per week for ghost team
console.log('\n--- Step 2: Insert ghost team penalty scores ---');

// Penalty rows use bowlerID=629, isPenalty=1, null scratch games, hcpGame1/2/3=199, handSeries=597
const PENALTY_BOWLER_ID = 629;

for (const season of ['XXXI', 'XXXII']) {
  const sid = seasonIDs[season];
  const weekEntries = schedRows.recordset.filter(r => r.seasonID === sid);

  for (const sch of weekEntries) {
    const existing = await pool.request()
      .input('sid', sql.Int, sid)
      .input('wk', sql.Int, sch.week)
      .input('tid', sql.Int, GHOST_TEAM_ID)
      .query('SELECT COUNT(*) as cnt FROM scores WHERE seasonID=@sid AND week=@wk AND teamID=@tid');

    if (existing.recordset[0].cnt > 0) {
      console.log(`  S${season} Wk${sch.week}: ghost team already has ${existing.recordset[0].cnt} scores — skipping`);
      continue;
    }

    console.log(`  S${season} Wk${sch.week}: inserting 4 penalty rows for ghost team`);
    if (!DRY_RUN) {
      for (let i = 0; i < 4; i++) {
        await pool.request().query(`
          INSERT INTO scores (bowlerID, seasonID, week, teamID,
            game1, game2, game3, incomingAvg, turkeys, scratchSeries, isPenalty,
            incomingHcp, hcpGame1, hcpGame2, hcpGame3, handSeries)
          VALUES (${PENALTY_BOWLER_ID}, ${sid}, ${sch.week}, ${GHOST_TEAM_ID},
            NULL, NULL, NULL, NULL, NULL, NULL, 1,
            NULL, 199, 199, 199, 597)
        `);
      }
    }
  }
}

// Step 3: Compute match results for ghost team matches
// Rule: opponent wins a game if team scratch game >= (sum of incomingAvg - 20)
// Ghost team always gets 0 wins, 0 XP
console.log('\n--- Step 3: Compute match results ---');

for (const season of ['XXXI', 'XXXII']) {
  const sid = seasonIDs[season];
  const weekEntries = schedRows.recordset.filter(r => r.seasonID === sid);

  for (const sch of weekEntries) {
    // The opponent is whichever team is NOT Bowl'd Peanuts (now ghost)
    const oppID = sch.team1ID === BOWLD_PEANUTS_ID ? sch.team2ID : sch.team1ID;
    const ghostIsTeam1 = sch.team1ID === BOWLD_PEANUTS_ID;

    // Get opponent's bowler scores for this week
    const oppScores = await pool.request()
      .input('sid', sql.Int, sid)
      .input('wk', sql.Int, sch.week)
      .input('tid', sql.Int, oppID)
      .query(`
        SELECT game1, game2, game3, incomingAvg,
          hcpGame1, hcpGame2, hcpGame3
        FROM scores
        WHERE seasonID=@sid AND week=@wk AND teamID=@tid
          AND isPenalty = 0
      `);

    if (oppScores.recordset.length === 0) {
      console.log(`  S${season} Wk${sch.week} schedID ${sch.scheduleID}: no opponent scores found for team ${oppID} — skipping`);
      continue;
    }

    // Team scratch games = sum of individual scratch games
    let teamScratchG1 = 0, teamScratchG2 = 0, teamScratchG3 = 0;
    let teamAvgSum = 0;
    // Team hcp games = sum of individual hcp games
    let teamHcpG1 = 0, teamHcpG2 = 0, teamHcpG3 = 0;

    for (const s of oppScores.recordset) {
      teamScratchG1 += s.game1;
      teamScratchG2 += s.game2;
      teamScratchG3 += s.game3;
      teamAvgSum += (s.incomingAvg || 0);
      teamHcpG1 += s.hcpGame1;
      teamHcpG2 += s.hcpGame2;
      teamHcpG3 += s.hcpGame3;
    }

    const threshold = teamAvgSum - 20;

    // Opponent wins game if scratch game >= threshold
    const g1Win = teamScratchG1 >= threshold ? 1 : 0;
    const g2Win = teamScratchG2 >= threshold ? 1 : 0;
    const g3Win = teamScratchG3 >= threshold ? 1 : 0;
    const oppGamePts = (g1Win + g2Win + g3Win) * 2; // 2 pts per game win
    const ghostGamePts = (3 - g1Win - g2Win - g3Win) * 2;

    console.log(
      `  S${season} Wk${sch.week} schedID ${sch.scheduleID}: opp team ${oppID}` +
      ` | avg ${teamAvgSum}, threshold ${threshold}` +
      ` | scratch: ${teamScratchG1}/${teamScratchG2}/${teamScratchG3}` +
      ` | wins: ${g1Win}/${g2Win}/${g3Win} = ${g1Win+g2Win+g3Win}/3` +
      ` | hcp: ${teamHcpG1}/${teamHcpG2}/${teamHcpG3}`
    );

    // Check for existing matchResult
    const existingMR = await pool.request()
      .input('schedID', sql.Int, sch.scheduleID)
      .query('SELECT resultID FROM matchResults WHERE scheduleID=@schedID');

    if (existingMR.recordset.length > 0) {
      console.log(`    matchResult already exists (resultID ${existingMR.recordset[0].resultID}) — skipping`);
      continue;
    }

    // Insert matchResult
    // Ghost team games are all 0
    if (ghostIsTeam1) {
      // team1 = ghost, team2 = opponent
      if (!DRY_RUN) {
        await pool.request().query(`
          INSERT INTO matchResults (scheduleID,
            team1Game1, team1Game2, team1Game3, team1GamePts, team1BonusPts,
            team2Game1, team2Game2, team2Game3, team2GamePts, team2BonusPts)
          VALUES (${sch.scheduleID},
            0, 0, 0, ${ghostGamePts}, NULL,
            ${teamHcpG1}, ${teamHcpG2}, ${teamHcpG3}, ${oppGamePts}, NULL)
        `);
      }
    } else {
      // team1 = opponent, team2 = ghost
      if (!DRY_RUN) {
        await pool.request().query(`
          INSERT INTO matchResults (scheduleID,
            team1Game1, team1Game2, team1Game3, team1GamePts, team1BonusPts,
            team2Game1, team2Game2, team2Game3, team2GamePts, team2BonusPts)
          VALUES (${sch.scheduleID},
            ${teamHcpG1}, ${teamHcpG2}, ${teamHcpG3}, ${oppGamePts}, NULL,
            0, 0, 0, ${ghostGamePts}, NULL)
        `);
      }
    }
    console.log(`    inserted matchResult`);
  }
}

// Step 4: Update teamNameHistory for ghost team
console.log('\n--- Step 4: Update teamNameHistory ---');
for (const season of ['XXXI', 'XXXII']) {
  const sid = seasonIDs[season];
  const existing = await pool.request()
    .input('sid', sql.Int, sid)
    .input('tid', sql.Int, GHOST_TEAM_ID)
    .query('SELECT * FROM teamNameHistory WHERE seasonID=@sid AND teamID=@tid');
  if (existing.recordset.length > 0) {
    console.log(`  S${season}: ghost team already in teamNameHistory`);
  } else {
    console.log(`  S${season}: inserting Ghost Team into teamNameHistory`);
    if (!DRY_RUN) {
      await pool.request().query(
        `INSERT INTO teamNameHistory (seasonID, teamID, teamName) VALUES (${sid}, ${GHOST_TEAM_ID}, 'Ghost Team')`
      );
    }
  }
}

console.log('\nDone!' + (DRY_RUN ? ' (dry run — no changes made)' : ''));
await pool.close();
