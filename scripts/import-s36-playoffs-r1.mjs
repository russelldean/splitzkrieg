#!/usr/bin/env node
/**
 * S36 playoffs, round 1 (bowled 2026-11-09), transcribed from the paper sheets.
 *
 * Writes, for season 36:
 *   - playoffResults: both team semifinals with winners, plus the Final matchup
 *   - individualPlayoffParticipants: round 1 fields and the round 2 (top four) fields
 *   - playoffScores: one row per bowler for round 1
 *
 * Dry run by default. Pass --commit to write. Safe to re-run: season 36 playoff
 * rows are replaced, never duplicated.
 *
 * Every team game is checked against the handwritten "total w/ hdcp" and every
 * individual series against the handwritten series before anything is written.
 */

import sql from 'mssql';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');
const SEASON = 36;
const ROUND = 1;

const envContent = readFileSync(resolve(PROJECT_ROOT, '.env.local'), 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const TEAMS = { 'Lucky Strikes': 18, 'Stinky Cheese': 31, 'HOT FUN': 14, Guttersnipes: 13 };

// [bowlerID, name, printed avg, [g1, g2, g3], turkeys, team, bracket]
// A bowler who was in both a team match and a bracket bowled ONE set of games
// that counts for both, so they get a single row carrying both.
const ROWS = [
  // Division A semifinal
  [386, 'Kristie Porter', 130, [126, 193, 155], 1, 'Lucky Strikes', 'WomensScratch'],
  [121, 'Christina Manzella', 132, [150, 155, 144], null, 'Lucky Strikes', 'WomensScratch'],
  [548, 'Russ Dean', 177, [147, 139, 170], null, 'Lucky Strikes', 'MensScratch'],
  [225, 'Geoffrey Berry', 180, [216, 170, 214], 3, 'Lucky Strikes', 'MensScratch'],
  [616, 'Ulises Palestino', 157, [162, 156, 195], null, 'Stinky Cheese', 'Handicap'],
  [585, 'Steve Bishop', 185, [186, 182, 156], null, 'Stinky Cheese', 'MensScratch'],
  [262, 'Jack Driver', 152, [150, 125, 199], 2, 'Stinky Cheese', null],
  [169, 'Denis Webb', 177, [133, 145, 175], null, 'Stinky Cheese', 'MensScratch'],
  // Division B semifinal
  [168, 'Denis McPhillips', 150, [178, 145, 132], null, 'HOT FUN', 'Handicap'],
  [318, 'John Bellizzi', 141, [161, 130, 148], 1, 'HOT FUN', null],
  [455, 'Matt Wade', 154, [158, 177, 203], 1, 'HOT FUN', null],
  [618, 'Vance Woods', 150, [150, 133, 139], null, 'HOT FUN', 'Handicap'],
  [416, 'Lloyd Mason', 149, [128, 173, 103], null, 'Guttersnipes', 'Handicap'],
  [445, 'Matt Northrup', 126, [145, 111, 105], null, 'Guttersnipes', null],
  [568, 'Seth Horton', 128, [139, 110, 145], null, 'Guttersnipes', null],
  [610, 'Tom Page', 143, [131, 131, 131], null, 'Guttersnipes', null],
  // Bracket only
  [479, 'Mike DePasquale', 179, [200, 202, 196], null, null, 'MensScratch'],
  [599, 'Terrence Chambers', 174, [167, 168, 170], null, null, 'MensScratch'],
  [11, 'Alex Rubenstein', 167, [211, 163, 132], null, null, 'MensScratch'],
  [637, 'Ben Rice', 167, [212, 236, 255], null, null, 'MensScratch'],
  [207, 'Erin Biggerstaff', 178, [154, 163, 165], null, null, 'WomensScratch'],
  [84, 'Brooke Insley', 145, [133, 151, 151], null, null, 'WomensScratch'],
  [24, 'Amy Kostrewa', 145, [130, 152, 167], null, null, 'WomensScratch'],
  [387, 'Kristin Pearson', 141, [111, 123, 147], null, null, 'WomensScratch'],
  [470, 'Melissa Lee', 138, [107, 113, 76], null, null, 'WomensScratch'],
  [188, 'Elizabeth Read', 130, [156, 117, 139], null, null, 'WomensScratch'],
  [160, 'David Felton', 138, [148, 185, 172], null, null, 'Handicap'],
  [251, 'Ian McCarthy', 129, [139, 163, 127], null, null, 'Handicap'],
  // In the handicap field, did not bowl (struck through on the sheet)
  [206, 'Erik Ramquist', 131, [null, null, null], null, null, 'Handicap'],
  [194, 'Emma Jane Richardson', 125, [null, null, null], null, null, 'Handicap'],
];

// Handwritten totals, used only as checksums.
const TEAM_TOTALS = {
  'Lucky Strikes': [904, 922, 948],
  'Stinky Cheese': [847, 824, 941],
  'HOT FUN': [935, null, 910],
  Guttersnipes: [878, null, 819],
};
const SERIES = {
  585: 524, 225: 600, 548: 456, 169: 453, 479: 598, 599: 505, 11: 506, 637: 703,
  207: 482, 84: 435, 24: 449, 387: 381, 470: 296, 121: 449, 188: 412, 386: 474,
  // handicap sheet shows series WITH handicap
  168: 668, 416: 620, 160: 751, 618: 635, 251: 702, 616: 705,
};

// Semis: [loser, winner] (team1 = loser, team2 = winner, the S35 convention).
const SEMIS = [
  { loser: 'Stinky Cheese', winner: 'Lucky Strikes' },
  { loser: 'Guttersnipes', winner: 'HOT FUN' },
];

// Fields in seed order. Vance Woods bowled in place of Rebecca Pattillo.
const FIELD_R1 = {
  MensScratch: [585, 225, 548, 169, 479, 599, 11, 637],
  WomensScratch: [207, 84, 24, 387, 470, 121, 188, 386],
  Handicap: [168, 206, 194, 416, 160, 618, 251, 616],
};
// Top four by the night's series (marked with a dash on the sheets).
const FIELD_R2 = {
  MensScratch: [637, 225, 479, 585],
  WomensScratch: [207, 386, 24, 121],
  Handicap: [160, 616, 251, 168],
};

const hcp = (avg) => Math.min(147, Math.floor((225 - Math.floor(avg)) * 0.95));

function check() {
  const problems = [];
  for (const [team, totals] of Object.entries(TEAM_TOTALS)) {
    const rows = ROWS.filter((r) => r[5] === team);
    if (rows.length !== 4) problems.push(`${team}: ${rows.length} bowlers`);
    const computed = [0, 1, 2].map((g) => rows.reduce((s, r) => s + r[3][g] + hcp(r[2]), 0));
    console.log(`  ${team.padEnd(14)} ${computed.join(' / ')}`);
    totals.forEach((t, g) => {
      if (t != null && t !== computed[g]) problems.push(`${team} game ${g + 1}: sheet ${t}, computed ${computed[g]}`);
    });
  }
  for (const r of ROWS) {
    const [id, name, avg, games, , , bracket] = r;
    if (games[0] == null) continue;
    const want = SERIES[id];
    if (want == null) continue;
    const scratch = games[0] + games[1] + games[2];
    const got = bracket === 'Handicap' ? scratch + 3 * hcp(avg) : scratch;
    if (got !== want) problems.push(`${name}: sheet series ${want}, computed ${got}`);
  }
  for (const s of SEMIS) {
    const tot = (team) => [0, 1, 2].map((g) => ROWS.filter((r) => r[5] === team).reduce((a, r) => a + r[3][g] + hcp(r[2]), 0));
    const w = tot(s.winner), l = tot(s.loser);
    const games = [0, 1, 2].filter((g) => w[g] > l[g]).length;
    console.log(`  ${s.winner} beat ${s.loser} ${games}-${3 - games}`);
    if (games < 2) problems.push(`${s.winner} did not win the match on games`);
  }
  for (const [type, ids] of Object.entries(FIELD_R2)) {
    const ranked = ROWS.filter((r) => r[6] === type && r[3][0] != null)
      .map((r) => ({ id: r[0], v: r[3][0] + r[3][1] + r[3][2] + (type === 'Handicap' ? 3 * hcp(r[2]) : 0) }))
      .sort((a, b) => b.v - a.v);
    const cutoff = ranked[3].v;
    for (const id of ids) {
      if (ranked.find((x) => x.id === id).v < cutoff) problems.push(`${type}: bowler ${id} is not in the top four`);
    }
  }
  return problems;
}

async function main() {
  console.log('Checksums (team game totals with handicap):');
  const problems = check();
  if (problems.length) {
    console.error('\nCHECKSUM FAILURES:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
  console.log('All checksums match the sheets.\n');

  if (!COMMIT) {
    console.log(`Dry run. ${ROWS.length} score rows, 2 semifinals + final, 6 fields. Pass --commit to write.`);
    return;
  }

  const pool = await new sql.ConnectionPool({
    server: process.env.AZURE_SQL_SERVER,
    database: process.env.AZURE_SQL_DATABASE,
    user: process.env.AZURE_SQL_USER,
    password: process.env.AZURE_SQL_PASSWORD,
    options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 30000 },
  }).connect();

  // Names in this file must match the DB, so an ID typo cannot land on the wrong bowler.
  const names = await pool.request().query(
    `SELECT bowlerID, bowlerName FROM bowlers WHERE bowlerID IN (${ROWS.map((r) => r[0]).join(',')})`,
  );
  const byId = new Map(names.recordset.map((r) => [r.bowlerID, r.bowlerName]));
  for (const r of ROWS) {
    if (byId.get(r[0]) !== r[1]) throw new Error(`bowlerID ${r[0]} is "${byId.get(r[0])}" in the DB, expected "${r[1]}"`);
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = () => new sql.Request(tx);

    await req().query(`DELETE FROM playoffResults WHERE seasonID = ${SEASON} AND playoffType = 'Team'`);
    for (const s of SEMIS) {
      await req()
        .input('t1', sql.Int, TEAMS[s.loser])
        .input('t2', sql.Int, TEAMS[s.winner])
        .query(`INSERT INTO playoffResults (seasonID, playoffType, round, team1ID, team2ID, winnerTeamID)
                VALUES (${SEASON}, 'Team', 'semifinal', @t1, @t2, @t2)`);
    }
    await req()
      .input('t1', sql.Int, TEAMS[SEMIS[0].winner])
      .input('t2', sql.Int, TEAMS[SEMIS[1].winner])
      .query(`INSERT INTO playoffResults (seasonID, playoffType, round, team1ID, team2ID, winnerTeamID)
              VALUES (${SEASON}, 'Team', 'final', @t1, @t2, NULL)`);

    await req().query(`DELETE FROM individualPlayoffParticipants WHERE seasonID = ${SEASON}`);
    for (const [round, fields] of [[1, FIELD_R1], [2, FIELD_R2]]) {
      for (const [type, ids] of Object.entries(fields)) {
        for (let i = 0; i < ids.length; i++) {
          await req()
            .input('type', sql.VarChar(30), type)
            .input('round', sql.Int, round)
            .input('position', sql.Int, i + 1)
            .input('bowlerID', sql.Int, ids[i])
            .query(`INSERT INTO individualPlayoffParticipants (seasonID, championshipType, round, position, bowlerID)
                    VALUES (${SEASON}, @type, @round, @position, @bowlerID)`);
        }
      }
    }

    await req().query(`DELETE FROM playoffScores WHERE seasonID = ${SEASON} AND round = ${ROUND}`);
    for (const [bowlerID, , avg, games, turkeys, team, bracket] of ROWS) {
      await req()
        .input('bowlerID', sql.Int, bowlerID)
        .input('teamID', sql.Int, team ? TEAMS[team] : null)
        .input('championshipType', sql.VarChar(30), bracket)
        .input('game1', sql.Int, games[0])
        .input('game2', sql.Int, games[1])
        .input('game3', sql.Int, games[2])
        .input('incomingAvg', sql.Decimal(5, 1), avg)
        .input('turkeys', sql.Int, turkeys)
        .query(`INSERT INTO playoffScores (seasonID, bowlerID, round, teamID, championshipType,
                                           game1, game2, game3, incomingAvg, turkeys)
                VALUES (${SEASON}, @bowlerID, ${ROUND}, @teamID, @championshipType,
                        @game1, @game2, @game3, @incomingAvg, @turkeys)`);
    }

    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  // The DB computes handicap itself; confirm it agrees with the sheets.
  const back = await pool.request().query(
    `SELECT teamID, SUM(hcpGame1) g1, SUM(hcpGame2) g2, SUM(hcpGame3) g3
     FROM playoffScores WHERE seasonID = ${SEASON} AND round = ${ROUND} AND teamID IS NOT NULL
     GROUP BY teamID`,
  );
  const idToTeam = Object.fromEntries(Object.entries(TEAMS).map(([n, id]) => [id, n]));
  for (const r of back.recordset) {
    const want = TEAM_TOTALS[idToTeam[r.teamID]];
    const got = [r.g1, r.g2, r.g3];
    const ok = want.every((t, g) => t == null || t === got[g]);
    console.log(`  DB ${idToTeam[r.teamID].padEnd(14)} ${got.join(' / ')} ${ok ? 'OK' : 'MISMATCH'}`);
    if (!ok) process.exitCode = 1;
  }
  await pool.close();

  const versionsPath = resolve(PROJECT_ROOT, '.data-versions.json');
  const versions = JSON.parse(readFileSync(versionsPath, 'utf8'));
  versions.playoffScores ??= {};
  versions.playoffScores[String(SEASON)] = (versions.playoffScores[String(SEASON)] || 1) + 1;
  writeFileSync(versionsPath, JSON.stringify(versions, null, 2) + '\n');
  console.log(`\nWritten. playoffScores.${SEASON} cache version -> ${versions.playoffScores[String(SEASON)]}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
