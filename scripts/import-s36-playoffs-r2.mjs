#!/usr/bin/env node
/**
 * S36 playoffs, round 2 / finals (bowled 2026-11-16), transcribed from the paper sheets.
 *
 * Writes, for season 36:
 *   - playoffScores: one row per bowler for round 2
 *   - playoffResults: the Final row (team1 = champion, team2 = runner-up, the final convention)
 *   - seasonChampions: Team, MensScratch, WomensScratch, Handicap
 *
 * Dry run by default. Pass --commit to write. Safe to re-run: round 2 rows and the
 * season 36 champion rows (except Turkeys) are replaced, never duplicated.
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
const ROUND = 2;

const envContent = readFileSync(resolve(PROJECT_ROOT, '.env.local'), 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const TEAMS = { 'Lucky Strikes': 18, 'HOT FUN': 14 };

// [bowlerID, name, printed avg, [g1, g2, g3], turkeys, team, bracket]
// Bowlers in both the final and a bracket bowled ONE set of games that counts for both
// (the bracket sheets mark them with a star and copy the team-sheet games).
const ROWS = [
  // Final
  [386, 'Kristie Porter', 130, [112, 121, 110], null, 'Lucky Strikes', 'WomensScratch'],
  [121, 'Christina Manzella', 132, [134, 166, 136], null, 'Lucky Strikes', 'WomensScratch'],
  [548, 'Russ Dean', 177, [157, 159, 162], 1, 'Lucky Strikes', null],
  [225, 'Geoffrey Berry', 180, [148, 201, 173], null, 'Lucky Strikes', 'MensScratch'],
  [168, 'Denis McPhillips', 150, [174, 174, 166], 1, 'HOT FUN', 'Handicap'],
  [318, 'John Bellizzi', 141, [159, 181, 142], null, 'HOT FUN', null],
  [455, 'Matt Wade', 154, [162, 175, 147], 1, 'HOT FUN', null],
  [618, 'Vance Woods', 150, [133, 170, 134], null, 'HOT FUN', null],
  // Bracket only
  [637, 'Ben Rice', 167, [141, 224, 173], null, null, 'MensScratch'],
  [479, 'Mike DePasquale', 179, [213, 194, 215], null, null, 'MensScratch'],
  [585, 'Steve Bishop', 185, [202, 170, 203], null, null, 'MensScratch'],
  [207, 'Erin Biggerstaff', 178, [164, 169, 128], null, null, 'WomensScratch'],
  [24, 'Amy Kostrewa', 145, [167, 124, 135], null, null, 'WomensScratch'],
  [160, 'David Felton', 138, [132, 129, 144], null, null, 'Handicap'],
  [616, 'Ulises Palestino', 157, [184, 152, 179], null, null, 'Handicap'],
  [251, 'Ian McCarthy', 129, [148, 124, 146], null, null, 'Handicap'],
];

// Handwritten totals, used only as checksums.
const TEAM_TOTALS = {
  'Lucky Strikes': [816, 912, 846],
  'HOT FUN': [916, 988, 877],
};
const SERIES = {
  637: 538, 225: 522, 479: 622, 585: 575,
  207: 461, 386: 343, 24: 426, 121: 436,
  // handicap sheet shows series WITH handicap
  160: 651, 616: 707, 251: 691, 168: 727,
};

const FINAL = { winner: 'HOT FUN', loser: 'Lucky Strikes' };
// Highest round 2 series in each bracket (checked below). Team is the bowler's S36 team.
const CHAMPIONS = [
  { type: 'MensScratch', bowlerID: 479, teamID: 9 },
  { type: 'WomensScratch', bowlerID: 207, teamID: 39 },
  { type: 'Handicap', bowlerID: 168, teamID: 14 },
];

const hcp = (avg) => Math.min(147, Math.floor((225 - Math.floor(avg)) * 0.95));
const teamTotals = (team) =>
  [0, 1, 2].map((g) => ROWS.filter((r) => r[5] === team).reduce((s, r) => s + r[3][g] + hcp(r[2]), 0));

function check() {
  const problems = [];
  for (const [team, totals] of Object.entries(TEAM_TOTALS)) {
    const rows = ROWS.filter((r) => r[5] === team);
    if (rows.length !== 4) problems.push(`${team}: ${rows.length} bowlers`);
    const computed = teamTotals(team);
    console.log(`  ${team.padEnd(14)} ${computed.join(' / ')}`);
    totals.forEach((t, g) => {
      if (t != null && t !== computed[g]) problems.push(`${team} game ${g + 1}: sheet ${t}, computed ${computed[g]}`);
    });
  }
  for (const r of ROWS) {
    const [id, name, avg, games, , , bracket] = r;
    const want = SERIES[id];
    if (want == null) continue;
    const scratch = games[0] + games[1] + games[2];
    const got = bracket === 'Handicap' ? scratch + 3 * hcp(avg) : scratch;
    if (got !== want) problems.push(`${name}: sheet series ${want}, computed ${got}`);
  }
  const w = teamTotals(FINAL.winner), l = teamTotals(FINAL.loser);
  const games = [0, 1, 2].filter((g) => w[g] > l[g]).length;
  console.log(`  ${FINAL.winner} beat ${FINAL.loser} ${games}-${3 - games}`);
  if (games < 2) problems.push(`${FINAL.winner} did not win the final on games`);
  for (const c of CHAMPIONS) {
    const ranked = ROWS.filter((r) => r[6] === c.type)
      .map((r) => ({ id: r[0], v: r[3][0] + r[3][1] + r[3][2] + (c.type === 'Handicap' ? 3 * hcp(r[2]) : 0) }))
      .sort((a, b) => b.v - a.v);
    if (ranked.length !== 4) problems.push(`${c.type}: ${ranked.length} bowlers, expected 4`);
    console.log(`  ${c.type.padEnd(14)} ${ranked.map((x) => `${x.id}:${x.v}`).join('  ')}`);
    if (ranked[0].id !== c.bowlerID || ranked[0].v === ranked[1].v) problems.push(`${c.type}: champion is not a clear ${c.bowlerID}`);
  }
  return problems;
}

async function main() {
  console.log('Checksums:');
  const problems = check();
  if (problems.length) {
    console.error('\nCHECKSUM FAILURES:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
  console.log('All checksums match the sheets.\n');

  if (!COMMIT) {
    console.log(`Dry run. ${ROWS.length} score rows, final winner, ${CHAMPIONS.length + 1} champions. Pass --commit to write.`);
    return;
  }

  const pool = await new sql.ConnectionPool({
    server: process.env.AZURE_SQL_SERVER,
    database: process.env.AZURE_SQL_DATABASE,
    user: process.env.AZURE_SQL_USER,
    password: process.env.AZURE_SQL_PASSWORD,
    options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 30000 },
  }).connect();

  const names = await pool.request().query(
    `SELECT bowlerID, bowlerName FROM bowlers WHERE bowlerID IN (${ROWS.map((r) => r[0]).join(',')})`,
  );
  const byId = new Map(names.recordset.map((r) => [r.bowlerID, r.bowlerName]));
  for (const r of ROWS) {
    if (byId.get(r[0]) !== r[1]) throw new Error(`bowlerID ${r[0]} is "${byId.get(r[0])}" in the DB, expected "${r[1]}"`);
  }
  // Round 2 rows must match the round 2 field already stored.
  const field = await pool.request().query(
    `SELECT championshipType, bowlerID FROM individualPlayoffParticipants WHERE seasonID = ${SEASON} AND round = 2`,
  );
  const fieldKeys = new Set(field.recordset.map((r) => `${r.championshipType}:${r.bowlerID}`));
  const rowKeys = new Set(ROWS.filter((r) => r[6]).map((r) => `${r[6]}:${r[0]}`));
  if (fieldKeys.size !== rowKeys.size || [...rowKeys].some((k) => !fieldKeys.has(k))) {
    throw new Error(`round 2 field mismatch: DB ${[...fieldKeys].join(',')} vs sheet ${[...rowKeys].join(',')}`);
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = () => new sql.Request(tx);

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

    const fin = await req()
      .input('w', sql.Int, TEAMS[FINAL.winner])
      .input('l', sql.Int, TEAMS[FINAL.loser])
      .query(`UPDATE playoffResults SET team1ID = @w, team2ID = @l, winnerTeamID = @w
              WHERE seasonID = ${SEASON} AND playoffType = 'Team' AND round = 'final'`);
    if (fin.rowsAffected[0] !== 1) throw new Error(`final row update touched ${fin.rowsAffected[0]} rows`);

    await req().query(`DELETE FROM seasonChampions WHERE seasonID = ${SEASON}
                       AND championshipType IN ('Team', 'MensScratch', 'WomensScratch', 'Handicap')`);
    await req()
      .input('t', sql.Int, TEAMS[FINAL.winner])
      .query(`INSERT INTO seasonChampions (seasonID, championshipType, winnerTeamID, winnerBowlerID)
              VALUES (${SEASON}, 'Team', @t, NULL)`);
    for (const c of CHAMPIONS) {
      await req()
        .input('type', sql.VarChar(30), c.type)
        .input('t', sql.Int, c.teamID)
        .input('b', sql.Int, c.bowlerID)
        .query(`INSERT INTO seasonChampions (seasonID, championshipType, winnerTeamID, winnerBowlerID)
                VALUES (${SEASON}, @type, @t, @b)`);
    }

    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  const back = await pool.request().query(
    `SELECT teamID, SUM(hcpGame1) g1, SUM(hcpGame2) g2, SUM(hcpGame3) g3
     FROM playoffScores WHERE seasonID = ${SEASON} AND round = ${ROUND} AND teamID IS NOT NULL
     GROUP BY teamID`,
  );
  const idToTeam = Object.fromEntries(Object.entries(TEAMS).map(([n, id]) => [id, n]));
  for (const r of back.recordset) {
    const want = TEAM_TOTALS[idToTeam[r.teamID]];
    const got = [r.g1, r.g2, r.g3];
    const ok = want.every((t, g) => t === got[g]);
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
