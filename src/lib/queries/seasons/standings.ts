/**
 * Season standings, leaderboards, full stats, and race chart queries.
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../../db';

export interface StandingsRow {
  teamID: number;
  teamName: string;
  teamSlug: string;
  divisionName: string | null;
  wins: number;
  xp: number;
  totalPts: number;
  lastWeekPts: number | null;
  teamScratchAvg: number | null;
  scratchAvgRank: number;
  teamHcpAvg: number | null;
  hcpAvgRank: number;
}

interface HeadToHeadResult {
  team1ID: number;
  team2ID: number;
  team1Pts: number;
  team2Pts: number;
}

export interface SeasonLeaderEntry {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  teamName: string | null;
  teamSlug: string | null;
  value: number;
  rank: number;
}

export interface SeasonFullStatsRow {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  gender: string | null;
  teamName: string | null;
  teamSlug: string | null;
  gamesBowled: number;
  totalPins: number;
  scratchAvg: number | null;
  hcpAvg: number | null;
  highGame: number | null;
  highSeries: number | null;
  games200Plus: number;
  series600Plus: number;
  turkeys: number;
}

export interface RaceChartRow {
  week: number;
  teamID: number;
  teamName: string;
  totalPts: number;
}

const GET_SEASON_STANDINGS_SQL = `
  WITH teamAvgs AS (
    SELECT
      sc.teamID,
      CAST(
        SUM(sc.scratchSeries) * 1.0 /
        NULLIF(COUNT(sc.scoreID) * 3, 0)
      AS DECIMAL(5,1))                     AS teamScratchAvg,
      CAST(
        SUM(sc.handSeries) * 1.0 /
        NULLIF(COUNT(sc.scoreID) * 3, 0)
      AS DECIMAL(5,1))                     AS teamHcpAvg
    FROM scores sc
    WHERE sc.seasonID = @seasonID
      AND sc.isPenalty = 0
      AND sc.teamID IS NOT NULL
    GROUP BY sc.teamID
  ),
  teamPtsUnpivot AS (
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
  teamWinsXP AS (
    SELECT
      teamID,
      SUM(gamePts)  AS wins,
      SUM(bonusPts) AS xp
    FROM teamPtsUnpivot
    GROUP BY teamID
  ),
  maxWeek AS (
    SELECT MAX(week) AS lastWeek FROM teamPtsUnpivot
  ),
  lastWeekPts AS (
    SELECT
      tp.teamID,
      SUM(tp.gamePts) + SUM(tp.bonusPts) AS pts
    FROM teamPtsUnpivot tp
    CROSS JOIN maxWeek mw
    WHERE tp.week = mw.lastWeek
    GROUP BY tp.teamID
  )
  SELECT
    t.teamID,
    COALESCE(tnh.teamName, t.teamName)     AS teamName,
    t.slug                                  AS teamSlug,
    sd.divisionName,
    ISNULL(wx.wins, 0)                      AS wins,
    ISNULL(wx.xp, 0)                        AS xp,
    ISNULL(wx.wins, 0) + ISNULL(wx.xp, 0)  AS totalPts,
    lw.pts                                   AS lastWeekPts,
    ta.teamScratchAvg,
    CAST(RANK() OVER (ORDER BY ta.teamScratchAvg DESC) AS INT) AS scratchAvgRank,
    ta.teamHcpAvg,
    CAST(RANK() OVER (ORDER BY ta.teamHcpAvg DESC) AS INT)     AS hcpAvgRank
  FROM teamAvgs ta
  JOIN teams t ON ta.teamID = t.teamID
  LEFT JOIN teamWinsXP wx ON wx.teamID = ta.teamID
  LEFT JOIN lastWeekPts lw ON lw.teamID = ta.teamID
  LEFT JOIN seasonDivisions sd
    ON  sd.seasonID = @seasonID
    AND sd.teamID   = ta.teamID
  LEFT JOIN teamNameHistory tnh
    ON  tnh.seasonID = @seasonID
    AND tnh.teamID   = ta.teamID
  ORDER BY sd.divisionName, totalPts DESC, wins DESC, ta.teamScratchAvg DESC
`;

const GET_HEAD_TO_HEAD_SQL = `
  SELECT sch.team1ID, sch.team2ID,
         mr.team1GamePts + mr.team1BonusPts AS team1Pts,
         mr.team2GamePts + mr.team2BonusPts AS team2Pts
  FROM matchResults mr
  JOIN schedule sch ON mr.scheduleID = sch.scheduleID
  WHERE sch.seasonID = @seasonID
`;

/**
 * Resolve two-way ties within each division using head-to-head game points.
 * Only applies to exact 2-way ties on totalPts. 3+ way ties or ties with
 * no h2h data keep the existing sort (wins DESC, scratchAvg DESC).
 */
function resolveH2HTiebreakers(
  standings: StandingsRow[],
  h2hResults: HeadToHeadResult[]
): StandingsRow[] {
  // Build lookup: "loID-hiID" → net game pts for the lower-ID team
  const h2hMap = new Map<string, number>();
  for (const r of h2hResults) {
    const [lo, hi] = r.team1ID < r.team2ID
      ? [r.team1ID, r.team2ID]
      : [r.team2ID, r.team1ID];
    const key = `${lo}-${hi}`;
    const netForLo = r.team1ID < r.team2ID
      ? r.team1Pts - r.team2Pts
      : r.team2Pts - r.team1Pts;
    h2hMap.set(key, (h2hMap.get(key) ?? 0) + netForLo);
  }

  // Group by division (preserving original order)
  const divisions = new Map<string, StandingsRow[]>();
  for (const row of standings) {
    const div = row.divisionName ?? '__none__';
    if (!divisions.has(div)) divisions.set(div, []);
    divisions.get(div)!.push(row);
  }

  const result: StandingsRow[] = [];
  for (const rows of divisions.values()) {
    // Split into tiers of equal totalPts
    let i = 0;
    while (i < rows.length) {
      let j = i + 1;
      while (j < rows.length && rows[j].totalPts === rows[i].totalPts) j++;
      const tier = rows.slice(i, j);

      if (tier.length === 2) {
        // Two-way tie: check h2h
        const [a, b] = tier;
        const [lo, hi] = a.teamID < b.teamID
          ? [a.teamID, b.teamID]
          : [b.teamID, a.teamID];
        const key = `${lo}-${hi}`;
        const netForLo = h2hMap.get(key) ?? 0;
        const netForA = a.teamID < b.teamID ? netForLo : -netForLo;

        if (netForA > 0) {
          result.push(a, b);
        } else if (netForA < 0) {
          result.push(b, a);
        } else {
          // H2H also tied, keep existing order (wins, scratchAvg)
          result.push(a, b);
        }
      } else {
        // Single team or 3+ way tie: keep existing SQL order
        result.push(...tier);
      }

      i = j;
    }
  }

  return result;
}

export async function getSeasonStandings(seasonID: number): Promise<StandingsRow[]> {
  return cachedQuery(`getSeasonStandings-${seasonID}`, async () => {
    const db = await getDb();
    const standingsResult = await db
      .request()
      .input('seasonID', seasonID)
      .query<StandingsRow>(GET_SEASON_STANDINGS_SQL);
    const h2hResult = await db
      .request()
      .input('seasonID', seasonID)
      .query<HeadToHeadResult>(GET_HEAD_TO_HEAD_SQL);
    return resolveH2HTiebreakers(standingsResult.recordset, h2hResult.recordset);
  }, [], { sql: GET_SEASON_STANDINGS_SQL + GET_HEAD_TO_HEAD_SQL, seasonID });
}

const GET_PLAYOFF_TEAM_IDS_SQL = `
  SELECT DISTINCT teamID FROM (
    SELECT team1ID AS teamID FROM playoffResults WHERE seasonID = @seasonID
    UNION
    SELECT team2ID AS teamID FROM playoffResults WHERE seasonID = @seasonID
  ) t
`;

export const getPlayoffTeamIDs = cache(async (seasonID: number): Promise<Set<number> | null> => {
  const ids = await cachedQuery(`getPlayoffTeamIDs-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('seasonID', seasonID)
      .query<{ teamID: number }>(GET_PLAYOFF_TEAM_IDS_SQL);
    if (result.recordset.length === 0) return null;
    return result.recordset.map(r => r.teamID);
  }, null, { sql: GET_PLAYOFF_TEAM_IDS_SQL, seasonID, dependsOn: ['schedule'] });
  return ids ? new Set(ids) : null;
});

export function getMinGamesForWeek(week: number): number {
  const minByWeek = [3, 3, 6, 6, 9, 9, 12, 15, 18];
  return minByWeek[Math.min(week - 1, minByWeek.length - 1)] ?? 3;
}

export async function getSeasonLeaderboard(
  seasonID: number,
  gender: 'M' | 'F' | null,
  category: 'avg' | 'highGame' | 'highSeries' | 'totalPins' | 'games200' | 'series600' | 'turkeys' | 'hcpAvg' | 'hcpHighSeries',
  minGames?: number
): Promise<SeasonLeaderEntry[]> {
  const genderFilter = gender !== null
    ? 'AND b.gender = @gender'
    : '';

  let selectExpr: string;
  let havingClause = '';
  const orderDir = 'DESC';

  const minNights = minGames ? Math.ceil(minGames / 3) : 3;

  switch (category) {
    case 'avg':
      selectExpr = `CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1))`;
      havingClause = `HAVING COUNT(sc.scoreID) >= ${minNights}`;
      break;
    case 'highGame':
      selectExpr = `MAX(
        CASE
          WHEN sc.game1 >= sc.game2 AND sc.game1 >= sc.game3 THEN sc.game1
          WHEN sc.game2 >= sc.game3 THEN sc.game2
          ELSE sc.game3
        END
      )`;
      break;
    case 'highSeries':
      selectExpr = `MAX(sc.scratchSeries)`;
      break;
    case 'totalPins':
      selectExpr = `SUM(sc.scratchSeries)`;
      break;
    case 'games200':
      selectExpr = `SUM(
        CASE WHEN sc.game1 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN sc.game2 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN sc.game3 >= 200 THEN 1 ELSE 0 END
      )`;
      break;
    case 'series600':
      selectExpr = `SUM(CASE WHEN sc.scratchSeries >= 600 THEN 1 ELSE 0 END)`;
      break;
    case 'turkeys':
      selectExpr = `SUM(ISNULL(sc.turkeys, 0))`;
      break;
    case 'hcpAvg':
      selectExpr = `CAST(SUM(sc.handSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1))`;
      havingClause = `HAVING COUNT(sc.scoreID) >= ${minNights}`;
      break;
    case 'hcpHighSeries':
      selectExpr = `MAX(sc.handSeries)`;
      break;
  }

  const sql = `
    SELECT TOP 10
      agg.bowlerID,
      b.bowlerName,
      b.slug,
      COALESCE(tnh.teamName, t.teamName) AS teamName,
      t.slug AS teamSlug,
      agg.value,
      ROW_NUMBER() OVER (ORDER BY agg.value ${orderDir}) AS rank
    FROM (
      SELECT sc.bowlerID,
        ${selectExpr} AS value
      FROM scores sc
      JOIN bowlers b ON sc.bowlerID = b.bowlerID
      WHERE sc.seasonID = @seasonID
        AND sc.isPenalty = 0
        ${genderFilter}
      GROUP BY sc.bowlerID
      ${havingClause}
    ) agg
    JOIN bowlers b ON b.bowlerID = agg.bowlerID
    CROSS APPLY (
      SELECT TOP 1 sc2.teamID
      FROM scores sc2
      WHERE sc2.bowlerID = agg.bowlerID AND sc2.seasonID = @seasonID AND sc2.isPenalty = 0
      GROUP BY sc2.teamID
      ORDER BY COUNT(*) DESC
    ) pt
    LEFT JOIN teams t ON t.teamID = pt.teamID
    LEFT JOIN teamNameHistory tnh
      ON  tnh.seasonID = @seasonID
      AND tnh.teamID   = pt.teamID
    ORDER BY agg.value ${orderDir}
  `;

  return cachedQuery(`getSeasonLeaderboard-${seasonID}-${gender}-${category}-${minGames}`, async () => {
    const db = await getDb();
    const request = db.request().input('seasonID', seasonID);
    if (gender !== null) {
      request.input('gender', gender);
    }
    const result = await request.query<SeasonLeaderEntry>(sql);
    return result.recordset;
  }, [], { sql, seasonID });
}

const GET_SEASON_FULL_STATS_SQL = `
  SELECT
    agg.bowlerID,
    b.bowlerName,
    b.slug,
    b.gender,
    COALESCE(tnh.teamName, t.teamName)                   AS teamName,
    t.slug                                               AS teamSlug,
    agg.gamesBowled,
    agg.totalPins,
    agg.scratchAvg,
    agg.hcpAvg,
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
      AS DECIMAL(5,1))                                     AS scratchAvg,
      CAST(
        SUM(sc.handSeries) * 1.0 /
        NULLIF(COUNT(sc.scoreID) * 3, 0)
      AS DECIMAL(5,1))                                     AS hcpAvg,
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
    WHERE sc.seasonID = @seasonID
      AND sc.isPenalty = 0
    GROUP BY sc.bowlerID
  ) agg
  JOIN bowlers b ON b.bowlerID = agg.bowlerID
  CROSS APPLY (
    SELECT TOP 1 sc2.teamID
    FROM scores sc2
    WHERE sc2.bowlerID = agg.bowlerID AND sc2.seasonID = @seasonID AND sc2.isPenalty = 0
    GROUP BY sc2.teamID
    ORDER BY COUNT(*) DESC
  ) pt
  LEFT JOIN teams t ON t.teamID = pt.teamID
  LEFT JOIN teamNameHistory tnh
    ON  tnh.seasonID = @seasonID
    AND tnh.teamID   = pt.teamID
  ORDER BY scratchAvg DESC
`;

export async function getSeasonFullStats(seasonID: number): Promise<SeasonFullStatsRow[]> {
  return cachedQuery(`getSeasonFullStats-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('seasonID', seasonID)
      .query<SeasonFullStatsRow>(GET_SEASON_FULL_STATS_SQL);
    return result.recordset;
  }, [], { sql: GET_SEASON_FULL_STATS_SQL, seasonID });
}

const GET_STANDINGS_RACE_DATA_SQL = `
  WITH weeklyPts AS (
    SELECT sch.week,
           sch.team1ID AS teamID,
           mr.team1GamePts + mr.team1BonusPts AS pts
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.seasonID = @seasonID
    UNION ALL
    SELECT sch.week,
           sch.team2ID AS teamID,
           mr.team2GamePts + mr.team2BonusPts AS pts
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.seasonID = @seasonID
  ),
  cumulative AS (
    SELECT
      w1.teamID,
      w1.week,
      SUM(w2.pts) AS totalPts
    FROM (SELECT DISTINCT teamID, week FROM weeklyPts) w1
    JOIN weeklyPts w2 ON w2.teamID = w1.teamID AND w2.week <= w1.week
    GROUP BY w1.teamID, w1.week
  )
  SELECT
    c.week,
    c.teamID,
    COALESCE(tnh.teamName, t.teamName) AS teamName,
    c.totalPts
  FROM cumulative c
  JOIN teams t ON c.teamID = t.teamID
  LEFT JOIN teamNameHistory tnh
    ON tnh.seasonID = @seasonID AND tnh.teamID = c.teamID
  ORDER BY c.week, c.totalPts DESC
`;

export async function getStandingsRaceData(seasonID: number): Promise<RaceChartRow[]> {
  return cachedQuery(`getStandingsRaceData-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db.request().input('seasonID', seasonID).query<RaceChartRow>(GET_STANDINGS_RACE_DATA_SQL);
    return result.recordset;
  }, [], { sql: GET_STANDINGS_RACE_DATA_SQL, seasonID });
}
