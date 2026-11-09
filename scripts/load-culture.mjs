#!/usr/bin/env node
/**
 * Load the Billboard Hot 100 number ones and the US weekend box office number
 * ones into two lookup tables, from Wikipedia's yearly lists. The season recap
 * uses them for "what was number one on your first bowling night".
 *
 *   node scripts/load-culture.mjs            # every year from 2007 to now
 *   node scripts/load-culture.mjs --year=2026  # one year (re-run at each changeover)
 *
 * Idempotent: rows are keyed by date and upserted. Afterwards it reports any
 * league night in `schedule` that has no match within a week, so a gap in the
 * source shows up here rather than as a silently missing sentence.
 */
import sql from 'mssql';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); return h ? h.split('=')[1] : null; };
const ONLY_YEAR = arg('year') ? parseInt(arg('year'), 10) : null;
const FIRST_YEAR = 2007;
const UA = 'SplitzkriegBowling/1.0 (league site; https://splitzkrieg.com)';

const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
for (const l of env.split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }

async function pageHtml(title) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&formatversion=2`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  const j = await r.json();
  if (!j.parse) throw new Error(`Wikipedia could not parse "${title}": ${JSON.stringify(j).slice(0, 160)}`);
  return j.parse.text;
}

const strip = (h) => h
  .replace(/<sup[^>]*>.*?<\/sup>/gs, '')
  // Tags become spaces so "featuring<a>Nelly" does not fuse into one word.
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#160;|&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ').replace(/\s+([,.;:)])/g, '$1').replace(/\(\s+/g, '(').trim();

/** Every wikitable on the page as a grid of strings, rowspan and colspan expanded. */
function tables(html) {
  const out = [];
  for (const t of html.matchAll(/<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>(.*?)<\/table>/gs)) {
    const grid = []; const pending = new Map();
    for (const tr of t[1].matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)) {
      const row = []; let c = 0; let ci = 0;
      const cells = [...tr[1].matchAll(/<(td|th)([^>]*)>(.*?)<\/\1>/gs)];
      while (ci < cells.length || pending.has(c)) {
        if (pending.has(c)) { const p = pending.get(c); row[c] = p.text; if (--p.rows === 0) pending.delete(c); c++; continue; }
        const [, , attrs, inner] = cells[ci++];
        const rs = parseInt((attrs.match(/rowspan="?(\d+)/) || [])[1] || '1', 10);
        const cs = parseInt((attrs.match(/colspan="?(\d+)/) || [])[1] || '1', 10);
        const text = strip(inner);
        for (let k = 0; k < cs; k++) { row[c] = text; if (rs > 1) pending.set(c, { text, rows: rs - 1 }); c++; }
      }
      if (row.length) grid.push(row);
    }
    out.push(grid);
  }
  return out;
}

const findTable = (grids, ...headerWords) =>
  grids.find(g => g[0] && headerWords.every(w => g[0].some(h => h.toLowerCase().includes(w))));

const col = (header, word) => header.findIndex(h => h.toLowerCase().includes(word));

function parseDate(text, year) {
  const d = new Date(`${text.replace(/,?\s*\d{4}$/, '')}, ${year} 00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function billboardRows(year, grids) {
  const g = findTable(grids, 'issue date', 'song');
  if (!g) throw new Error(`no Hot 100 table for ${year}`);
  const [h, ...rows] = g;
  const iDate = col(h, 'issue date'), iSong = col(h, 'song'), iArtist = col(h, 'artist');
  const out = [];
  for (const r of rows) {
    const chartDate = parseDate(r[iDate] ?? '', year);
    const song = (r[iSong] ?? '').replace(/[†‡*]/g, '').replace(/^"|"$/g, '').trim();
    const artist = (r[iArtist] ?? '').replace(/[†‡*]/g, '').trim();
    if (chartDate && song && artist) out.push({ chartDate, song, artist });
  }
  return out;
}

function boxOfficeRows(year, grids) {
  const g = findTable(grids, 'weekend end date', 'film');
  if (!g) throw new Error(`no box office table for ${year}`);
  const [h, ...rows] = g;
  const iDate = col(h, 'weekend end date'), iFilm = col(h, 'film'), iGross = col(h, 'gross');
  const out = [];
  for (const r of rows) {
    const weekendEndDate = parseDate(r[iDate] ?? '', year);
    const film = (r[iFilm] ?? '').replace(/[†‡*]/g, '').trim();
    const gross = parseInt((r[iGross] ?? '').replace(/[^0-9]/g, ''), 10);
    if (weekendEndDate && film) out.push({ weekendEndDate, film, grossUsd: Number.isFinite(gross) ? gross : null });
  }
  return out;
}

const pool = await sql.connect({
  server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 },
});

await pool.request().batch(`
  IF OBJECT_ID('billboardNumberOnes') IS NULL
    CREATE TABLE billboardNumberOnes (
      chartDate date NOT NULL PRIMARY KEY,
      song nvarchar(200) NOT NULL,
      artist nvarchar(200) NOT NULL
    );
  IF OBJECT_ID('boxOfficeNumberOnes') IS NULL
    CREATE TABLE boxOfficeNumberOnes (
      weekendEndDate date NOT NULL PRIMARY KEY,
      film nvarchar(200) NOT NULL,
      grossUsd bigint NULL
    );
`);

const thisYear = new Date().getUTCFullYear();
const years = ONLY_YEAR ? [ONLY_YEAR] : Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);

for (const year of years) {
  const [bb, bo] = await Promise.all([
    pageHtml(`List of Billboard Hot 100 number ones of ${year}`).then(h => billboardRows(year, tables(h))),
    pageHtml(`List of ${year} box office number-one films in the United States`).then(h => boxOfficeRows(year, tables(h))),
  ]);
  for (const r of bb) {
    await pool.request().input('d', sql.Date, r.chartDate).input('s', sql.NVarChar(200), r.song).input('a', sql.NVarChar(200), r.artist).query(`
      MERGE billboardNumberOnes AS t USING (SELECT @d AS chartDate) AS src ON t.chartDate = src.chartDate
      WHEN MATCHED THEN UPDATE SET song = @s, artist = @a
      WHEN NOT MATCHED THEN INSERT (chartDate, song, artist) VALUES (@d, @s, @a);`);
  }
  for (const r of bo) {
    await pool.request().input('d', sql.Date, r.weekendEndDate).input('f', sql.NVarChar(200), r.film).input('g', sql.BigInt, r.grossUsd).query(`
      MERGE boxOfficeNumberOnes AS t USING (SELECT @d AS weekendEndDate) AS src ON t.weekendEndDate = src.weekendEndDate
      WHEN MATCHED THEN UPDATE SET film = @f, grossUsd = @g
      WHEN NOT MATCHED THEN INSERT (weekendEndDate, film, grossUsd) VALUES (@d, @f, @g);`);
  }
  console.log(`${year}: ${bb.length} Hot 100 weeks, ${bo.length} box office weekends`);
}

const gaps = (await pool.request().query(`
  SELECT DISTINCT sch.matchDate
  FROM schedule sch
  WHERE sch.matchDate IS NOT NULL
    AND (NOT EXISTS (SELECT 1 FROM billboardNumberOnes b WHERE b.chartDate >= sch.matchDate AND b.chartDate < DATEADD(day, 14, sch.matchDate))
      OR NOT EXISTS (SELECT 1 FROM boxOfficeNumberOnes x WHERE x.weekendEndDate <= sch.matchDate AND x.weekendEndDate > DATEADD(day, -8, sch.matchDate)))
  ORDER BY sch.matchDate`)).recordset;
const totals = (await pool.request().query(`SELECT (SELECT COUNT(*) FROM billboardNumberOnes) AS hot100, (SELECT COUNT(*) FROM boxOfficeNumberOnes) AS boxOffice`)).recordset[0];
console.log(`\nTable totals: ${totals.hot100} Hot 100 weeks, ${totals.boxOffice} box office weekends`);
if (gaps.length) {
  console.log(`\n${gaps.length} league night(s) without a number one within a week of the date:`);
  for (const g of gaps) console.log('  ' + g.matchDate.toISOString().slice(0, 10));
} else {
  console.log('Every league night has a Hot 100 chart and a box office weekend within reach.');
}
await pool.close();
