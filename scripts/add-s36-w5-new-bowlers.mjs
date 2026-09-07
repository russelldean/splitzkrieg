#!/usr/bin/env node
/**
 * One-time: create the two bowlers who first appear in S36 week 5 (9/07, Event C)
 * lineup submissions as free text, and relink their lineupEntries rows from
 * newBowlerName to a real bowlerID.
 *
 *   Alex Donovan  - HOT FUN, position 3
 *   Rob Pence     - Sparadigm Shift, position 1
 *
 * Both audited against `bowlers` first: neither matches an existing row, and neither
 * has bowled for that team in S36, so these are genuine new bowlers rather than the
 * note-in-the-name trap (see feedback_lineup_freetext_traps).
 *
 * No-average bowlers: incomingAvg stays NULL, which makes the scores computed columns
 * emit 219 per handicap game automatically (feedback_new_bowler_219).
 *
 * Usage:
 *   node scripts/add-s36-w5-new-bowlers.mjs                             # DRY RUN
 *   node scripts/add-s36-w5-new-bowlers.mjs --commit --donovan=M --pence=M
 */
import sql from 'mssql';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');
const arg = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); return h ? h.split('=').slice(1).join('=') : d; };

const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
for (const l of env.split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }
const dbConfig = {
  server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 },
};

const BOWLERS = [
  { name: 'Alex Donovan', slug: 'alex-donovan', submittedAs: 'Alex Donovan', gender: arg('donovan', null) },
  { name: 'Rob Pence',    slug: 'rob-pence',    submittedAs: 'Rob Pence',    gender: arg('pence', null) },
];

async function main() {
  const pool = await sql.connect(dbConfig);
  console.log(COMMIT ? '=== COMMIT ===' : '=== DRY RUN (pass --commit to write) ===');

  for (const B of BOWLERS) {
    console.log(`\n--- ${B.name}`);
    const existing = (await pool.request()
      .input('slug', sql.VarChar(100), B.slug)
      .query('SELECT bowlerID, bowlerName FROM bowlers WHERE slug = @slug')).recordset;

    if (existing.length) {
      B.bowlerID = existing[0].bowlerID;
      console.log(`SKIP  already exists as bowlerID ${B.bowlerID}`);
    } else if (!COMMIT) {
      console.log(`WOULD INSERT  slug=${B.slug} gender=${B.gender ?? 'NULL'}`);
    } else {
      const ins = await pool.request()
        .input('name', sql.VarChar(100), B.name)
        .input('slug', sql.VarChar(100), B.slug)
        .input('gender', sql.Char(1), B.gender)
        .query(`INSERT INTO bowlers (bowlerName, slug, gender, isActive, isPublic, isEligible)
                OUTPUT INSERTED.bowlerID
                VALUES (@name, @slug, @gender, 1, 1, 1)`);
      B.bowlerID = ins.recordset[0].bowlerID;
      console.log(`INSERTED  -> bowlerID ${B.bowlerID}`);
    }

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
  }

  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
