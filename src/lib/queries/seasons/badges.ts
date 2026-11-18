/**
 * Badge Wall: every badge (bowlerPatches row) earned in one season.
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../../db';

export interface SeasonBadgeRow {
  code: string;
  bowlerID: number;
  bowlerName: string;
  slug: string;
  isPublic: boolean;
  week: number | null;
}

export interface SeasonBadgeWall {
  badges: SeasonBadgeRow[];
  /** Team champion's name that season, or null before the final is decided. */
  championTeamName: string | null;
}

const GET_SEASON_BADGE_WALL_SQL = `
  SELECT p.code, bp.bowlerID, b.bowlerName, b.slug, CAST(b.isPublic AS bit) AS isPublic, bp.week
  FROM bowlerPatches bp
  JOIN patches p ON p.patchID = bp.patchID
  JOIN bowlers b ON b.bowlerID = bp.bowlerID
  WHERE bp.seasonID = @seasonID AND p.code <> 'captain'
  ORDER BY p.code, b.bowlerName, bp.week;
  SELECT COALESCE(h.teamName, t.teamName) AS teamName
  FROM seasonChampions sc
  JOIN teams t ON t.teamID = sc.winnerTeamID
  LEFT JOIN teamNameHistory h ON h.seasonID = sc.seasonID AND h.teamID = sc.winnerTeamID
  WHERE sc.seasonID = @seasonID AND sc.championshipType = 'Team'
`;

// Badges are written by the score import (weekly) and after playoffs, so the
// scores and playoffScores channels cover the normal flow. A badge-only run
// (populate-patches by hand) shows up on the next deploy that bumps either.
export const getSeasonBadgeWall = cache(async (seasonID: number): Promise<SeasonBadgeWall> => {
  return cachedQuery<SeasonBadgeWall>(
    `getSeasonBadgeWall-${seasonID}`,
    async () => {
      const db = await getDb();
      const result = await db.request().input('seasonID', seasonID).query(GET_SEASON_BADGE_WALL_SQL);
      const sets = result.recordsets as unknown as [SeasonBadgeRow[], { teamName: string }[]];
      return { badges: sets[0], championTeamName: sets[1][0]?.teamName ?? null };
    },
    { badges: [], championTeamName: null },
    { sql: GET_SEASON_BADGE_WALL_SQL, seasonID, dependsOn: ['scores', 'playoffScores'] },
  );
});
