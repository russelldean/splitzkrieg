/**
 * One-time importer for Season XXXVI (Fall 2026).
 *
 * Creates the season row, the 90-match schedule (9 weeks; weeks 1-3 are the
 * split A/B phase = two dates each, weeks 4-9 combined), and the division
 * assignments. Mirrors the Fall 2025 (S34) model. nightNumber is left NULL and
 * assigned afterward by scripts/add-night-number.mjs (global DENSE_RANK).
 *
 * Usage:
 *   node scripts/import-s36-schedule.mjs             # DRY RUN (default) - prints, no writes
 *   node scripts/import-s36-schedule.mjs --commit    # actually writes to the DB
 *
 * After --commit: run  node scripts/add-night-number.mjs  then bump/commit
 * .data-versions.json (this script bumps the schedule channel locally).
 */
import sql from 'mssql';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');

const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
for (const l of env.split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }
const dbConfig = {
  server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 },
};

// --- Season definition ---
const SEASON = {
  romanNumeral: 'XXXVI', displayName: 'Fall 2026', period: 'Fall', year: 2026,
  seasonNumber: 2, teamCount: 20, divisionCount: 2, weekCount: 9,
};

// --- Divisions (sheet Div 1 -> "Division A", Div 2 -> "Division B") ---
const DIVISIONS = {
  'Division A': ['Living on a Spare', 'Guttermouths', 'Bowl Durham', 'Hot Shotz', 'Valley of the Balls', 'Stinky Cheese', 'Fancy Pants', 'Lucky Strikes', 'Alley Oops', 'Gutterglory'],
  'Division B': ['E-Bowla', "Grandma's Teeth", 'Guttersnipes', 'Pin-Ups', 'HOT FUN', 'Sparadigm Shift', 'The Boom Kings', 'Smoke-a-Bowl', 'Thoughts and Spares', 'Wild Llamas'],
};

// --- Schedule: weeks -> dates -> matches ([team1, team2]). matchNumber auto-1..90. ---
const WEEKS = [
  { week: 1, dates: [
    { date: '2026-07-13', matches: [['Living on a Spare', 'Guttermouths'], ['Guttersnipes', 'Pin-Ups'], ['Valley of the Balls', 'Alley Oops'], ['E-Bowla', "Grandma's Teeth"], ['Bowl Durham', 'Hot Shotz']] },
    { date: '2026-07-20', matches: [['Stinky Cheese', 'Fancy Pants'], ['The Boom Kings', 'Smoke-a-Bowl'], ['Thoughts and Spares', 'Wild Llamas'], ['HOT FUN', 'Sparadigm Shift'], ['Lucky Strikes', 'Gutterglory']] },
  ]},
  { week: 2, dates: [
    { date: '2026-07-27', matches: [['E-Bowla', 'Guttersnipes'], ['Bowl Durham', 'Valley of the Balls'], ["Grandma's Teeth", 'Thoughts and Spares'], ['Pin-Ups', 'Wild Llamas'], ['Hot Shotz', 'Alley Oops']] },
    { date: '2026-08-03', matches: [['Fancy Pants', 'Gutterglory'], ['Guttermouths', 'Lucky Strikes'], ['Living on a Spare', 'Stinky Cheese'], ['HOT FUN', 'The Boom Kings'], ['Sparadigm Shift', 'Smoke-a-Bowl']] },
  ]},
  { week: 3, dates: [
    { date: '2026-08-10', matches: [['Hot Shotz', 'Valley of the Balls'], ['Smoke-a-Bowl', 'Thoughts and Spares'], ["Grandma's Teeth", 'Guttersnipes'], ['Bowl Durham', 'Alley Oops'], ['E-Bowla', 'Pin-Ups']] },
    { date: '2026-08-17', matches: [['Guttermouths', 'Gutterglory'], ['HOT FUN', 'Wild Llamas'], ['Sparadigm Shift', 'The Boom Kings'], ['Stinky Cheese', 'Lucky Strikes'], ['Living on a Spare', 'Fancy Pants']] },
  ]},
  { week: 4, dates: [{ date: '2026-08-24', matches: [["Grandma's Teeth", 'Pin-Ups'], ['Fancy Pants', 'Lucky Strikes'], ['Alley Oops', 'Gutterglory'], ['Living on a Spare', 'Bowl Durham'], ['Smoke-a-Bowl', 'Wild Llamas'], ['The Boom Kings', 'Thoughts and Spares'], ['Guttermouths', 'Hot Shotz'], ['Valley of the Balls', 'Stinky Cheese'], ['E-Bowla', 'HOT FUN'], ['Guttersnipes', 'Sparadigm Shift']] }]},
  { week: 5, dates: [{ date: '2026-09-07', matches: [['Guttersnipes', 'Smoke-a-Bowl'], ['Stinky Cheese', 'Gutterglory'], ['E-Bowla', 'Sparadigm Shift'], ['Pin-Ups', 'Thoughts and Spares'], ['The Boom Kings', 'Wild Llamas'], ["Grandma's Teeth", 'HOT FUN'], ['Guttermouths', 'Bowl Durham'], ['Living on a Spare', 'Hot Shotz'], ['Valley of the Balls', 'Fancy Pants'], ['Lucky Strikes', 'Alley Oops']] }]},
  { week: 6, dates: [{ date: '2026-09-21', matches: [['HOT FUN', 'Thoughts and Spares'], ["Grandma's Teeth", 'Sparadigm Shift'], ['Guttersnipes', 'Wild Llamas'], ['Hot Shotz', 'Gutterglory'], ['Guttermouths', 'Stinky Cheese'], ['Fancy Pants', 'Alley Oops'], ['Living on a Spare', 'Valley of the Balls'], ['Bowl Durham', 'Lucky Strikes'], ['Pin-Ups', 'Smoke-a-Bowl'], ['E-Bowla', 'The Boom Kings']] }]},
  { week: 7, dates: [{ date: '2026-10-05', matches: [['Pin-Ups', 'HOT FUN'], ['Hot Shotz', 'Fancy Pants'], ['Living on a Spare', 'Lucky Strikes'], ['Sparadigm Shift', 'Wild Llamas'], ["Grandma's Teeth", 'The Boom Kings'], ['Stinky Cheese', 'Alley Oops'], ['Guttersnipes', 'Thoughts and Spares'], ['E-Bowla', 'Smoke-a-Bowl'], ['Bowl Durham', 'Gutterglory'], ['Guttermouths', 'Valley of the Balls']] }]},
  { week: 8, dates: [{ date: '2026-10-19', matches: [['Hot Shotz', 'Lucky Strikes'], ['Living on a Spare', 'Alley Oops'], ['HOT FUN', 'Smoke-a-Bowl'], ['Guttermouths', 'Fancy Pants'], ['Valley of the Balls', 'Gutterglory'], ['Pin-Ups', 'Sparadigm Shift'], ["Grandma's Teeth", 'Wild Llamas'], ['E-Bowla', 'Thoughts and Spares'], ['Guttersnipes', 'The Boom Kings'], ['Bowl Durham', 'Stinky Cheese']] }]},
  { week: 9, dates: [{ date: '2026-11-02', matches: [["Grandma's Teeth", 'Smoke-a-Bowl'], ['Sparadigm Shift', 'Thoughts and Spares'], ['Bowl Durham', 'Fancy Pants'], ['Guttermouths', 'Alley Oops'], ['Guttersnipes', 'HOT FUN'], ['Valley of the Balls', 'Lucky Strikes'], ['E-Bowla', 'Wild Llamas'], ['Pin-Ups', 'The Boom Kings'], ['Living on a Spare', 'Gutterglory'], ['Hot Shotz', 'Stinky Cheese']] }]},
];

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

async function main() {
  const pool = await sql.connect(dbConfig);

  // Resolve team names -> IDs
  const teams = (await pool.request().query('SELECT teamID, teamName FROM teams')).recordset;
  const byNorm = new Map(teams.map((t) => [norm(t.teamName), t]));
  const resolve1 = (name) => {
    const t = byNorm.get(norm(name));
    if (!t) throw new Error(`UNRESOLVED TEAM: "${name}"`);
    return t.teamID;
  };

  // Build flat schedule rows
  const rows = [];
  let matchNumber = 0;
  for (const w of WEEKS) for (const d of w.dates) for (const [t1, t2] of d.matches) {
    matchNumber++;
    rows.push({ week: w.week, matchNumber, date: d.date, t1, t2, t1ID: resolve1(t1), t2ID: resolve1(t2) });
  }

  // Guard + report
  const existing = (await pool.request().query(`SELECT seasonID FROM seasons WHERE romanNumeral = '${SEASON.romanNumeral}'`)).recordset;
  const curr = (await pool.request().query(`SELECT seasonID, displayName FROM seasons WHERE isCurrentSeason = 1`)).recordset[0];

  console.log(`\n=== ${COMMIT ? 'COMMIT' : 'DRY RUN'} — Season ${SEASON.romanNumeral} (${SEASON.displayName}) ===`);
  console.log(`Season row: ${JSON.stringify(SEASON)}  isCurrentSeason=1`);
  console.log(`Current season now: ${curr ? `${curr.displayName} (id ${curr.seasonID}) -> will flip to isCurrentSeason=0` : 'none'}`);
  console.log(`Already exists? ${existing.length ? `YES (id ${existing[0].seasonID}) — ABORT` : 'no'}`);
  console.log(`\nSchedule: ${rows.length} matches across ${WEEKS.length} weeks`);
  let curWeek = 0;
  for (const r of rows) {
    if (r.week !== curWeek) { curWeek = r.week; console.log(`  -- Week ${r.week} --`); }
    console.log(`   #${String(r.matchNumber).padStart(2)} ${r.date}  ${r.t1} (${r.t1ID}) vs ${r.t2} (${r.t2ID})`);
  }
  console.log(`\nDivisions:`);
  for (const [name, list] of Object.entries(DIVISIONS)) console.log(`  ${name}: ${list.map((n) => `${n}(${resolve1(n)})`).join(', ')}`);

  if (existing.length) { console.log('\nSeason already exists — aborting.'); await pool.close(); return; }
  if (!COMMIT) { console.log('\n[dry run] No writes. Re-run with --commit to apply.'); await pool.close(); return; }

  // --- WRITE (transaction) ---
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query(`UPDATE seasons SET isCurrentSeason = 0 WHERE isCurrentSeason = 1`);
    const ins = await new sql.Request(tx)
      .input('rn', sql.VarChar(10), SEASON.romanNumeral).input('dn', sql.VarChar(50), SEASON.displayName)
      .input('pd', sql.VarChar(10), SEASON.period).input('yr', sql.Int, SEASON.year)
      .input('sn', sql.Int, SEASON.seasonNumber).input('tc', sql.Int, SEASON.teamCount)
      .input('dc', sql.Int, SEASON.divisionCount).input('wc', sql.Int, SEASON.weekCount)
      .query(`INSERT INTO seasons (romanNumeral, displayName, period, year, seasonNumber, teamCount, divisionCount, weekCount, isCurrentSeason)
              OUTPUT INSERTED.seasonID VALUES (@rn, @dn, @pd, @yr, @sn, @tc, @dc, @wc, 1)`);
    const seasonID = ins.recordset[0].seasonID;
    console.log(`\nInserted season id ${seasonID}`);

    for (const r of rows) {
      await new sql.Request(tx)
        .input('s', sql.Int, seasonID).input('w', sql.Int, r.week).input('mn', sql.Int, r.matchNumber)
        .input('t1', sql.Int, r.t1ID).input('t2', sql.Int, r.t2ID).input('d', sql.Date, r.date)
        .query(`INSERT INTO schedule (seasonID, week, matchNumber, team1ID, team2ID, matchDate)
                VALUES (@s, @w, @mn, @t1, @t2, @d)`);
    }
    console.log(`Inserted ${rows.length} schedule rows`);

    for (const [name, list] of Object.entries(DIVISIONS)) for (const tn of list) {
      await new sql.Request(tx).input('s', sql.Int, seasonID).input('t', sql.Int, resolve1(tn)).input('dn', sql.VarChar(50), name)
        .query(`INSERT INTO seasonDivisions (seasonID, teamID, divisionName) VALUES (@s, @t, @dn)`);
    }
    console.log(`Inserted 20 seasonDivisions rows`);

    await tx.commit();
    console.log('Transaction committed.');

    // Bump schedule data-version channel for the new season
    const dvPath = resolve(ROOT, '.data-versions.json');
    const dv = JSON.parse(readFileSync(dvPath, 'utf8'));
    if (!dv.schedule) dv.schedule = {};
    dv.schedule[String(seasonID)] = (dv.schedule[String(seasonID)] ?? 1) + 1;
    writeFileSync(dvPath, JSON.stringify(dv, null, 2) + '\n');
    console.log(`Bumped .data-versions.json schedule.${seasonID} -> v${dv.schedule[String(seasonID)]}`);
    console.log(`\nNEXT: node scripts/add-night-number.mjs   (assign nightNumber), then handle stable-cache clear + commit/deploy.`);
  } catch (e) {
    await tx.rollback();
    console.error('ROLLED BACK:', e.message);
    throw e;
  }
  await pool.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
