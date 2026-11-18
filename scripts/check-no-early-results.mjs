#!/usr/bin/env node
/**
 * No playoff result may show before it is bowled.
 *
 * S36: the final row was created when the semis were imported (team1 = Lucky
 * Strikes, winner NULL) and two queries read team1ID as "champion", so Lucky
 * Strikes showed as champion for the whole week before the final.
 *
 * This puts the latest season's playoffs back into two undecided states, INSIDE
 * A TRANSACTION THAT IS ALWAYS ROLLED BACK, with the team slots arranged the
 * adversarial way (a team that has not won sits in the "winner" slot), and runs
 * the real SQL from the source files:
 *   A. semis decided, final not bowled   (the state of 2026-11-09 to 11-16)
 *   B. nothing bowled yet
 * It fails if any query returns a champion, runner-up or eliminated team for a
 * match without a winner.
 *
 *   node scripts/check-no-early-results.mjs            # working tree
 *   node scripts/check-no-early-results.mjs --ref=HEAD # SQL as committed (proves the check bites)
 *
 * Exits 0 clean, 1 on a leak, 2 if it cannot run (no DB credentials).
 */

import sql from 'mssql';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REF = process.argv.find((a) => a.startsWith('--ref='))?.slice(6);

const envPath = resolve(ROOT, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
}
if (!process.env.AZURE_SQL_SERVER || !process.env.AZURE_SQL_PASSWORD) {
  console.error('check-no-early-results: no Azure SQL credentials, cannot run');
  process.exit(2);
}

const source = (file) =>
  REF ? execSync(`git show ${REF}:${file}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) : readFileSync(resolve(ROOT, file), 'utf8');

function extractSql(file, name) {
  const m = source(file).match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`));
  if (!m) throw new Error(`${name} not found in ${file}`);
  if (m[1].includes('${')) throw new Error(`${name} interpolates; this check cannot run it verbatim`);
  return m[1];
}

const HISTORY_SQL = extractSql('src/lib/queries/seasons/playoffs.ts', 'GET_ALL_PLAYOFF_HISTORY_SQL');
const FINISHES_SQL = extractSql('src/lib/queries/teams/history.ts', 'GET_TEAM_PLAYOFF_FINISHES_SQL');
const H2H_SQL = extractSql('src/lib/queries/teams/h2h.ts', 'GET_TEAM_PLAYOFF_H2H_SQL');

// The team page filters H2H through decided-playoffs.mjs. At a ref that predates
// it, the page used the rows unfiltered.
let decidedPlayoffH2H = (rows) => rows;
const filterFile = 'src/lib/scoring/decided-playoffs.mjs';
let hasFilter = true;
try { source(filterFile); } catch { hasFilter = false; }
if (hasFilter) {
  const code = source(filterFile);
  ({ decidedPlayoffH2H } = await import(`data:text/javascript,${encodeURIComponent(code)}`));
}

const pool = await new sql.ConnectionPool({
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 60000, requestTimeout: 30000 },
}).connect();

const leaks = [];
const tx = new sql.Transaction(pool);
await tx.begin();
try {
  const q = (text) => new sql.Request(tx).query(text);
  const latest = (await q(`SELECT MAX(seasonID) s FROM playoffResults WHERE playoffType = 'Team' AND round = 'final'`)).recordset[0].s;
  const rows = (await q(`SELECT playoffID, round, team1ID, team2ID, winnerTeamID FROM playoffResults
                         WHERE seasonID = ${latest} AND playoffType = 'Team'`)).recordset;
  const final = rows.find((r) => r.round === 'final');
  const semis = rows.filter((r) => r.round === 'semifinal');
  const teams = [...new Set(rows.flatMap((r) => [r.team1ID, r.team2ID]))];

  async function probe(label, undecided) {
    const finishes = (await q(FINISHES_SQL)).recordset;
    for (const r of (await q(HISTORY_SQL)).recordset.filter((r) => r.seasonID === latest)) {
      leaks.push(`${label}: playoff history shows season ${latest} champion ${r.championName}`);
    }
    for (const f of finishes.filter((f) => f.seasonID === latest)) {
      const round = f.finish === 'semifinalist' ? 'semifinal' : 'final';
      if (undecided.has(round)) leaks.push(`${label}: team ${f.teamID} shown as ${f.finish}`);
    }
    for (const teamID of teams) {
      const h2h = (await new sql.Request(tx).input('teamID', sql.Int, teamID).query(H2H_SQL)).recordset;
      for (const m of decidedPlayoffH2H(h2h, finishes, teamID)) {
        if (m.seasonID === latest && undecided.has(m.round)) {
          leaks.push(`${label}: team ${teamID} page shows the ${m.round} vs ${m.opponentName} as a ${m.won ? 'win' : 'loss'}`);
        }
      }
    }
  }

  // A: final not bowled. Put the team that is NOT the champion in team1, the
  // champion slot under the final convention.
  const loser = final.winnerTeamID === final.team1ID ? final.team2ID : final.team1ID;
  const other = loser === final.team1ID ? final.team2ID : final.team1ID;
  await q(`UPDATE playoffResults SET team1ID = ${loser}, team2ID = ${other}, winnerTeamID = NULL WHERE playoffID = ${final.playoffID}`);
  await probe('A (final not bowled)', new Set(['final']));

  // B: nothing bowled. Semis put the eventual winner in team1, the loser slot
  // under the semifinal convention.
  for (const s of semis) {
    const w = s.winnerTeamID, l = w === s.team1ID ? s.team2ID : s.team1ID;
    await q(`UPDATE playoffResults SET team1ID = ${w}, team2ID = ${l}, winnerTeamID = NULL WHERE playoffID = ${s.playoffID}`);
  }
  await probe('B (nothing bowled)', new Set(['final', 'semifinal']));
} finally {
  await tx.rollback();
  await pool.close();
}

if (leaks.length) {
  console.log(`EARLY RESULTS${REF ? ` at ${REF}` : ''}:\n  ` + [...new Set(leaks)].join('\n  '));
  process.exit(1);
}
console.log(`No early results${REF ? ` at ${REF}` : ''}: undecided playoff matches show no outcome.`);
