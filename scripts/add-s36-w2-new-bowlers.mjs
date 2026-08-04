#!/usr/bin/env node
/**
 * One-time: create the two brand-new bowlers who first appear in the S36 week 2
 * lineup submissions, and relink their lineupEntries rows from free-text to a
 * real bowlerID.
 *
 * Both are no-average bowlers: incomingAvg stays NULL, which makes the scores
 * computed columns emit 219 per handicap game automatically.
 *
 * The Hot Shotz captain submitted "Ben Rice"; Russ confirmed the correct name is
 * "Ben Price", so the entry is corrected as it is relinked.
 *
 * Usage:
 *   node scripts/add-s36-w2-new-bowlers.mjs            # DRY RUN
 *   node scripts/add-s36-w2-new-bowlers.mjs --commit
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
const dbConfig = {
  server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 },
};

const NEW = [
  { name: 'Molly Halligan', slug: 'molly-halligan', gender: 'F', submittedAs: 'Molly Halligan' },
  { name: 'Ben Price',      slug: 'ben-price',      gender: 'M', submittedAs: 'Ben Rice' },
];

async function main() {
  const pool = await sql.connect(dbConfig);
  console.log(COMMIT ? '=== COMMIT ===' : '=== DRY RUN (pass --commit to write) ===');

  for (const b of NEW) {
    const existing = (await pool.request()
      .input('slug', sql.VarChar(100), b.slug)
      .query('SELECT bowlerID, bowlerName FROM bowlers WHERE slug = @slug')).recordset;
    if (existing.length) {
      console.log(`SKIP  ${b.name} already exists as bowlerID ${existing[0].bowlerID}`);
      b.bowlerID = existing[0].bowlerID;
      continue;
    }

    if (!COMMIT) { console.log(`WOULD INSERT  ${b.name} (${b.gender}) slug=${b.slug}`); continue; }

    const ins = await pool.request()
      .input('name', sql.VarChar(100), b.name)
      .input('slug', sql.VarChar(100), b.slug)
      .input('gender', sql.Char(1), b.gender)
      .query(`INSERT INTO bowlers (bowlerName, slug, gender, isActive, isPublic, isEligible)
              OUTPUT INSERTED.bowlerID
              VALUES (@name, @slug, @gender, 1, 1, 1)`);
    b.bowlerID = ins.recordset[0].bowlerID;
    console.log(`INSERTED  ${b.name} -> bowlerID ${b.bowlerID}`);
  }

  // Relink the free-text lineup entries.
  for (const b of NEW) {
    const rows = (await pool.request()
      .input('sub', sql.VarChar(200), b.submittedAs)
      .query(`SELECT le.id, t.teamName, le.position
              FROM lineupEntries le
              JOIN lineupSubmissions ls ON ls.id = le.submissionID
              JOIN teams t ON t.teamID = ls.teamID
              WHERE ls.seasonID = 36 AND ls.week = 2
                AND le.bowlerID IS NULL AND le.newBowlerName = @sub`)).recordset;
    for (const r of rows) {
      if (!COMMIT) { console.log(`WOULD RELINK  ${r.teamName} pos ${r.position}: "${b.submittedAs}" -> ${b.name}`); continue; }
      await pool.request()
        .input('id', sql.Int, r.id)
        .input('bowlerID', sql.Int, b.bowlerID)
        .query('UPDATE lineupEntries SET bowlerID = @bowlerID, newBowlerName = NULL WHERE id = @id');
      console.log(`RELINKED  ${r.teamName} pos ${r.position}: "${b.submittedAs}" -> ${b.name} (${b.bowlerID})`);
    }
  }

  const check = (await pool.request().query(`
    SELECT t.teamName, le.position, COALESCE(b.bowlerName, le.newBowlerName) AS name, le.bowlerID
    FROM lineupSubmissions ls
    JOIN lineupEntries le ON le.submissionID = ls.id
    JOIN teams t ON t.teamID = ls.teamID
    LEFT JOIN bowlers b ON b.bowlerID = le.bowlerID
    WHERE ls.seasonID = 36 AND ls.week = 2 AND t.teamID IN (4, 15)
    ORDER BY t.teamName, le.position`)).recordset;
  console.log('\n--- High Rollers + Hot Shotz week 2 lineups after ---');
  console.table(check);

  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
