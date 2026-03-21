/**
 * All-time career leaderboard and record progression queries.
 */
import { getDb, cachedQuery } from '../db';

// ── Game Profile types & constants ──────────────────────────────────────────

export type GameArchetype = 'Fast Starter' | 'Middle Child' | 'Late Bloomer' | 'Flatliner';

export interface GameProfileRow {
  bowlerName: string;
  slug: string;
  nights: number;
  games: number;
  avg1: number;
  avg2: number;
  avg3: number;
  overallAvg: number;
  pctSpread: number;
  bestGame: 1 | 2 | 3;
  archetype: GameArchetype;
  isActive?: boolean;
}

// Hardcoded: 10th percentile of pct-spread among 27+ game (9+ night) bowlers (as of Spring 2026).
// Recalibrate at end of season if desired.
const FLATLINER_PCT_CUTOFF = 1.6131;
const MIN_NIGHTS = 9; // 27 games / 3 games per night

export interface AllTimeLeaderRow {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  gender: string | null;
  gamesBowled: number;
  totalPins: number;
  careerAverage: number | null;
  highGame: number | null;
  highSeries: number | null;
  games200Plus: number;
  series600Plus: number;
  turkeys: number;
}

const GET_ALL_TIME_LEADERBOARD_SQL = `
  SELECT
    agg.bowlerID,
    b.bowlerName,
    b.slug,
    b.gender,
    agg.gamesBowled,
    agg.totalPins,
    agg.careerAverage,
    agg.highGame,
    agg.highSeries,
    agg.games200Plus,
    agg.series600Plus,
    agg.turkeys
  FROM (
    SELECT
      sc.bowlerID,
      COUNT(sc.scoreID) * 3                                AS gamesBowled,
      SUM(sc.scratchSeries)                                AS totalPins,
      CAST(
        SUM(sc.scratchSeries) * 1.0 /
        NULLIF(COUNT(sc.scoreID) * 3, 0)
      AS DECIMAL(5,1))                                     AS careerAverage,
      MAX(
        CASE
          WHEN sc.game1 >= sc.game2 AND sc.game1 >= sc.game3 THEN sc.game1
          WHEN sc.game2 >= sc.game3 THEN sc.game2
          ELSE sc.game3
        END
      )                                                    AS highGame,
      MAX(sc.scratchSeries)                                AS highSeries,
      SUM(
        CASE WHEN sc.game1 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN sc.game2 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN sc.game3 >= 200 THEN 1 ELSE 0 END
      )                                                    AS games200Plus,
      SUM(CASE WHEN sc.scratchSeries >= 600 THEN 1 ELSE 0 END) AS series600Plus,
      SUM(ISNULL(sc.turkeys, 0))                           AS turkeys
    FROM scores sc
    WHERE sc.isPenalty = 0
    GROUP BY sc.bowlerID
  ) agg
  JOIN bowlers b ON b.bowlerID = agg.bowlerID
  ORDER BY agg.careerAverage DESC
`;

export async function getAllTimeLeaderboard(): Promise<AllTimeLeaderRow[]> {
  return cachedQuery('getAllTimeLeaderboard', async () => {
    const db = await getDb();
    const result = await db.request().query<AllTimeLeaderRow>(GET_ALL_TIME_LEADERBOARD_SQL);
    return result.recordset;
  }, [], { sql: GET_ALL_TIME_LEADERBOARD_SQL, dependsOn: ['scores'] });
}

/* ── High Game Record Progression ───────────────────────────────── */

export interface HighGameRecord {
  score: number;
  bowlerName: string;
  slug: string;
  seasonID: number;
  week: number;
  nightNumber: number;
  displayName: string;
  romanNumeral: string;
  matchDate: string | null;
  isTied: boolean;
  isPlayoff?: boolean;
}

// Returns new records (runningMax > prevMax) and ties (bestScore = runningMax = prevMax)
const HIGH_GAME_PROGRESSION_SQL = `
  WITH allGames AS (
    SELECT sc.bowlerID, sc.seasonID, sc.week, sc.game1 AS score
    FROM scores sc WHERE sc.isPenalty = 0 AND sc.game1 IS NOT NULL
    UNION ALL
    SELECT sc.bowlerID, sc.seasonID, sc.week, sc.game2
    FROM scores sc WHERE sc.isPenalty = 0 AND sc.game2 IS NOT NULL
    UNION ALL
    SELECT sc.bowlerID, sc.seasonID, sc.week, sc.game3
    FROM scores sc WHERE sc.isPenalty = 0 AND sc.game3 IS NOT NULL
  ),
  weekBest AS (
    SELECT
      ag.seasonID, ag.week,
      MAX(ag.score) AS bestScore
    FROM allGames ag
    GROUP BY ag.seasonID, ag.week
  ),
  withRunningMax AS (
    SELECT
      wb.seasonID, wb.week, wb.bestScore,
      MAX(wb.bestScore) OVER (
        ORDER BY sn.year, CASE sn.period WHEN 'Spring' THEN 1 ELSE 2 END, wb.week
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS runningMax
    FROM weekBest wb
    JOIN seasons sn ON sn.seasonID = wb.seasonID
  ),
  withPrev AS (
    SELECT
      r.seasonID, r.week, r.bestScore, r.runningMax,
      LAG(r.runningMax) OVER (
        ORDER BY sn.year, CASE sn.period WHEN 'Spring' THEN 1 ELSE 2 END, r.week
      ) AS prevMax
    FROM withRunningMax r
    JOIN seasons sn ON sn.seasonID = r.seasonID
  ),
  -- New records
  newRecords AS (
    SELECT p.runningMax AS score, p.seasonID, p.week, 0 AS isTied
    FROM withPrev p
    WHERE p.runningMax > ISNULL(p.prevMax, 0)
  ),
  -- Later-week ties: someone matched the standing record in a different week
  laterTies AS (
    SELECT p.runningMax AS score, p.seasonID, p.week, 1 AS isTied
    FROM withPrev p
    WHERE p.bestScore = p.runningMax AND p.runningMax = p.prevMax
  ),
  combined AS (
    SELECT * FROM newRecords
    UNION ALL
    SELECT * FROM laterTies
  )
  SELECT
    c.score,
    b.bowlerName,
    b.slug,
    c.seasonID,
    c.week,
    sch.nightNumber,
    sn.displayName,
    sn.romanNumeral,
    sch.matchDate,
    c.isTied
  FROM combined c
  JOIN seasons sn ON sn.seasonID = c.seasonID
  LEFT JOIN (
    SELECT seasonID, week, MIN(matchDate) AS matchDate, MIN(nightNumber) AS nightNumber
    FROM schedule
    GROUP BY seasonID, week
  ) sch ON sch.seasonID = c.seasonID AND sch.week = c.week
  CROSS APPLY (
    SELECT TOP 1 ag.bowlerID
    FROM allGames ag
    WHERE ag.seasonID = c.seasonID AND ag.week = c.week AND ag.score = c.score
    ORDER BY ag.bowlerID
  ) topBowler
  JOIN bowlers b ON b.bowlerID = topBowler.bowlerID
  ORDER BY sn.year, CASE sn.period WHEN 'Spring' THEN 1 ELSE 2 END, c.week, c.isTied
`;

// Same-week ties: another bowler hit the same score in the record-setting week
const SAME_WEEK_TIES_SQL = `
  WITH allGames AS (
    SELECT sc.bowlerID, sc.seasonID, sc.week, sc.game1 AS score
    FROM scores sc WHERE sc.isPenalty = 0 AND sc.game1 IS NOT NULL
    UNION ALL
    SELECT sc.bowlerID, sc.seasonID, sc.week, sc.game2
    FROM scores sc WHERE sc.isPenalty = 0 AND sc.game2 IS NOT NULL
    UNION ALL
    SELECT sc.bowlerID, sc.seasonID, sc.week, sc.game3
    FROM scores sc WHERE sc.isPenalty = 0 AND sc.game3 IS NOT NULL
  ),
  weekBest AS (
    SELECT ag.seasonID, ag.week, MAX(ag.score) AS bestScore
    FROM allGames ag GROUP BY ag.seasonID, ag.week
  ),
  withRunningMax AS (
    SELECT wb.seasonID, wb.week, wb.bestScore,
      MAX(wb.bestScore) OVER (
        ORDER BY sn.year, CASE sn.period WHEN 'Spring' THEN 1 ELSE 2 END, wb.week
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS runningMax
    FROM weekBest wb JOIN seasons sn ON sn.seasonID = wb.seasonID
  ),
  withPrev AS (
    SELECT r.seasonID, r.week, r.bestScore, r.runningMax,
      LAG(r.runningMax) OVER (
        ORDER BY sn.year, CASE sn.period WHEN 'Spring' THEN 1 ELSE 2 END, r.week
      ) AS prevMax
    FROM withRunningMax r JOIN seasons sn ON sn.seasonID = r.seasonID
  ),
  recordWeeks AS (
    SELECT p.seasonID, p.week, p.runningMax AS score
    FROM withPrev p
    WHERE p.runningMax > ISNULL(p.prevMax, 0)
  )
  SELECT rw.score, rw.seasonID, rw.week, b.bowlerName, b.slug
  FROM recordWeeks rw
  CROSS APPLY (
    SELECT DISTINCT ag.bowlerID
    FROM allGames ag
    WHERE ag.seasonID = rw.seasonID AND ag.week = rw.week AND ag.score = rw.score
  ) allHitters
  JOIN bowlers b ON b.bowlerID = allHitters.bowlerID
  -- Exclude the "primary" record holder (lowest bowlerID, same as main query picks)
  WHERE allHitters.bowlerID != (
    SELECT TOP 1 ag2.bowlerID FROM allGames ag2
    WHERE ag2.seasonID = rw.seasonID AND ag2.week = rw.week AND ag2.score = rw.score
    ORDER BY ag2.bowlerID
  )
  ORDER BY rw.seasonID, rw.week
`;

export interface HighGameProgressionResult {
  records: HighGameRecord[];
  latestNight: number;
}

export async function getHighGameProgression(): Promise<HighGameProgressionResult> {
  return cachedQuery('getHighGameProgression', async () => {
    const db = await getDb();

    // Main records + later-week ties
    const result = await db.request().query<Omit<HighGameRecord, 'isTied'> & { isTied: number }>(
      HIGH_GAME_PROGRESSION_SQL,
    );

    // Same-week ties (different bowler, same week, same score)
    const sameWeekResult = await db.request().query<{
      score: number; seasonID: number; week: number; bowlerName: string; slug: string;
    }>(SAME_WEEK_TIES_SQL);

    // Build a lookup of schedule info from the main results
    const scheduleInfo = new Map<string, { nightNumber: number; displayName: string; romanNumeral: string; matchDate: string | null }>();
    for (const row of result.recordset) {
      const key = `${row.seasonID}-${row.week}`;
      if (!scheduleInfo.has(key)) {
        scheduleInfo.set(key, {
          nightNumber: row.nightNumber,
          displayName: row.displayName,
          romanNumeral: row.romanNumeral,
          matchDate: row.matchDate ? new Date(row.matchDate).toISOString() : null,
        });
      }
    }

    // Deduplicate main results
    const seen = new Set<string>();
    const records: HighGameRecord[] = [];
    for (const row of result.recordset) {
      const key = `${row.seasonID}-${row.week}-${row.score}-${row.slug}`;
      if (!seen.has(key)) {
        seen.add(key);
        records.push({
          ...row,
          isTied: !!row.isTied,
          matchDate: row.matchDate ? new Date(row.matchDate).toISOString() : null,
        });
      }
    }

    // Inject same-week ties right after the record they tied
    for (const tie of sameWeekResult.recordset) {
      const info = scheduleInfo.get(`${tie.seasonID}-${tie.week}`);
      if (!info) continue;
      // Find the index of the record this ties
      const idx = records.findIndex(
        (r) => r.seasonID === tie.seasonID && r.week === tie.week && r.score === tie.score && !r.isTied,
      );
      if (idx === -1) continue;
      records.splice(idx + 1, 0, {
        score: tie.score,
        bowlerName: tie.bowlerName,
        slug: tie.slug,
        seasonID: tie.seasonID,
        week: tie.week,
        nightNumber: info.nightNumber,
        displayName: info.displayName,
        romanNumeral: info.romanNumeral,
        matchDate: info.matchDate,
        isTied: true,
      });
    }

    // Geoffrey Berry's playoff 300 (Fall 2022 Playoffs) - not in scores table
    // but confirmed and displayed as easter egg on his bowler page.
    // Playoffs were after night 253 (last regular season night of Fall 2022).
    const depasqualeIdx = records.findIndex(
      (r) => r.score === 300 && !r.isTied,
    );
    if (depasqualeIdx !== -1) {
      records.splice(depasqualeIdx + 1, 0, {
        score: 300,
        bowlerName: 'Geoffrey Berry',
        slug: 'geoffrey-berry',
        seasonID: 28,
        week: 0,
        nightNumber: 254,
        displayName: 'Fall 2022',
        romanNumeral: 'XXVIII',
        matchDate: '2022-11-14T05:00:00.000Z',
        isTied: true,
        isPlayoff: true,
      });
    }

    const latestResult = await db.request().query<{ maxNight: number }>(
      `SELECT MAX(nightNumber) AS maxNight FROM schedule WHERE matchDate <= GETDATE()`,
    );
    const latestNight = latestResult.recordset[0]?.maxNight || records[records.length - 1]?.nightNumber || 1;
    return { records, latestNight };
  }, [], { sql: HIGH_GAME_PROGRESSION_SQL + SAME_WEEK_TIES_SQL, dependsOn: ['scores'] });
}

// ── Game Profiles (Fast Starter / Middle Child / Late Bloomer / Flatliner) ──

function classifyArchetype(avg1: number, avg2: number, avg3: number, pctSpread: number): { bestGame: 1 | 2 | 3; archetype: GameArchetype } {
  const avgs = [avg1, avg2, avg3] as const;
  const maxIdx = avgs.indexOf(Math.max(...avgs));
  const bestGame = (maxIdx + 1) as 1 | 2 | 3;

  if (pctSpread <= FLATLINER_PCT_CUTOFF) {
    return { bestGame, archetype: 'Flatliner' };
  }

  const archetypes: GameArchetype[] = ['Fast Starter', 'Middle Child', 'Late Bloomer'];
  return { bestGame, archetype: archetypes[maxIdx] };
}

const GAME_PROFILES_SQL = `
  SELECT b.bowlerName, b.slug, b.isActive,
    COUNT(*) AS games,
    AVG(CAST(s.game1 AS FLOAT)) AS avg1,
    AVG(CAST(s.game2 AS FLOAT)) AS avg2,
    AVG(CAST(s.game3 AS FLOAT)) AS avg3
  FROM scores s
  JOIN bowlers b ON b.bowlerID = s.bowlerID
  WHERE s.isPenalty = 0
    AND s.game1 IS NOT NULL
    AND s.game2 IS NOT NULL
    AND s.game3 IS NOT NULL
  GROUP BY b.bowlerName, b.bowlerID, b.slug, b.isActive
`;

export interface GameProfilesResult {
  all: GameProfileRow[];
  leaderboard: GameProfileRow[];  // 27+ games only, for ranked lists
}

export async function getGameProfiles(): Promise<GameProfilesResult> {
  return cachedQuery('getGameProfiles', async () => {
    const db = await getDb();
    const result = await db.request().query<{
      bowlerName: string; slug: string; isActive: boolean | null; games: number;
      avg1: number; avg2: number; avg3: number;
    }>(GAME_PROFILES_SQL);

    const all: GameProfileRow[] = result.recordset.map(r => {
      const overallAvg = (r.avg1 + r.avg2 + r.avg3) / 3;
      const spread = Math.max(r.avg1, r.avg2, r.avg3) - Math.min(r.avg1, r.avg2, r.avg3);
      const pctSpread = overallAvg > 0 ? (spread / overallAvg) * 100 : 0;
      const { bestGame, archetype } = classifyArchetype(r.avg1, r.avg2, r.avg3, pctSpread);
      return {
        bowlerName: r.bowlerName,
        slug: r.slug,
        nights: r.games,
        games: r.games * 3,
        avg1: r.avg1,
        avg2: r.avg2,
        avg3: r.avg3,
        overallAvg,
        pctSpread,
        bestGame,
        archetype,
        isActive: !!r.isActive,
      };
    });

    const leaderboard = all.filter(b => b.nights >= MIN_NIGHTS && b.isActive);

    return { all, leaderboard };
  }, { all: [], leaderboard: [] }, { sql: GAME_PROFILES_SQL, dependsOn: ['scores'] });
}

export async function getBowlerGameProfile(slug: string): Promise<GameProfileRow | null> {
  const { all } = await getGameProfiles();
  return all.find(b => b.slug === slug) ?? null;
}

export interface LeagueGameAvgs {
  avg1: number;
  avg2: number;
  avg3: number;
}

const LEAGUE_GAME_AVGS_SQL = `
  SELECT
    AVG(CAST(game1 AS FLOAT)) AS avg1,
    AVG(CAST(game2 AS FLOAT)) AS avg2,
    AVG(CAST(game3 AS FLOAT)) AS avg3
  FROM scores
  WHERE isPenalty = 0 AND game1 IS NOT NULL AND game2 IS NOT NULL AND game3 IS NOT NULL
`;

export async function getLeagueGameAvgs(): Promise<LeagueGameAvgs> {
  return cachedQuery('getLeagueGameAvgs', async () => {
    const db = await getDb();
    const result = await db.request().query<LeagueGameAvgs>(LEAGUE_GAME_AVGS_SQL);
    return result.recordset[0];
  }, { avg1: 0, avg2: 0, avg3: 0 }, { sql: LEAGUE_GAME_AVGS_SQL, dependsOn: ['scores'] });
}
