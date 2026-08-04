#!/usr/bin/env node
/**
 * One-time: bowlerID 637 was created as "Ben Price". Russ confirmed 2026-08-04 that
 * "Ben Rice" is the correct name and our DB (and LeaguePals) had it wrong.
 *
 * Safe as a plain rename with no cache patching: he has 0 scores, 0 patches,
 * 0 milestones, 0 facts, and no cache file mentions him. His first scores (7/27)
 * are still sitting in staging, so renaming BEFORE the import means they land
 * under the correct name and nothing downstream ever saw "Ben Price".
 *
 * Usage:
 *   node scripts/rename-ben-price-to-ben-rice.mjs            # DRY RUN
 *   node scripts/rename-ben-price-to-ben-rice.mjs --commit
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

const BOWLER_ID = 637;
const OLD_NAME = 'Ben Price', OLD_SLUG = 'ben-price';
const NEW_NAME = 'Ben Rice',  NEW_SLUG = 'ben-rice';

const pool = await sql.connect({
  server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 },
});
console.log(COMMIT ? '=== COMMIT ===' : '=== DRY RUN (pass --commit to write) ===');

const cur = (await pool.request().input('id', sql.Int, BOWLER_ID)
  .query('SELECT bowlerID, bowlerName, slug FROM bowlers WHERE bowlerID=@id')).recordset[0];
if (!cur) { console.error(`bowlerID ${BOWLER_ID} not found`); process.exit(1); }
if (cur.bowlerName === NEW_NAME) { console.log('Already renamed — nothing to do.'); await pool.close(); process.exit(0); }
if (cur.bowlerName !== OLD_NAME) { console.error(`Expected "${OLD_NAME}", found "${cur.bowlerName}". Aborting.`); process.exit(1); }

// Slug collision guard.
const clash = (await pool.request().input('s', sql.VarChar(100), NEW_SLUG).input('id', sql.Int, BOWLER_ID)
  .query('SELECT bowlerID, bowlerName FROM bowlers WHERE slug=@s AND bowlerID<>@id')).recordset;
if (clash.length) { console.error(`Slug "${NEW_SLUG}" already used by ${clash[0].bowlerName} (${clash[0].bowlerID}). Aborting.`); process.exit(1); }

// Confirm the no-cache-patch assumption still holds.
for (const [label, q] of [
  ['scores', 'SELECT COUNT(*) n FROM scores WHERE bowlerID=@id'],
  ['bowlerPatches', 'SELECT COUNT(*) n FROM bowlerPatches WHERE bowlerID=@id'],
  ['bowlerMilestones', 'SELECT COUNT(*) n FROM bowlerMilestones WHERE bowlerID=@id'],
  ['facts', 'SELECT COUNT(*) n FROM facts WHERE bowlerID=@id'],
]) {
  const n = (await pool.request().input('id', sql.Int, BOWLER_ID).query(q)).recordset[0].n;
  console.log(`  ${label}: ${n}${n > 0 ? '   <-- NONZERO: a cache patch may now be required' : ''}`);
}

console.log(`\n  ${COMMIT ? 'RENAME' : 'WOULD RENAME'}  ${cur.bowlerName} (${cur.slug}) -> ${NEW_NAME} (${NEW_SLUG})`);
console.log(`  ${COMMIT ? 'INSERT' : 'WOULD INSERT'}  bowlerNameHistory: "${OLD_NAME}"`);

if (COMMIT) {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).input('id', sql.Int, BOWLER_ID)
      .input('n', sql.VarChar(100), NEW_NAME).input('s', sql.VarChar(100), NEW_SLUG)
      .query('UPDATE bowlers SET bowlerName=@n, slug=@s WHERE bowlerID=@id');
    await new sql.Request(tx).input('id', sql.Int, BOWLER_ID).input('alt', sql.VarChar(100), OLD_NAME)
      .query('INSERT INTO bowlerNameHistory (bowlerID, alternateName) VALUES (@id, @alt)');
    await tx.commit();
    console.log('\nDone.');
  } catch (e) { await tx.rollback(); throw e; }
}
await pool.close();
