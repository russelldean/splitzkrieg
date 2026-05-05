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
  team1GamePts: number;
  team2GamePts: number;
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
         mr.team2GamePts + mr.team2BonusPts AS team2Pts,
         mr.team1GamePts, mr.team2GamePts
  FROM matchResults mr
  JOIN schedule sch ON mr.scheduleID = sch.scheduleID
  WHERE sch.seasonID = @seasonID
`;

/**
 * Resolve standings ties per official league rules:
 *   - 2-way tie on totalPts → head-to-head winner (sum of total pts in their meetings)
 *   - 3+ way tie on totalPts → game-pts W/L% among tied teams (rule 3a),
 *     then high scratch avg (rule 3b). If 3a leaves a 2-way subtie, fall back to h2h.
 */
function resolveH2HTiebreakers(
  standings: StandingsRow[],
  h2hResults: HeadToHeadResult[]
): StandingsRow[] {
  // h2hMap: "loID-hiID" → net total pts for lower-ID team (used for 2-way h2h)
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

  function resolveTwoWay(a: StandingsRow, b: StandingsRow): [StandingsRow, StandingsRow] {
    const [lo, hi] = a.teamID < b.teamID ? [a.teamID, b.teamID] : [b.teamID, a.teamID];
    const netForLo = h2hMap.get(`${lo}-${hi}`) ?? 0;
    const netForA = a.teamID < b.teamID ? netForLo : -netForLo;
    if (netForA > 0) return [a, b];
    if (netForA < 0) return [b, a];
    // H2H also tied — fall back to scratch avg
    return (a.teamScratchAvg ?? 0) >= (b.teamScratchAvg ?? 0) ? [a, b] : [b, a];
  }

  function resolveThreePlus(tier: StandingsRow[]): StandingsRow[] {
    // Rule 3a: game-pts won / 6 per match, only counting matches between tied teams.
    // 6 game pts available per match (0/2/4/6 distribution).
    const tiedIDs = new Set(tier.map(t => t.teamID));
    const stats = new Map<number, { gamePts: number; matches: number }>();
    for (const t of tier) stats.set(t.teamID, { gamePts: 0, matches: 0 });
    for (const r of h2hResults) {
      if (tiedIDs.has(r.team1ID) && tiedIDs.has(r.team2ID)) {
        stats.get(r.team1ID)!.gamePts += r.team1GamePts;
        stats.get(r.team1ID)!.matches += 1;
        stats.get(r.team2ID)!.gamePts += r.team2GamePts;
        stats.get(r.team2ID)!.matches += 1;
      }
    }
    const annotated = tier.map(t => {
      const s = stats.get(t.teamID)!;
      const pct = s.matches > 0 ? s.gamePts / (s.matches * 6) : 0;
      return { row: t, pct };
    });
    annotated.sort((a, b) => b.pct - a.pct);

    // Walk subgroups by equal pct.
    const out: StandingsRow[] = [];
    let i = 0;
    while (i < annotated.length) {
      let j = i + 1;
      while (j < annotated.length && annotated[j].pct === annotated[i].pct) j++;
      const sub = annotated.slice(i, j).map(x => x.row);
      if (sub.length === 1) {
        out.push(sub[0]);
      } else if (sub.length === 2) {
        // 3a reduced to 2-way → fall back to head-to-head
        const [a, b] = resolveTwoWay(sub[0], sub[1]);
        out.push(a, b);
      } else {
        // Still 3+ tied after 3a → rule 3b: high scratch avg
        sub.sort((x, y) => (y.teamScratchAvg ?? 0) - (x.teamScratchAvg ?? 0));
        out.push(...sub);
      }
      i = j;
    }
    return out;
  }

  const divisions = new Map<string, StandingsRow[]>();
  for (const row of standings) {
    const div = row.divisionName ?? '__none__';
    if (!divisions.has(div)) divisions.set(div, []);
    divisions.get(div)!.push(row);
  }

  const result: StandingsRow[] = [];
  for (const rows of divisions.values()) {
    let i = 0;
    while (i < rows.length) {
      let j = i + 1;
      while (j < rows.length && rows[j].totalPts === rows[i].totalPts) j++;
      const tier = rows.slice(i, j);

      if (tier.length === 1) {
        result.push(tier[0]);
      } else if (tier.length === 2) {
        const [a, b] = resolveTwoWay(tier[0], tier[1]);
        result.push(a, b);
      } else {
        result.push(...resolveThreePlus(tier));
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
  }, null, { sql: GET_PLAYOFF_TEAM_IDS_SQL, seasonID });
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
    case 'highGame': {
      // Expand each score row into 3 individual games so multiple
      // games from the same bowler can all appear in the top 10.
      const highGameSql = `
        SELECT TOP 10
          g.bowlerID,
          b.bowlerName,
          b.slug,
          COALESCE(tnh.teamName, t.teamName) AS teamName,
          t.slug AS teamSlug,
          g.value,
          ROW_NUMBER() OVER (ORDER BY g.value DESC) AS rank
        FROM (
          SELECT sc.bowlerID, sc.game1 AS value FROM scores sc WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
          UNION ALL
          SELECT sc.bowlerID, sc.game2 FROM scores sc WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
          UNION ALL
          SELECT sc.bowlerID, sc.game3 FROM scores sc WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
        ) g
        JOIN bowlers b ON b.bowlerID = g.bowlerID
        CROSS APPLY (
          SELECT TOP 1 sc2.teamID
          FROM scores sc2
          WHERE sc2.bowlerID = g.bowlerID AND sc2.seasonID = @seasonID AND sc2.isPenalty = 0
          GROUP BY sc2.teamID ORDER BY COUNT(*) DESC
        ) pt
        LEFT JOIN teams t ON t.teamID = pt.teamID
        LEFT JOIN teamNameHistory tnh ON tnh.seasonID = @seasonID AND tnh.teamID = pt.teamID
        WHERE 1=1 ${genderFilter}
        ORDER BY g.value DESC
      `;
      return cachedQuery(`getSeasonLeaderboard-${seasonID}-${gender}-${category}-${minGames}`, async () => {
        const db = await getDb();
        const request = db.request().input('seasonID', seasonID);
        if (gender !== null) request.input('gender', gender);
        const result = await request.query<SeasonLeaderEntry>(highGameSql);
        return result.recordset;
      }, [], { sql: highGameSql, seasonID });
    }
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
