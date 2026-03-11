/**
 * Blog stat block queries: top performers, milestones, match results, standings, leaderboards.
 * All queries take seasonID + week and return data for blog recap components.
 */
import { getDb, cachedQuery } from '../db';
import type { SeasonLeaderEntry } from './seasons';

// ── Helpers ─────────────────────────────────────────────────

/**
 * Resolve a roman numeral season string (e.g., "XXXV") to a seasonID.
 */
export async function getSeasonIDByRoman(roman: string): Promise<number | null> {
  const SQL = `SELECT seasonID FROM seasons WHERE romanNumeral = @roman`;
  return cachedQuery(`getSeasonIDByRoman-${roman}`, async () => {
    const db = await getDb();
    const result = await db.request()
      .input('roman', roman)
      .query<{ seasonID: number }>(SQL);
    return result.recordset[0]?.seasonID ?? null;
  }, null, { stable: true, sql: SQL + roman });
}

// ── Top Performers ──────────────────────────────────────────

export interface TopPerformer {
  bowlerName: string;
  slug: string;
  gender: string;
  value: number;
}

const TOP_SCRATCH_SERIES_SQL = `
  SELECT TOP 5
    b.bowlerName, b.slug, b.gender,
    sc.scratchSeries AS value
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = @seasonID AND sc.week = @week AND sc.isPenalty = 0
  ORDER BY sc.scratchSeries DESC
`;

const TOP_SCRATCH_GAME_SQL = `
  SELECT TOP 5
    b.bowlerName, b.slug, b.gender,
    g.value
  FROM (
    SELECT bowlerID, game1 AS value FROM scores WHERE seasonID = @seasonID AND week = @week AND isPenalty = 0
    UNION ALL
    SELECT bowlerID, game2 FROM scores WHERE seasonID = @seasonID AND week = @week AND isPenalty = 0
    UNION ALL
    SELECT bowlerID, game3 FROM scores WHERE seasonID = @seasonID AND week = @week AND isPenalty = 0
  ) g
  JOIN bowlers b ON g.bowlerID = b.bowlerID
  WHERE g.value IS NOT NULL
  ORDER BY g.value DESC
`;

const TOP_HCP_SERIES_SQL = `
  SELECT TOP 5
    b.bowlerName, b.slug, b.gender,
    sc.handSeries AS value
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = @seasonID AND sc.week = @week AND sc.isPenalty = 0
  ORDER BY sc.handSeries DESC
`;

interface TopPerformersResult {
  scratchSeries: TopPerformer[];
  scratchGame: TopPerformer[];
  hcpSeries: TopPerformer[];
}

export async function getTopPerformers(seasonID: number, week: number): Promise<TopPerformersResult> {
  const params = JSON.stringify({ seasonID, week });
  const allSQL = TOP_SCRATCH_SERIES_SQL + TOP_SCRATCH_GAME_SQL + TOP_HCP_SERIES_SQL;

  return cachedQuery<TopPerformersResult>('getTopPerformers', async () => {
    const db = await getDb();

    const [seriesRes, gameRes, hcpRes] = await Promise.all([
      db.request().input('seasonID', seasonID).input('week', week)
        .query<TopPerformer>(TOP_SCRATCH_SERIES_SQL),
      db.request().input('seasonID', seasonID).input('week', week)
        .query<TopPerformer>(TOP_SCRATCH_GAME_SQL),
      db.request().input('seasonID', seasonID).input('week', week)
        .query<TopPerformer>(TOP_HCP_SERIES_SQL),
    ]);

    return {
      scratchSeries: [...seriesRes.recordset],
      scratchGame: [...gameRes.recordset],
      hcpSeries: [...hcpRes.recordset],
    };
  }, { scratchSeries: [], scratchGame: [], hcpSeries: [] }, { sql: allSQL + params });
}

// ── Week Milestones ─────────────────────────────────────────

export interface WeekMilestone {
  bowlerName: string;
  slug: string;
  achievement: string;
  value: number;
}

const CAREER_HIGH_SERIES_SQL = `
  SELECT
    b.bowlerName, b.slug,
    sc.scratchSeries AS thisWeekSeries,
    (SELECT MAX(sp.scratchSeries) FROM scores sp
     WHERE sp.bowlerID = sc.bowlerID AND sp.isPenalty = 0
       AND (sp.seasonID < sc.seasonID OR (sp.seasonID = sc.seasonID AND sp.week < sc.week))
    ) AS priorBestSeries
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = @seasonID AND sc.week = @week AND sc.isPenalty = 0
`;

const CAREER_HIGH_GAME_SQL = `
  SELECT
    b.bowlerName, b.slug,
    (SELECT MAX(x.val) FROM (VALUES (sc.game1),(sc.game2),(sc.game3)) AS x(val)) AS thisWeekBestGame,
    (SELECT MAX(x.val) FROM scores sp
      CROSS APPLY (VALUES (sp.game1),(sp.game2),(sp.game3)) AS x(val)
      WHERE sp.bowlerID = sc.bowlerID AND sp.isPenalty = 0
        AND (sp.seasonID < sc.seasonID OR (sp.seasonID = sc.seasonID AND sp.week < sc.week))
    ) AS priorBestGame
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = @seasonID AND sc.week = @week AND sc.isPenalty = 0
`;

const FIRST_200_GAME_SQL = `
  SELECT
    b.bowlerName, b.slug,
    (SELECT MAX(x.val) FROM (VALUES (sc.game1),(sc.game2),(sc.game3)) AS x(val)) AS bestGame
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = @seasonID AND sc.week = @week AND sc.isPenalty = 0
    AND (sc.game1 >= 200 OR sc.game2 >= 200 OR sc.game3 >= 200)
    AND NOT EXISTS (
      SELECT 1 FROM scores sp
      WHERE sp.bowlerID = sc.bowlerID AND sp.isPenalty = 0
        AND (sp.seasonID < sc.seasonID OR (sp.seasonID = sc.seasonID AND sp.week < sc.week))
        AND (sp.game1 >= 200 OR sp.game2 >= 200 OR sp.game3 >= 200)
    )
`;

const FIRST_600_SERIES_SQL = `
  SELECT
    b.bowlerName, b.slug,
    sc.scratchSeries AS series
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = @seasonID AND sc.week = @week AND sc.isPenalty = 0
    AND sc.scratchSeries >= 600
    AND NOT EXISTS (
      SELECT 1 FROM scores sp
      WHERE sp.bowlerID = sc.bowlerID AND sp.isPenalty = 0
        AND (sp.seasonID < sc.seasonID OR (sp.seasonID = sc.seasonID AND sp.week < sc.week))
        AND sp.scratchSeries >= 600
    )
`;

export async function getWeekMilestones(seasonID: number, week: number): Promise<WeekMilestone[]> {
  const params = JSON.stringify({ seasonID, week });
  const allSQL = CAREER_HIGH_SERIES_SQL + CAREER_HIGH_GAME_SQL + FIRST_200_GAME_SQL + FIRST_600_SERIES_SQL;

  return cachedQuery('getWeekMilestones', async () => {
    const db = await getDb();
    const milestones: WeekMilestone[] = [];

    // Career-high series
    const seriesRes = await db.request()
      .input('seasonID', seasonID).input('week', week)
      .query<{ bowlerName: string; slug: string; thisWeekSeries: number; priorBestSeries: number | null }>(
        CAREER_HIGH_SERIES_SQL
      );
    for (const row of seriesRes.recordset) {
      if (row.priorBestSeries !== null && row.thisWeekSeries > row.priorBestSeries) {
        milestones.push({
          bowlerName: row.bowlerName,
          slug: row.slug,
          achievement: `New career-high series: ${row.thisWeekSeries} (prev: ${row.priorBestSeries})`,
          value: row.thisWeekSeries,
        });
      }
    }

    // Career-high game
    const gameRes = await db.request()
      .input('seasonID', seasonID).input('week', week)
      .query<{ bowlerName: string; slug: string; thisWeekBestGame: number; priorBestGame: number | null }>(
        CAREER_HIGH_GAME_SQL
      );
    for (const row of gameRes.recordset) {
      if (row.priorBestGame !== null && row.thisWeekBestGame > row.priorBestGame) {
        milestones.push({
          bowlerName: row.bowlerName,
          slug: row.slug,
          achievement: `New career-high game: ${row.thisWeekBestGame} (prev: ${row.priorBestGame})`,
          value: row.thisWeekBestGame,
        });
      }
    }

    // First 200+ game
    const first200Res = await db.request()
      .input('seasonID', seasonID).input('week', week)
      .query<{ bowlerName: string; slug: string; bestGame: number }>(FIRST_200_GAME_SQL);
    for (const row of first200Res.recordset) {
      milestones.push({
        bowlerName: row.bowlerName,
        slug: row.slug,
        achievement: `First career 200+ game: ${row.bestGame}`,
        value: row.bestGame,
      });
    }

    // First 600+ series
    const first600Res = await db.request()
      .input('seasonID', seasonID).input('week', week)
      .query<{ bowlerName: string; slug: string; series: number }>(FIRST_600_SERIES_SQL);
    for (const row of first600Res.recordset) {
      milestones.push({
        bowlerName: row.bowlerName,
        slug: row.slug,
        achievement: `First career 600+ series: ${row.series}`,
        value: row.series,
      });
    }

    return milestones;
  }, [], { sql: allSQL + params });
}

// ── Match Results Summary ───────────────────────────────────

export interface MatchResultRow {
  team1Name: string;
  team1Slug: string;
  team2Name: string;
  team2Slug: string;
  team1Series: number;
  team2Series: number;
  team1GamePts: number;
  team2GamePts: number;
  team1BonusPts: number;
  team2BonusPts: number;
  team1TotalPts: number;
  team2TotalPts: number;
}

const MATCH_RESULTS_SQL = `
  SELECT
    COALESCE(tnh1.alternateName, t1.teamName) AS team1Name,
    t1.slug AS team1Slug,
    COALESCE(tnh2.alternateName, t2.teamName) AS team2Name,
    t2.slug AS team2Slug,
    mr.team1Series,
    mr.team2Series,
    mr.team1GamePts,
    mr.team2GamePts,
    mr.team1BonusPts,
    mr.team2BonusPts,
    (mr.team1GamePts + mr.team1BonusPts) AS team1TotalPts,
    (mr.team2GamePts + mr.team2BonusPts) AS team2TotalPts
  FROM matchResults mr
  JOIN schedule sch ON mr.scheduleID = sch.scheduleID
  JOIN teams t1 ON sch.team1ID = t1.teamID
  JOIN teams t2 ON sch.team2ID = t2.teamID
  LEFT JOIN (
    SELECT teamID, teamName AS alternateName
    FROM teamNameHistory
    WHERE id IN (SELECT MAX(id) FROM teamNameHistory WHERE teamID IN (
      SELECT team1ID FROM schedule WHERE seasonID = @seasonID AND week = @week
      UNION SELECT team2ID FROM schedule WHERE seasonID = @seasonID AND week = @week
    ) GROUP BY teamID)
  ) tnh1 ON tnh1.teamID = t1.teamID
  LEFT JOIN (
    SELECT teamID, teamName AS alternateName
    FROM teamNameHistory
    WHERE id IN (SELECT MAX(id) FROM teamNameHistory WHERE teamID IN (
      SELECT team1ID FROM schedule WHERE seasonID = @seasonID AND week = @week
      UNION SELECT team2ID FROM schedule WHERE seasonID = @seasonID AND week = @week
    ) GROUP BY teamID)
  ) tnh2 ON tnh2.teamID = t2.teamID
  WHERE sch.seasonID = @seasonID AND sch.week = @week
  ORDER BY sch.matchNumber
`;

export async function getMatchResultsSummary(seasonID: number, week: number): Promise<MatchResultRow[]> {
  const params = JSON.stringify({ seasonID, week });
  return cachedQuery('getMatchResultsSummary', async () => {
    const db = await getDb();
    const result = await db.request()
      .input('seasonID', seasonID).input('week', week)
      .query<MatchResultRow>(MATCH_RESULTS_SQL);
    return result.recordset;
  }, [], { sql: MATCH_RESULTS_SQL + params });
}

// ── Standings Snapshot ──────────────────────────────────────

export interface StandingsRow {
  teamName: string;
  teamSlug: string;
  totalPts: number;
  rank: number;
  prevRank: number | null;
}

const STANDINGS_SNAPSHOT_SQL = `
  WITH teamPtsUnpivot AS (
    SELECT sch.team1ID AS teamID,
           mr.team1GamePts AS gamePts,
           mr.team1BonusPts AS bonusPts,
           sch.week
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.seasonID = @seasonID
    UNION ALL
    SELECT sch.team2ID AS teamID,
           mr.team2GamePts AS gamePts,
           mr.team2BonusPts AS bonusPts,
           sch.week
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.seasonID = @seasonID
  ),
  currentPts AS (
    SELECT teamID, SUM(gamePts) + SUM(bonusPts) AS totalPts
    FROM teamPtsUnpivot
    WHERE week <= @week
    GROUP BY teamID
  ),
  prevPts AS (
    SELECT teamID, SUM(gamePts) + SUM(bonusPts) AS totalPts
    FROM teamPtsUnpivot
    WHERE week <= @week - 1
    GROUP BY teamID
  ),
  currentRanked AS (
    SELECT teamID, totalPts,
      CAST(RANK() OVER (ORDER BY totalPts DESC) AS INT) AS rank
    FROM currentPts
  ),
  prevRanked AS (
    SELECT teamID,
      CAST(RANK() OVER (ORDER BY totalPts DESC) AS INT) AS rank
    FROM prevPts
  )
  SELECT
    COALESCE(tnh.alternateName, t.teamName) AS teamName,
    t.slug AS teamSlug,
    cr.totalPts,
    cr.rank,
    pr.rank AS prevRank
  FROM currentRanked cr
  JOIN teams t ON cr.teamID = t.teamID
  LEFT JOIN prevRanked pr ON pr.teamID = cr.teamID
  LEFT JOIN (
    SELECT teamID, teamName AS alternateName
    FROM teamNameHistory
    WHERE id IN (SELECT MAX(id) FROM teamNameHistory GROUP BY teamID)
  ) tnh ON tnh.teamID = cr.teamID
  ORDER BY cr.rank
`;

export async function getStandingsSnapshot(seasonID: number, week: number): Promise<StandingsRow[]> {
  const params = JSON.stringify({ seasonID, week });
  return cachedQuery('getStandingsSnapshot', async () => {
    const db = await getDb();
    const result = await db.request()
      .input('seasonID', seasonID).input('week', week)
      .query<StandingsRow>(STANDINGS_SNAPSHOT_SQL);
    return result.recordset;
  }, [], { sql: STANDINGS_SNAPSHOT_SQL + params });
}

// ── Leaderboard Snapshot (through week N) ───────────────────

export type LeaderboardCategory = 'avg' | 'highSeries' | 'hcpAvg';

/**
 * Season leaderboard filtered to scores through a given week.
 * Returns top 10 for a category/gender combination — a snapshot in time.
 */
export async function getLeaderboardSnapshot(
  seasonID: number,
  week: number,
  gender: 'M' | 'F' | null,
  category: LeaderboardCategory,
  limit = 10,
): Promise<SeasonLeaderEntry[]> {
  const genderFilter = gender !== null ? 'AND b.gender = @gender' : '';
  const minNights = 3;

  let selectExpr: string;
  let havingClause = '';

  switch (category) {
    case 'avg':
      selectExpr = `CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1))`;
      havingClause = `HAVING COUNT(sc.scoreID) >= ${minNights}`;
      break;
    case 'highSeries':
      selectExpr = `MAX(sc.scratchSeries)`;
      break;
    case 'hcpAvg':
      selectExpr = `CAST(SUM(sc.handSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1))`;
      havingClause = `HAVING COUNT(sc.scoreID) >= ${minNights}`;
      break;
  }

  const sql = `
    SELECT TOP ${limit}
      agg.bowlerID,
      b.bowlerName,
      b.slug,
      COALESCE(tnh.teamName, t.teamName) AS teamName,
      t.slug AS teamSlug,
      agg.value,
      ROW_NUMBER() OVER (ORDER BY agg.value DESC) AS rank
    FROM (
      SELECT sc.bowlerID,
        ${selectExpr} AS value
      FROM scores sc
      JOIN bowlers b ON sc.bowlerID = b.bowlerID
      WHERE sc.seasonID = @seasonID
        AND sc.week <= @week
        AND sc.isPenalty = 0
        ${genderFilter}
      GROUP BY sc.bowlerID
      ${havingClause}
    ) agg
    JOIN bowlers b ON b.bowlerID = agg.bowlerID
    CROSS APPLY (
      SELECT TOP 1 sc2.teamID
      FROM scores sc2
      WHERE sc2.bowlerID = agg.bowlerID AND sc2.seasonID = @seasonID AND sc2.week <= @week AND sc2.isPenalty = 0
      GROUP BY sc2.teamID
      ORDER BY COUNT(*) DESC
    ) pt
    LEFT JOIN teams t ON t.teamID = pt.teamID
    LEFT JOIN teamNameHistory tnh
      ON  tnh.seasonID = @seasonID
      AND tnh.teamID   = pt.teamID
    ORDER BY agg.value DESC
  `;

  const params = JSON.stringify({ seasonID, week, gender, category, limit });
  return cachedQuery(`getLeaderboardSnapshot`, async () => {
    const db = await getDb();
    const request = db.request()
      .input('seasonID', seasonID)
      .input('week', week);
    if (gender !== null) request.input('gender', gender);
    const result = await request.query<SeasonLeaderEntry>(sql);
    return result.recordset;
  }, [], { sql: sql + params });
}
