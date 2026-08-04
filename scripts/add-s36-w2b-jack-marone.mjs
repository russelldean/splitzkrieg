#!/usr/bin/env node
/**
 * One-time: create Jack Marone, who first appears in the S36 week 2 (8/03, Event B)
 * lineup submission for Living on a Spare, and relink his lineupEntries row from
 * free-text to a real bowlerID.
 *
 * No-average bowler: incomingAvg stays NULL, which makes the scores computed columns
 * emit 219 per handicap game automatically.
 *
 * Usage:
 *   node scripts/add-s36-w2b-jack-marone.mjs                  # DRY RUN
 *   node scripts/add-s36-w2b-jack-marone.mjs --commit [--gender=M]
 */
import sql from 'mssql';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');
const arg = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); return h ? h.split('=').slice(1).join('=') : d; };
const GENDER = arg('gender', null);

const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
for (const l of env.split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }
const dbConfig = {
  server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 },
};

const B = { name: 'Jack Marone', slug: 'jack-marone', submittedAs: 'Jack Marone' };

async function main() {
  const pool = await sql.connect(dbConfig);
  console.log(COMMIT ? '=== COMMIT ===' : '=== DRY RUN (pass --commit to write) ===');

  const existing = (await pool.request()
    .input('slug', sql.VarChar(100), B.slug)
    .query('SELECT bowlerID, bowlerName FROM bowlers WHERE slug = @slug')).recordset;

  if (existing.length) {
    B.bowlerID = existing[0].bowlerID;
    console.log(`SKIP  ${B.name} already exists as bowlerID ${B.bowlerID}`);
  } else if (!COMMIT) {
    console.log(`WOULD INSERT  ${B.name} slug=${B.slug} gender=${GENDER ?? 'NULL'}`);
  } else {
    const ins = await pool.request()
      .input('name', sql.VarChar(100), B.name)
      .input('slug', sql.VarChar(100), B.slug)
      .input('gender', sql.Char(1), GENDER)
      .query(`INSERT INTO bowlers (bowlerName, slug, gender, isActive, isPublic, isEligible)
              OUTPUT INSERTED.bowlerID
              VALUES (@name, @slug, @gender, 1, 1, 1)`);
    B.bowlerID = ins.recordset[0].bowlerID;
    console.log(`INSERTED  ${B.name} -> bowlerID ${B.bowlerID}`);
  }

  // Relink the free-text lineup entry.
  const rows = (await pool.request()
    .input('sub', sql.VarChar(200), B.submittedAs)
    .query(`SELECT le.id, t.teamName, le.position, ls.seasonID, ls.week
            FROM lineupEntries le
            JOIN lineupSubmissions ls ON ls.id = le.submissionID
            JOIN teams t ON t.teamID = ls.teamID
            WHERE le.bowlerID IS NULL AND le.newBowlerName = @sub`)).recordset;

  for (const r of rows) {
    console.log(`  ${COMMIT ? 'RELINK' : 'WOULD RELINK'}  entry ${r.id}: ${r.teamName} S${r.seasonID} wk${r.week} pos ${r.position} -> bowlerID ${B.bowlerID ?? '(pending)'}`);
    if (COMMIT && B.bowlerID) {
      await pool.request()
        .input('id', sql.Int, r.id)
        .input('bid', sql.Int, B.bowlerID)
        .query('UPDATE lineupEntries SET bowlerID = @bid, newBowlerName = NULL WHERE id = @id');
    }
  }
  if (!rows.length) console.log('  no free-text lineupEntries rows found to relink');

  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
