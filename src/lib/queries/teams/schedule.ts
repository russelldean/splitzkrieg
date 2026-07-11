import { cache } from 'react';
import { getDb, cachedQuery } from '../../db';

export interface TeamScheduleRow {
  week: number;
  matchDate: string | null;
  opponentName: string;
  opponentSlug: string;
  played: boolean;
  ourGame1: number | null;
  ourGame2: number | null;
  ourGame3: number | null;
  theirGame1: number | null;
  theirGame2: number | null;
  theirGame3: number | null;
  gamePts: number | null;
  xp: number | null;
  total: number | null;
}

/** Raw row shape returned by GET_TEAM_CURRENT_SEASON_SCHEDULE_SQL. */
export interface TeamScheduleQueryRow {
  week: number;
  matchDate: string | null;
  opponentName: string;
  opponentSlug: string;
  resultID: number | null;
  ourGame1: number | null;
  ourGame2: number | null;
  ourGame3: number | null;
  theirGame1: number | null;
  theirGame2: number | null;
  theirGame3: number | null;
  gamePts: number | null;
  xp: number | null;
}

/** Pure mapper: raw SQL row -> display row (played flag + total). */
export function shapeTeamScheduleRow(r: TeamScheduleQueryRow): TeamScheduleRow {
  const played = r.resultID != null;
  const gamePts = played ? r.gamePts : null;
  const xp = played ? r.xp : null;
  const total = gamePts != null && xp != null ? gamePts + xp : null;
  return {
    week: r.week,
    matchDate: r.matchDate,
    opponentName: r.opponentName,
    opponentSlug: r.opponentSlug,
    played,
    ourGame1: r.ourGame1,
    ourGame2: r.ourGame2,
    ourGame3: r.ourGame3,
    theirGame1: r.theirGame1,
    theirGame2: r.theirGame2,
    theirGame3: r.theirGame3,
    gamePts,
    xp,
    total,
  };
}

// Latest season = highest year, Fall after Spring (matches getTeamCurrentRoster).
const LATEST_SEASON_SUBQUERY = `(
  SELECT TOP 1 seasonID FROM seasons
  ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
)`;

const GET_CURRENT_SEASON_TEAM_IDS_SQL = `
  SELECT DISTINCT teamID FROM (
    SELECT team1ID AS teamID FROM schedule WHERE seasonID = ${LATEST_SEASON_SUBQUERY}
    UNION
    SELECT team2ID AS teamID FROM schedule WHERE seasonID = ${LATEST_SEASON_SUBQUERY}
  ) t
  WHERE teamID IS NOT NULL
`;

/**
 * Set of team IDs scheduled in the current (latest) season. Schedule-based, so it is
 * populated in preseason (before any scores exist). React-cached so it runs once per build.
 */
export const getCurrentSeasonTeamIDs = cache(async (): Promise<Set<number>> => {
  const ids = await cachedQuery('getCurrentSeasonTeamIDs', async () => {
    const db = await getDb();
    const result = await db.request().query<{ teamID: number }>(GET_CURRENT_SEASON_TEAM_IDS_SQL);
    return result.recordset.map((r) => r.teamID);
  }, [], { sql: GET_CURRENT_SEASON_TEAM_IDS_SQL, dependsOn: ['schedule'] });
  return new Set(ids);
});

const GET_TEAM_CURRENT_SEASON_SCHEDULE_SQL = `
  WITH matchups AS (
    SELECT
      sch.week, sch.matchDate,
      sch.team2ID AS opponentID,
      mr.resultID,
      mr.team1Game1 AS ourGame1, mr.team1Game2 AS ourGame2, mr.team1Game3 AS ourGame3,
      mr.team2Game1 AS theirGame1, mr.team2Game2 AS theirGame2, mr.team2Game3 AS theirGame3,
      mr.team1GamePts AS gamePts, mr.team1BonusPts AS xp
    FROM schedule sch
    LEFT JOIN matchResults mr ON mr.scheduleID = sch.scheduleID
    WHERE sch.seasonID = @seasonID AND sch.team1ID = @teamID
    UNION ALL
    SELECT
      sch.week, sch.matchDate,
      sch.team1ID AS opponentID,
      mr.resultID,
      mr.team2Game1 AS ourGame1, mr.team2Game2 AS ourGame2, mr.team2Game3 AS ourGame3,
      mr.team1Game1 AS theirGame1, mr.team1Game2 AS theirGame2, mr.team1Game3 AS theirGame3,
      mr.team2GamePts AS gamePts, mr.team2BonusPts AS xp
    FROM schedule sch
    LEFT JOIN matchResults mr ON mr.scheduleID = sch.scheduleID
    WHERE sch.seasonID = @seasonID AND sch.team2ID = @teamID
  )
  SELECT
    m.week, m.matchDate,
    t.teamName AS opponentName,
    t.slug AS opponentSlug,
    m.resultID,
    m.ourGame1, m.ourGame2, m.ourGame3,
    m.theirGame1, m.theirGame2, m.theirGame3,
    m.gamePts, m.xp
  FROM matchups m
  JOIN teams t ON m.opponentID = t.teamID
  ORDER BY m.week, m.matchDate
`;

/**
 * The team's schedule for one season: every scheduled week, opponent, the team's own
 * match date, and per-game/points results once played (null while upcoming).
 */
export async function getTeamCurrentSeasonSchedule(
  teamID: number,
  seasonID: number,
): Promise<TeamScheduleRow[]> {
  return cachedQuery(`getTeamCurrentSeasonSchedule-${teamID}-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .input('seasonID', seasonID)
      .query<TeamScheduleQueryRow>(GET_TEAM_CURRENT_SEASON_SCHEDULE_SQL);
    return result.recordset.map(shapeTeamScheduleRow);
  }, [], { sql: GET_TEAM_CURRENT_SEASON_SCHEDULE_SQL, seasonID, dependsOn: ['scores', 'schedule'] });
}
