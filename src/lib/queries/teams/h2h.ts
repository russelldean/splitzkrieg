/**
 * Team head-to-head queries: H2H matchups, ghost team, pairwise summaries.
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../../db';

export interface TeamH2HMatchup {
  opponentID: number;
  opponentName: string;
  opponentSlug: string;
  seasonID: number;
  seasonName: string;
  seasonSlug: string;
  week: number;
  matchDate: string | null;
  ourGame1: number | null;
  ourGame2: number | null;
  ourGame3: number | null;
  theirGame1: number | null;
  theirGame2: number | null;
  theirGame3: number | null;
  ourSeries: number | null;
  theirSeries: number | null;
}

export interface TeamH2HActiveTeam {
  teamID: number;
  teamName: string;
  slug: string;
}

export interface GhostTeamMatchup {
  opponentID: number;
  opponentName: string;
  opponentSlug: string;
  seasonID: number;
  seasonName: string;
  seasonSlug: string;
  week: number;
  matchDate: string | null;
  teamAvg: number;
  scratchGame1: number;
  scratchGame2: number;
  scratchGame3: number;
  scratchSeries: number;
}

export interface PairH2HSummary {
  team1ID: number;
  team2ID: number;
  wins: number;
  losses: number;
  ties: number;
}

const GET_TEAM_H2H_SQL = `
  WITH matchups AS (
    SELECT
      sch.team2ID AS opponentID,
      sch.seasonID,
      sch.week,
      sch.matchDate,
      mr.team1Game1 AS ourGame1,
      mr.team1Game2 AS ourGame2,
      mr.team1Game3 AS ourGame3,
      mr.team2Game1 AS theirGame1,
      mr.team2Game2 AS theirGame2,
      mr.team2Game3 AS theirGame3,
      mr.team1Series AS ourSeries,
      mr.team2Series AS theirSeries
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.team1ID = @teamID AND sch.team2ID != 45
    UNION ALL
    SELECT
      sch.team1ID AS opponentID,
      sch.seasonID,
      sch.week,
      sch.matchDate,
      mr.team2Game1 AS ourGame1,
      mr.team2Game2 AS ourGame2,
      mr.team2Game3 AS ourGame3,
      mr.team1Game1 AS theirGame1,
      mr.team1Game2 AS theirGame2,
      mr.team1Game3 AS theirGame3,
      mr.team2Series AS ourSeries,
      mr.team1Series AS theirSeries
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.team2ID = @teamID AND sch.team1ID != 45
  )
  SELECT
    m.opponentID,
    t.teamName AS opponentName,
    t.slug AS opponentSlug,
    m.seasonID,
    sn.displayName AS seasonName,
    LOWER(REPLACE(sn.displayName, ' ', '-')) AS seasonSlug,
    m.week,
    m.matchDate,
    m.ourGame1,
    m.ourGame2,
    m.ourGame3,
    m.theirGame1,
    m.theirGame2,
    m.theirGame3,
    m.ourSeries,
    m.theirSeries
  FROM matchups m
  JOIN teams t ON m.opponentID = t.teamID
  JOIN seasons sn ON m.seasonID = sn.seasonID
  ORDER BY sn.year DESC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END DESC, m.week DESC
`;

export async function getTeamH2H(teamID: number): Promise<TeamH2HMatchup[]> {
  return cachedQuery(`getTeamH2H-${teamID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<TeamH2HMatchup>(GET_TEAM_H2H_SQL);
    return result.recordset;
  }, [], { sql: GET_TEAM_H2H_SQL, dependsOn: ['schedule'] });
}

const GET_GHOST_TEAM_H2H_SQL = `
  WITH ghostMatches AS (
    /* Scheduled ghost team weeks (odd-number seasons) */
    SELECT
      sch.seasonID,
      sch.week,
      sch.matchDate,
      CASE WHEN sch.team1ID = 45 THEN sch.team2ID ELSE sch.team1ID END AS opponentID
    FROM schedule sch
    WHERE (sch.team1ID = 45 OR sch.team2ID = 45)
      AND sch.team1ID IS NOT NULL AND sch.team2ID IS NOT NULL
    UNION
    /* Full-team forfeits: all 4 bowlers have isPenalty=1 */
    SELECT
      f.seasonID,
      f.week,
      sch.matchDate,
      CASE WHEN sch.team1ID = f.teamID THEN sch.team2ID ELSE sch.team1ID END AS opponentID
    FROM (
      SELECT seasonID, week, teamID
      FROM scores
      WHERE isPenalty = 1 AND teamID != 45
      GROUP BY seasonID, week, teamID
      HAVING COUNT(*) = 4
    ) f
    JOIN schedule sch ON sch.seasonID = f.seasonID AND sch.week = f.week
      AND (sch.team1ID = f.teamID OR sch.team2ID = f.teamID)
  ),
  oppScores AS (
    SELECT
      gm.seasonID,
      gm.week,
      gm.matchDate,
      gm.opponentID,
      SUM(sc.game1) AS scratchGame1,
      SUM(sc.game2) AS scratchGame2,
      SUM(sc.game3) AS scratchGame3,
      SUM(sc.scratchSeries) AS scratchSeries,
      SUM(CAST(sc.incomingAvg AS INT)) AS teamAvg
    FROM ghostMatches gm
    JOIN scores sc ON sc.seasonID = gm.seasonID
      AND sc.week = gm.week
      AND sc.teamID = gm.opponentID
      AND sc.isPenalty = 0
    GROUP BY gm.seasonID, gm.week, gm.matchDate, gm.opponentID
    HAVING SUM(sc.incomingAvg) IS NOT NULL
  )
  SELECT
    os.opponentID,
    t.teamName AS opponentName,
    t.slug AS opponentSlug,
    os.seasonID,
    sn.displayName AS seasonName,
    LOWER(REPLACE(sn.displayName, ' ', '-')) AS seasonSlug,
    os.week,
    os.matchDate,
    os.teamAvg,
    os.scratchGame1,
    os.scratchGame2,
    os.scratchGame3,
    os.scratchSeries
  FROM oppScores os
  JOIN teams t ON os.opponentID = t.teamID
  JOIN seasons sn ON os.seasonID = sn.seasonID
  ORDER BY sn.year DESC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END DESC, os.week DESC
`;

export async function getGhostTeamH2H(): Promise<GhostTeamMatchup[]> {
  return cachedQuery('getGhostTeamH2H', async () => {
    const db = await getDb();
    const result = await db
      .request()
      .query<GhostTeamMatchup>(GET_GHOST_TEAM_H2H_SQL);
    return result.recordset;
  }, [], { sql: GET_GHOST_TEAM_H2H_SQL, dependsOn: ['scores', 'schedule'] });
}

const GET_ACTIVE_TEAM_IDS_SQL = `
  SELECT DISTINCT t.teamID, t.teamName, t.slug
  FROM teams t
  JOIN scores sc ON sc.teamID = t.teamID AND sc.isPenalty = 0
  WHERE sc.seasonID = (
    SELECT TOP 1 seasonID FROM seasons
    ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
  )
  ORDER BY t.teamName
`;

export async function getActiveTeamIDs(): Promise<TeamH2HActiveTeam[]> {
  return cachedQuery('getActiveTeamIDs', async () => {
    const db = await getDb();
    const result = await db.request().query<TeamH2HActiveTeam>(GET_ACTIVE_TEAM_IDS_SQL);
    return result.recordset;
  }, [], { sql: GET_ACTIVE_TEAM_IDS_SQL, dependsOn: ['scores'] });
}

/**
 * For a list of team-pair tuples, return their all-time H2H game record.
 * Used on week preview pages to show the matchup history.
 */
export interface PlayoffH2HMatchup {
  opponentID: number;
  opponentName: string;
  opponentSlug: string;
  seasonID: number;
  seasonName: string;
  seasonSlug: string;
  round: string;
  won: boolean;
}

const GET_TEAM_PLAYOFF_H2H_SQL = `
  WITH finals AS (
    SELECT seasonID, team1ID AS champID, team2ID AS ruID
    FROM playoffResults
    WHERE playoffType = 'Team' AND round = 'final'
  ),
  allMatchups AS (
    -- All rows where team2ID is populated (finals + newer semis)
    SELECT pr.seasonID, pr.round, pr.team1ID, pr.team2ID, pr.winnerTeamID
    FROM playoffResults pr
    WHERE pr.playoffType = 'Team' AND pr.team2ID IS NOT NULL
    UNION ALL
    -- Older semis: loser in team1ID, infer winner from final using playoffID ordering
    SELECT pr.seasonID, pr.round, pr.team1ID,
      CASE
        WHEN ROW_NUMBER() OVER (PARTITION BY pr.seasonID ORDER BY pr.playoffID) = 1 THEN f.champID
        ELSE f.ruID
      END,
      CASE
        WHEN ROW_NUMBER() OVER (PARTITION BY pr.seasonID ORDER BY pr.playoffID) = 1 THEN f.champID
        ELSE f.ruID
      END
    FROM playoffResults pr
    JOIN finals f ON f.seasonID = pr.seasonID
    WHERE pr.playoffType = 'Team' AND pr.round = 'semifinal' AND pr.team2ID IS NULL
  )
  SELECT
    CASE WHEN am.team1ID = @teamID THEN am.team2ID ELSE am.team1ID END AS opponentID,
    t.teamName AS opponentName,
    t.slug AS opponentSlug,
    am.seasonID,
    sn.displayName AS seasonName,
    LOWER(REPLACE(sn.displayName, ' ', '-')) AS seasonSlug,
    am.round,
    CASE WHEN am.winnerTeamID = @teamID THEN 1 ELSE 0 END AS won
  FROM allMatchups am
  JOIN seasons sn ON am.seasonID = sn.seasonID
  JOIN teams t ON t.teamID = CASE WHEN am.team1ID = @teamID THEN am.team2ID ELSE am.team1ID END
  WHERE am.team1ID = @teamID OR am.team2ID = @teamID
  ORDER BY sn.year DESC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END DESC
`;

export async function getTeamPlayoffH2H(teamID: number): Promise<PlayoffH2HMatchup[]> {
  return cachedQuery(`getTeamPlayoffH2H-${teamID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<PlayoffH2HMatchup>(GET_TEAM_PLAYOFF_H2H_SQL);
    return result.recordset;
  }, [], { sql: GET_TEAM_PLAYOFF_H2H_SQL, dependsOn: ['schedule'] });
}

export async function getPairwiseH2H(
  pairs: { team1ID: number; team2ID: number }[]
): Promise<PairH2HSummary[]> {
  if (pairs.length === 0) return [];
  const pairKey = (a: number, b: number) => a < b ? `${a}-${b}` : `${b}-${a}`;
  const seen = new Set<string>();
  const uniquePairs: { a: number; b: number }[] = [];
  for (const { team1ID, team2ID } of pairs) {
    const k = pairKey(team1ID, team2ID);
    if (!seen.has(k)) {
      seen.add(k);
      uniquePairs.push({ a: Math.min(team1ID, team2ID), b: Math.max(team1ID, team2ID) });
    }
  }

  const cacheKey = `getPairwiseH2H-${uniquePairs.map(p => `${p.a}_${p.b}`).join(',')}`;

  const PAIRWISE_H2H_SQL_TEMPLATE = `
    SELECT
      sch.team1ID,
      sch.team2ID,
      mr.team1Game1 AS t1g1, mr.team1Game2 AS t1g2, mr.team1Game3 AS t1g3,
      mr.team2Game1 AS t2g1, mr.team2Game2 AS t2g2, mr.team2Game3 AS t2g3
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
  `;

  return cachedQuery(cacheKey, async () => {
    const db = await getDb();

    interface RawRow {
      team1ID: number;
      team2ID: number;
      t1g1: number | null; t1g2: number | null; t1g3: number | null;
      t2g1: number | null; t2g2: number | null; t2g3: number | null;
    }

    const conditions = uniquePairs.map((p, i) =>
      `(sch.team1ID = @a${i} AND sch.team2ID = @b${i}) OR (sch.team1ID = @b${i} AND sch.team2ID = @a${i})`
    ).join(' OR ');

    const request = db.request();
    for (let i = 0; i < uniquePairs.length; i++) {
      request.input(`a${i}`, uniquePairs[i].a);
      request.input(`b${i}`, uniquePairs[i].b);
    }

    const sql = `${PAIRWISE_H2H_SQL_TEMPLATE} WHERE ${conditions}`;
    const result = await request.query<RawRow>(sql);

    const map = new Map<string, PairH2HSummary>();
    for (const { team1ID, team2ID } of pairs) {
      const k = pairKey(team1ID, team2ID);
      if (!map.has(k)) {
        map.set(k, { team1ID, team2ID, wins: 0, losses: 0, ties: 0 });
      }
    }

    for (const row of result.recordset) {
      const games: [number | null, number | null][] = [
        [row.t1g1, row.t2g1],
        [row.t1g2, row.t2g2],
        [row.t1g3, row.t2g3],
      ];
      for (const [g1, g2] of games) {
        if (g1 == null || g2 == null) continue;
        const k = pairKey(row.team1ID, row.team2ID);
        const summary = map.get(k);
        if (!summary) continue;

        const sameOrder = summary.team1ID === row.team1ID;
        const t1Score = sameOrder ? g1 : g2;
        const t2Score = sameOrder ? g2 : g1;

        if (t1Score > t2Score) summary.wins++;
        else if (t1Score < t2Score) summary.losses++;
        else summary.ties++;
      }
    }

    return Array.from(map.values());
  }, [], { sql: PAIRWISE_H2H_SQL_TEMPLATE, dependsOn: ['schedule'] });
}
