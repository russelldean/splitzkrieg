#!/usr/bin/env node
/**
 * One-time: create Wes Wood and Payton McRae, who first appear as SUBSTITUTES on
 * the S36 week 4 (8/24, Event C) paper scoresheets.
 *
 *   Wes Wood     subbed for Danielle Gambogi on Living on a Spare
 *   Payton McRae subbed for Anthony Bennet   on Gutterglory
 *
 * Both are no-average bowlers: incomingAvg stays NULL, which makes the scores
 * computed columns emit 219 per handicap game automatically. Both sheets already
 * scored them that way, so the paper totals confirm the rule.
 *
 * Unlike the Jenna Land case there is nothing to relink: they were never on a
 * lineup submission, they walked in as subs. lineupSubmissions keeps recording
 * what the captain submitted; the substitution lives in `scores`.
 *
 * Usage:
 *   node scripts/add-s36-w4-subs.mjs             # DRY RUN
 *   node scripts/add-s36-w4-subs.mjs --commit
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
  { name: 'Wes Wood',     slug: 'wes-wood',     gender: 'M', subFor: 'Danielle Gambogi (Living on a Spare)' },
  { name: 'Payton McRae', slug: 'payton-mcrae', gender: 'M', subFor: 'Anthony Bennet (Gutterglory)' },
];

const pool = await sql.connect(dbConfig);
console.log(COMMIT ? '=== COMMIT ===' : '=== DRY RUN (pass --commit to write) ===');

for (const B of NEW) {
  const existing = (await pool.request()
    .input('slug', sql.VarChar(100), B.slug)
    .query('SELECT bowlerID, bowlerName FROM bowlers WHERE slug = @slug')).recordset;

  if (existing.length) {
    console.log(`SKIP  ${B.name} already exists as bowlerID ${existing[0].bowlerID}`);
    continue;
  }
  if (!COMMIT) {
    console.log(`WOULD INSERT  ${B.name} slug=${B.slug} gender=${B.gender}   (sub for ${B.subFor})`);
    continue;
  }
  const ins = await pool.request()
    .input('name', sql.VarChar(100), B.name)
    .input('slug', sql.VarChar(100), B.slug)
    .input('gender', sql.Char(1), B.gender)
    .query(`INSERT INTO bowlers (bowlerName, slug, gender, isActive, isPublic, isEligible)
            OUTPUT INSERTED.bowlerID
            VALUES (@name, @slug, @gender, 1, 1, 1)`);
  console.log(`INSERTED  ${B.name} -> bowlerID ${ins.recordset[0].bowlerID}   (sub for ${B.subFor})`);
}

await pool.close();
