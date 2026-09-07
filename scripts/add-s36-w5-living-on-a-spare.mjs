#!/usr/bin/env node
/**
 * S36 week 5 (9/07): Living on a Spare never submitted a lineup, so LP prep was
 * inheriting their week 4 one -- which lists Ian McCarthy, who is bowling for
 * Guttermouths tonight on a live week 5 submission. With him removed the prep script
 * slid Annie Segrest up from the bench by roster order, which is a guess.
 *
 * Russ's call (2026-09-07): Ian is not bowling with Living on a Spare, put the Penalty
 * placeholder (bowlerID 629) in the slot instead so it is explicit rather than guessed.
 *
 * Recorded as a real week 5 submission rather than patched into the CSV, because
 * `--verify` diffs LP's roster order against lineupSubmissions. Left as an inherited
 * lineup it would report a permanent false mismatch every time we re-verify.
 *
 * submittedBy is marked admin on purpose: the captain did not submit this.
 *
 * Usage:
 *   node scripts/add-s36-w5-living-on-a-spare.mjs            # DRY RUN
 *   node scripts/add-s36-w5-living-on-a-spare.mjs --commit
 */
import sql from 'mssql';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');

const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
for (const l of env.split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }
const pool = await sql.connect({
  server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 },
});

const SEASON = 36, WEEK = 5, TEAM = 17;          // Living on a Spare
const LINEUP = [
  { position: 1, bowlerID: 331, name: 'Lillith Fallon' },
  { position: 2, bowlerID: 141, name: 'Danielle Gambogi' },
  { position: 3, bowlerID: 185, name: 'Ellen Duda' },
  { position: 4, bowlerID: 629, name: 'Penalty' },
];

console.log(COMMIT ? '=== COMMIT ===' : '=== DRY RUN (pass --commit to write) ===');

// Resolve the three real bowlers by name so a wrong hardcoded ID cannot slip through.
for (const e of LINEUP) {
  const r = (await pool.request().input('n', sql.VarChar(100), e.name)
    .query('SELECT bowlerID FROM bowlers WHERE bowlerName = @n')).recordset;
  if (r.length !== 1) throw new Error(`${e.name}: expected 1 bowlers row, got ${r.length}`);
  if (r[0].bowlerID !== e.bowlerID) {
    console.log(`  note: ${e.name} is bowlerID ${r[0].bowlerID}, correcting from ${e.bowlerID}`);
    e.bowlerID = r[0].bowlerID;
  }
}

const existing = (await pool.request()
  .input('s', sql.Int, SEASON).input('w', sql.Int, WEEK).input('t', sql.Int, TEAM)
  .query('SELECT id FROM lineupSubmissions WHERE seasonID=@s AND week=@w AND teamID=@t')).recordset;

if (existing.length) {
  console.log(`ABORT  a week ${WEEK} submission already exists (id ${existing[0].id}). Nothing written.`);
  await pool.close();
  process.exit(0);
}

console.log(`${COMMIT ? 'INSERT' : 'WOULD INSERT'}  Living on a Spare S${SEASON} wk${WEEK}:`);
for (const e of LINEUP) console.log(`   ${e.position}. ${e.name} (${e.bowlerID})`);

if (COMMIT) {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const ins = await new sql.Request(tx)
      .input('s', sql.Int, SEASON).input('w', sql.Int, WEEK).input('t', sql.Int, TEAM)
      .input('by', sql.VarChar(100), 'Russ (admin)')
      .query(`INSERT INTO lineupSubmissions (seasonID, week, teamID, submittedBy, submittedAt, status)
              OUTPUT INSERTED.id
              VALUES (@s, @w, @t, @by, SYSUTCDATETIME(), 'submitted')`);
    const subID = ins.recordset[0].id;
    for (const e of LINEUP) {
      await new sql.Request(tx)
        .input('sub', sql.Int, subID).input('p', sql.Int, e.position).input('b', sql.Int, e.bowlerID)
        .query('INSERT INTO lineupEntries (submissionID, position, bowlerID) VALUES (@sub, @p, @b)');
    }
    await tx.commit();
    console.log(`DONE  submissionID ${subID}, 4 entries`);
  } catch (err) { await tx.rollback(); throw err; }
}

await pool.close();
