/**
 * Warm the disk cache by sequentially running missing queries.
 * Run: node scripts/warm-cache.mjs
 *
 * This populates .next/cache/sql/ so that `next dev` and `next build`
 * never need to hit Azure SQL — everything comes from disk.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Dynamically import the compiled queries
// We need to run via tsx or after a build — use dotenv + raw SQL instead
import sql from 'mssql';

// Load .env.local (same pattern as other scripts — no dotenv dependency)
const envContent = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const CACHE_VERSION = process.env.DB_CACHE_VERSION ?? '1';
const VERSIONED_DIR = path.join(ROOT, '.next', 'cache', 'sql', `v${CACHE_VERSION}`);
const STABLE_DIR = path.join(ROOT, '.next', 'cache', 'sql', 'stable');

function hasCached(key, stable) {
  const dir = stable ? STABLE_DIR : VERSIONED_DIR;
  return fs.existsSync(path.join(dir, `${key}.json`));
}

function writeCache(key, data, stable) {
  const dir = stable ? STABLE_DIR : VERSIONED_DIR;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(data));
}

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
  connectionTimeout: 60000,
  requestTimeout: 60000,
};

async function main() {
  console.log('Connecting to Azure SQL...');
  const pool = await sql.connect(config);
  console.log('Connected.\n');

  let filled = 0;
  let skipped = 0;

  async function runIfMissing(key, query, params, stable) {
    if (hasCached(key, stable)) {
      skipped++;
      return;
    }
    console.log(`  Fetching: ${key}`);
    const req = pool.request();
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        req.input(name, value);
      }
    }
    const result = await req.query(query);
    writeCache(key, result.recordset, stable);
    filled++;
    // Small delay to be gentle on Azure
    await new Promise(r => setTimeout(r, 500));
  }

  // 1. Get all seasons first
  const seasons = (await pool.request().query(`
    SELECT seasonID,
      LOWER(REPLACE(displayName, ' ', '-')) AS slug,
      romanNumeral, displayName, year, period
    FROM seasons ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
  `)).recordset;

  // getAllSeasonNavList
  await runIfMissing('getAllSeasonNavList', `
    SELECT seasonID, LOWER(REPLACE(displayName, ' ', '-')) AS slug,
      romanNumeral, displayName, year, period
    FROM seasons ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
  `, null, true);

  // Per-season queries
  for (const season of seasons) {
    const sid = season.seasonID;

    // getSeasonBySlug
    await runIfMissing(`getSeasonBySlug-${season.slug}`, `
      SELECT TOP 1 seasonID, romanNumeral, displayName, year, period,
        LOWER(REPLACE(displayName, ' ', '-')) AS slug
      FROM seasons WHERE LOWER(REPLACE(displayName, ' ', '-')) = @slug
    `, { slug: season.slug }, true);

    // getSeasonSchedule
    await runIfMissing(`getSeasonSchedule-${sid}`, `
      SELECT scheduleID, seasonID, week, matchDate,
        team1ID, team2ID
      FROM schedule WHERE seasonID = @seasonID ORDER BY week, scheduleID
    `, { seasonID: sid }, true);

    // getSeasonMatchResults
    await runIfMissing(`getSeasonMatchResults-${sid}`, `
      SELECT sch.week,
        sch.team1ID AS homeTeamID, sch.team2ID AS awayTeamID,
        mr.team1Game1, mr.team1Game2, mr.team1Game3, mr.team1Series,
        mr.team2Game1, mr.team2Game2, mr.team2Game3, mr.team2Series,
        mr.team1GamePts, mr.team2GamePts, mr.team1BonusPts, mr.team2BonusPts
      FROM matchResults mr
      JOIN schedule sch ON mr.scheduleID = sch.scheduleID
      WHERE sch.seasonID = @seasonID ORDER BY sch.week ASC
    `, { seasonID: sid }, false);

    // getSeasonWeeklyScores
    await runIfMissing(`getSeasonWeeklyScores-${sid}`, `
      SELECT sc.scoreID, sc.bowlerID, sc.seasonID, sc.week, sc.teamID,
        sc.game1, sc.game2, sc.game3, sc.scratchSeries,
        sc.isPenalty, sc.incomingAvg, sc.incomingHcp,
        sc.hcpGame1, sc.hcpGame2, sc.hcpGame3, sc.handSeries,
        b.bowlerName, b.slug AS bowlerSlug,
        COALESCE(tnh.teamName, t.teamName) AS teamName,
        t.slug AS teamSlug,
        sch.matchDate
      FROM scores sc
      JOIN bowlers b ON sc.bowlerID = b.bowlerID
      JOIN teams t ON sc.teamID = t.teamID
      LEFT JOIN teamNameHistory tnh ON tnh.seasonID = sc.seasonID AND tnh.teamID = sc.teamID
      LEFT JOIN schedule sch ON sch.seasonID = sc.seasonID AND sch.week = sc.week
        AND (sch.team1ID = sc.teamID OR sch.team2ID = sc.teamID)
      WHERE sc.seasonID = @seasonID
      ORDER BY sc.week ASC, sc.teamID ASC, sc.isPenalty ASC, b.bowlerName ASC
    `, { seasonID: sid }, false);

    // getSeasonWeekSummaries
    await runIfMissing(`getSeasonWeekSummaries-${sid}`, `
      WITH weekStats AS (
        SELECT sc.week,
          MIN(sch.matchDate) AS matchDate,
          COUNT(DISTINCT sch.scheduleID) AS matchCount,
          MAX(CASE WHEN sc.game1 >= ISNULL(sc.game2, 0) AND sc.game1 >= ISNULL(sc.game3, 0) THEN sc.game1
                   WHEN sc.game2 >= ISNULL(sc.game1, 0) AND sc.game2 >= ISNULL(sc.game3, 0) THEN sc.game2
                   ELSE sc.game3 END) AS highGame,
          MAX(sc.scratchSeries) AS highSeries,
          CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS leagueAvg,
          CAST(AVG(CAST(sc.incomingAvg AS DECIMAL(5,1))) AS DECIMAL(5,1)) AS expectedAvg
        FROM scores sc
        LEFT JOIN schedule sch ON sch.seasonID = sc.seasonID AND sch.week = sc.week
        WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
        GROUP BY sc.week
      ),
      highGameBowler AS (
        SELECT sc.week, b.bowlerName, b.slug,
          ROW_NUMBER() OVER (PARTITION BY sc.week ORDER BY
            CASE WHEN sc.game1 >= ISNULL(sc.game2, 0) AND sc.game1 >= ISNULL(sc.game3, 0) THEN sc.game1
                 WHEN sc.game2 >= ISNULL(sc.game1, 0) AND sc.game2 >= ISNULL(sc.game3, 0) THEN sc.game2
                 ELSE sc.game3 END DESC) AS rn
        FROM scores sc JOIN bowlers b ON sc.bowlerID = b.bowlerID
        WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
      ),
      highSeriesBowler AS (
        SELECT sc.week, b.bowlerName, b.slug,
          ROW_NUMBER() OVER (PARTITION BY sc.week ORDER BY sc.scratchSeries DESC) AS rn
        FROM scores sc JOIN bowlers b ON sc.bowlerID = b.bowlerID
        WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
      ),
      botwCTE AS (
        SELECT sc.week, b.bowlerName, b.slug,
          sc.scratchSeries - 3 * sc.incomingAvg AS pinsOver,
          ROW_NUMBER() OVER (PARTITION BY sc.week ORDER BY sc.scratchSeries - 3 * sc.incomingAvg DESC) AS rn
        FROM scores sc JOIN bowlers b ON sc.bowlerID = b.bowlerID
        WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
          AND sc.incomingAvg IS NOT NULL AND sc.incomingAvg > 0
          AND EXISTS (
            SELECT 1 FROM scores sc3
            WHERE sc3.bowlerID = sc.bowlerID AND sc3.isPenalty = 0
              AND (sc3.seasonID < sc.seasonID OR (sc3.seasonID = sc.seasonID AND sc3.week < sc.week))
          )
      )
      SELECT ws.week, ws.matchDate, ws.matchCount, ws.highGame,
        hg.bowlerName AS highGameBowler, hg.slug AS highGameSlug,
        ws.highSeries, hs.bowlerName AS highSeriesBowler, hs.slug AS highSeriesSlug,
        ws.leagueAvg, ws.expectedAvg,
        bw.bowlerName AS botwName, bw.slug AS botwSlug, bw.pinsOver AS botwPinsOver
      FROM weekStats ws
      LEFT JOIN highGameBowler hg ON hg.week = ws.week AND hg.rn = 1
      LEFT JOIN highSeriesBowler hs ON hs.week = ws.week AND hs.rn = 1
      LEFT JOIN botwCTE bw ON bw.week = ws.week AND bw.rn = 1
      ORDER BY ws.week ASC
    `, { seasonID: sid }, false);

    // getSeasonStandings
    await runIfMissing(`getSeasonStandings-${sid}`, `
      SELECT t.teamID, COALESCE(tnh.teamName, t.teamName) AS teamName,
        t.slug AS teamSlug,
        SUM(CASE WHEN mr.team1GamePts IS NOT NULL
          THEN CASE WHEN sch.team1ID = t.teamID THEN mr.team1GamePts ELSE mr.team2GamePts END
          ELSE 0 END) AS gamePts,
        SUM(CASE WHEN mr.team1BonusPts IS NOT NULL
          THEN CASE WHEN sch.team1ID = t.teamID THEN mr.team1BonusPts ELSE mr.team2BonusPts END
          ELSE 0 END) AS bonusPts,
        SUM(CASE WHEN mr.team1GamePts IS NOT NULL
          THEN CASE WHEN sch.team1ID = t.teamID THEN mr.team1GamePts + mr.team1BonusPts
               ELSE mr.team2GamePts + mr.team2BonusPts END
          ELSE 0 END) AS totalPts
      FROM teams t
      JOIN schedule sch ON sch.seasonID = @seasonID AND (sch.team1ID = t.teamID OR sch.team2ID = t.teamID)
      LEFT JOIN matchResults mr ON mr.scheduleID = sch.scheduleID
      LEFT JOIN teamNameHistory tnh ON tnh.seasonID = @seasonID AND tnh.teamID = t.teamID
      WHERE EXISTS (SELECT 1 FROM scores sc WHERE sc.seasonID = @seasonID AND sc.teamID = t.teamID)
      GROUP BY t.teamID, COALESCE(tnh.teamName, t.teamName), t.slug
      ORDER BY totalPts DESC, gamePts DESC
    `, { seasonID: sid }, false);
  }

  await pool.close();
  console.log(`\nDone! Filled ${filled} cache entries, skipped ${skipped} (already cached).`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
