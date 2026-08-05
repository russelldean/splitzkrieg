#!/usr/bin/env node
/**
 * Audit EVERY derivable patch against the source data, all seasons at once.
 *
 * Recomputes the qualifying set for each patch type straight from `scores` and diffs it
 * against `bowlerPatches`, reporting MISSING (earned but not awarded) and EXTRA (awarded
 * but not earned). Written after two silent gaps surfaced by hand on 2026-08-04:
 *   - S36 wk1 had no Weekly High Game / High Series at all
 *   - S35 had ZERO scratch-playoff patches (all 16 qualifiers missing)
 * Both were bad/partial runs, not bad logic, which is exactly what a coverage diff catches.
 *
 * WHEN TO RUN ALL SEASONS: only when past data has been deliberately changed (a rule
 * change, a backfill, a score correction in an old season). The weekly gate
 * (`verify-week.mjs`) audits the CURRENT SEASON only — history does not drift on its own,
 * and all 36 seasons were verified clean on 2026-08-04.
 *
 * Usage:
 *   node scripts/audit-patches.mjs                 # all seasons (after touching history)
 *   node scripts/audit-patches.mjs --season=35
 *   node scripts/audit-patches.mjs --fix           # insert MISSING rows (never deletes)
 *   node scripts/audit-patches.mjs --quiet         # summary table only
 *
 * NOT auto-verifiable (outcome-based, no source of truth in `scores`): playoff, champion,
 * scratchChampion, hcpChampion, captain. Their counts are reported, never diffed.
 */
import sql from 'mssql';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const arg = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); return h ? h.split('=')[1] : d; };
const SEASON = arg('season');
const FIX = process.argv.includes('--fix');
const QUIET = process.argv.includes('--quiet');

const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
for (const l of env.split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }

const pool = await sql.connect({
  server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 180000, requestTimeout: 180000 },
});
const q = async (s) => (await pool.request().query(s)).recordset;

const sf = SEASON ? `AND sc.seasonID = ${parseInt(SEASON, 10)}` : '';
const sf2 = SEASON ? `AND sc2.seasonID = ${parseInt(SEASON, 10)}` : '';
// S27 ran a short schedule; every other season needs 18 games to qualify for a playoff.
const MIN_GAMES = `CASE WHEN seasonID = 27 THEN 9 ELSE 18 END`;

// Each entry yields rows of (bowlerID, seasonID, week). week NULL = season-level patch.
const WEEKLY = {
  botw: `
    SELECT x.bowlerID, x.seasonID, x.week FROM (
      SELECT sc.seasonID, sc.week, sc.bowlerID,
        RANK() OVER (PARTITION BY sc.seasonID, sc.week ORDER BY sc.handSeries DESC) AS rnk
      FROM scores sc WHERE sc.isPenalty = 0 AND sc.incomingAvg IS NOT NULL AND sc.incomingAvg > 0 ${sf}
    ) x WHERE x.rnk = 1`,
  highGame: `
    SELECT x.bowlerID, x.seasonID, x.week FROM (
      SELECT sc.seasonID, sc.week, sc.bowlerID,
        RANK() OVER (PARTITION BY sc.seasonID, sc.week ORDER BY
          CASE WHEN sc.game1 >= ISNULL(sc.game2,0) AND sc.game1 >= ISNULL(sc.game3,0) THEN sc.game1
               WHEN sc.game2 >= ISNULL(sc.game3,0) THEN sc.game2 ELSE sc.game3 END DESC) AS rnk
      FROM scores sc WHERE sc.isPenalty = 0 ${sf}
    ) x WHERE x.rnk = 1`,
  highSeries: `
    SELECT x.bowlerID, x.seasonID, x.week FROM (
      SELECT sc.seasonID, sc.week, sc.bowlerID,
        RANK() OVER (PARTITION BY sc.seasonID, sc.week ORDER BY sc.scratchSeries DESC) AS rnk
      FROM scores sc WHERE sc.isPenalty = 0 ${sf}
    ) x WHERE x.rnk = 1`,
  // Matching your average COUNTS as above average (confirmed by Russ 2026-08-04).
  aboveAvg: `
    SELECT sc.bowlerID, sc.seasonID, sc.week FROM scores sc
    WHERE sc.isPenalty = 0 AND sc.incomingAvg IS NOT NULL AND sc.incomingAvg > 0
      AND sc.game1 >= sc.incomingAvg AND sc.game2 >= sc.incomingAvg AND sc.game3 >= sc.incomingAvg ${sf}`,
  threeOfAKind: `
    SELECT sc.bowlerID, sc.seasonID, sc.week FROM scores sc
    WHERE sc.isPenalty = 0 AND sc.game1 = sc.game2 AND sc.game2 = sc.game3 AND sc.game1 IS NOT NULL ${sf}`,
  perfectGame: `
    SELECT sc.bowlerID, sc.seasonID, sc.week FROM scores sc
    WHERE sc.isPenalty = 0 AND (sc.game1 = 300 OR sc.game2 = 300 OR sc.game3 = 300) ${sf}`,
};

const SEASONAL = {
  scratchPlayoff: `
    SELECT r.bowlerID, r.seasonID, NULL AS week FROM (
      SELECT sc2.seasonID, sc2.bowlerID,
        RANK() OVER (PARTITION BY sc2.seasonID, b2.gender ORDER BY
          CAST(SUM(sc2.game1 + sc2.game2 + sc2.game3) * 1.0 / NULLIF(COUNT(sc2.scoreID) * 3, 0) AS DECIMAL(5,1)) DESC) AS rnk
      FROM scores sc2 JOIN bowlers b2 ON b2.bowlerID = sc2.bowlerID
      WHERE sc2.isPenalty = 0 AND b2.gender IN ('M','F') ${sf2}
      GROUP BY sc2.seasonID, sc2.bowlerID, b2.gender
      HAVING COUNT(*) * 3 >= ${MIN_GAMES.replace('seasonID', 'sc2.seasonID')}
    ) r WHERE r.rnk <= 8`,
  hcpPlayoff: `
    SELECT r.bowlerID, r.seasonID, NULL AS week FROM (
      SELECT ss.seasonID, ss.bowlerID, RANK() OVER (PARTITION BY ss.seasonID ORDER BY ss.hcpAvg DESC) AS rnk
      FROM (
        SELECT sc2.seasonID, sc2.bowlerID,
          CAST(SUM(sc2.handSeries) * 1.0 / NULLIF(COUNT(sc2.scoreID) * 3, 0) AS DECIMAL(5,1)) AS hcpAvg
        FROM scores sc2 WHERE sc2.isPenalty = 0 ${sf2}
        GROUP BY sc2.seasonID, sc2.bowlerID
        HAVING COUNT(*) * 3 >= ${MIN_GAMES.replace('seasonID', 'sc2.seasonID')}
      ) ss
      WHERE NOT EXISTS (
        SELECT 1 FROM bowlerPatches bp JOIN patches p ON p.patchID = bp.patchID
        WHERE p.code = 'scratchPlayoff' AND bp.bowlerID = ss.bowlerID AND bp.seasonID = ss.seasonID)
    ) r WHERE r.rnk <= 8`,
};

const MANUAL = ['playoff', 'champion', 'scratchChampion', 'hcpChampion', 'captain'];

// Berry's playoff 300 — see the note at the `extra` filter below.
const KNOWN_MANUAL_PERFECT = new Set(
  (await q(`SELECT bowlerID FROM bowlers WHERE slug = 'geoffrey-berry'`)).map(r => r.bowlerID),
);

const patches = await q('SELECT patchID, code, name FROM patches');
const pid = new Map(patches.map(p => [p.code, p.patchID]));

const key = (r) => `${r.bowlerID}|${r.seasonID ?? ''}|${r.week ?? ''}`;
const results = [];

for (const [code, query] of [...Object.entries(WEEKLY), ...Object.entries(SEASONAL)]) {
  const expected = await q(query);
  const actual = await q(`
    SELECT bp.bowlerID, bp.seasonID, bp.week FROM bowlerPatches bp
    WHERE bp.patchID = ${pid.get(code)} ${SEASON ? `AND bp.seasonID = ${parseInt(SEASON, 10)}` : ''}`);
  const aSet = new Set(actual.map(key));
  const eSet = new Set(expected.map(key));
  const missing = expected.filter(r => !aSet.has(key(r)));
  // Geoffrey Berry's 300 was rolled in a PLAYOFF game, and playoff scores do not live in
  // `scores` — so it can never be re-derived and was inserted by hand. Legitimate, not extra.
  const extra = actual.filter(r => !eSet.has(key(r)) && !(code === 'perfectGame' && KNOWN_MANUAL_PERFECT.has(r.bowlerID)));
  results.push({ code, expected: expected.length, actual: actual.length, missing, extra });
}

console.log(`\nPATCH AUDIT${SEASON ? ` — season ${SEASON}` : ' — all seasons'}\n`);
console.log('patch             expected   awarded   MISSING   EXTRA');
for (const r of results) {
  const flag = (r.missing.length || r.extra.length) ? '   <<<' : '';
  console.log(`  ${r.code.padEnd(16)}${String(r.expected).padStart(6)}${String(r.actual).padStart(10)}${String(r.missing.length).padStart(10)}${String(r.extra.length).padStart(8)}${flag}`);
}
console.log('\nnot auto-verifiable (outcome-based, reported only):');
for (const code of MANUAL) {
  const n = (await q(`SELECT COUNT(*) n FROM bowlerPatches WHERE patchID = ${pid.get(code)} ${SEASON ? `AND seasonID = ${parseInt(SEASON, 10)}` : ''}`))[0].n;
  console.log(`  ${code.padEnd(16)}${String(n).padStart(6)} awarded`);
}

if (!QUIET) {
  const names = new Map((await q('SELECT bowlerID, bowlerName FROM bowlers')).map(b => [b.bowlerID, b.bowlerName]));
  for (const r of results) {
    if (!r.missing.length && !r.extra.length) continue;
    console.log(`\n--- ${r.code} ---`);
    const bySeason = new Map();
    for (const m of r.missing) { const k = m.seasonID; if (!bySeason.has(k)) bySeason.set(k, []); bySeason.get(k).push(m); }
    for (const [s, list] of [...bySeason.entries()].sort((a, b) => b[0] - a[0])) {
      const detail = list.slice(0, 8).map(m => `${names.get(m.bowlerID) ?? m.bowlerID}${m.week ? ` w${m.week}` : ''}`).join(', ');
      console.log(`  S${s}: ${list.length} missing — ${detail}${list.length > 8 ? ', ...' : ''}`);
    }
    for (const e of r.extra.slice(0, 10)) console.log(`  EXTRA S${e.seasonID}${e.week ? ` w${e.week}` : ''}: ${names.get(e.bowlerID) ?? e.bowlerID}`);
    if (r.extra.length > 10) console.log(`  ... ${r.extra.length - 10} more extra`);
  }
}

const totalMissing = results.reduce((n, r) => n + r.missing.length, 0);
const totalExtra = results.reduce((n, r) => n + r.extra.length, 0);

if (FIX && totalMissing) {
  console.log(`\nInserting ${totalMissing} missing patch rows...`);
  let n = 0;
  for (const r of results) for (const m of r.missing) {
    await pool.request()
      .input('b', sql.Int, m.bowlerID).input('p', sql.Int, pid.get(r.code))
      .input('s', sql.Int, m.seasonID ?? null).input('w', sql.Int, m.week ?? null)
      .query(`INSERT INTO bowlerPatches (bowlerID, patchID, seasonID, week)
              SELECT @b, @p, @s, @w WHERE NOT EXISTS (
                SELECT 1 FROM bowlerPatches WHERE bowlerID=@b AND patchID=@p
                  AND ISNULL(seasonID,0)=ISNULL(@s,0) AND ISNULL(week,0)=ISNULL(@w,0))`);
    n++;
  }
  console.log(`Inserted ${n}. EXTRA rows are never removed automatically — review them by hand.`);
}

console.log(`\n${totalMissing === 0 && totalExtra === 0 ? 'ALL PATCHES UP TO DATE' : `${totalMissing} MISSING, ${totalExtra} EXTRA`}`);
await pool.close();
process.exit(totalMissing || totalExtra ? 1 : 0);
