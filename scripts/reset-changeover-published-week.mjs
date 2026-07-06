/**
 * Season-changeover reset for the published-week pointer.
 *
 * At a season changeover the leagueSettings 'publishedWeek' / 'publishedSeasonID'
 * still hold the PRIOR season's last published week (e.g. season 35, week 9).
 * The public site guards against this leak (getPublishedContext only trusts
 * publishedWeek when publishedSeasonID matches the current season, and floors
 * pre-season to week 1), but the /evillair ADMIN pages read publishedWeek
 * directly with no season guard, so they show "Week 9 published / next week 10"
 * instead of the fresh season at week 1.
 *
 * This resets the pointer to the current season with publishedWeek = 0
 * (nothing published yet -> admin "next week" becomes 1). Safe for the public
 * site: publishedSeasonID then matches current, publishedWeek = 0 is floored
 * to week 1 exactly as before.
 *
 * Does NOT touch the .published-week file (a cache tag; rewritten on the first
 * real weekly publish) and does NOT touch per-week checklist keys
 * (preNightDone-wN / postNightDone-wN).
 *
 * Usage:
 *   node scripts/reset-changeover-published-week.mjs            # dry run (default)
 *   node scripts/reset-changeover-published-week.mjs --commit   # apply
 */
import sql from 'mssql';
import { readFileSync } from 'fs';

const commit = process.argv.includes('--commit');

const envContent = readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const dbConfig = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 },
};

async function main() {
  const pool = await sql.connect(dbConfig);

  const cur = await pool.request().query(
    `SELECT TOP 1 seasonID, displayName FROM seasons
     ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC`,
  );
  const season = cur.recordset[0];
  if (!season) throw new Error('No current season found');

  const before = await pool.request().query(
    `SELECT settingKey, settingValue FROM leagueSettings
     WHERE settingKey IN ('publishedWeek', 'publishedSeasonID')`,
  );
  const b = Object.fromEntries(before.recordset.map((r) => [r.settingKey, r.settingValue]));

  console.log(`Current season: ${season.seasonID} (${season.displayName})`);
  console.log(`BEFORE  publishedSeasonID=${b.publishedSeasonID}  publishedWeek=${b.publishedWeek}`);
  console.log(`TARGET  publishedSeasonID=${season.seasonID}  publishedWeek=0`);

  if (!commit) {
    console.log('\nDry run. Re-run with --commit to apply.');
    await pool.close();
    return;
  }

  await pool.request().input('v', String(season.seasonID))
    .query(`UPDATE leagueSettings SET settingValue = @v WHERE settingKey = 'publishedSeasonID'`);
  await pool.request().input('v', '0')
    .query(`UPDATE leagueSettings SET settingValue = @v WHERE settingKey = 'publishedWeek'`);

  const after = await pool.request().query(
    `SELECT settingKey, settingValue FROM leagueSettings
     WHERE settingKey IN ('publishedWeek', 'publishedSeasonID')`,
  );
  const a = Object.fromEntries(after.recordset.map((r) => [r.settingKey, r.settingValue]));
  console.log(`AFTER   publishedSeasonID=${a.publishedSeasonID}  publishedWeek=${a.publishedWeek}`);
  console.log('\nDone. Admin dashboard now points at week 1 (force-dynamic, no deploy needed).');

  await pool.close();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
