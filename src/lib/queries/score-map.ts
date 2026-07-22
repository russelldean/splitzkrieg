/**
 * Per-bowler score-map data. Regular-season `scores` only (playoff games excluded).
 * Returns one row per distinct score 60-299 with its all-time count, whether it was
 * hit this season, and whether this season is its first-ever appearance.
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../db';
import {
  buildScoreMap,
  PERFECT_GAME_SLUGS,
  type ScoreMapRow,
  type ScoreMapModel,
} from '../score-map';

export const SCORE_MAP_SQL = `
  SELECT
    g.score,
    COUNT(*) AS total,
    MAX(CASE WHEN g.seasonID = cur.seasonID THEN 1 ELSE 0 END) AS thisSeason,
    CASE WHEN MIN(g.seasonID) = cur.seasonID THEN 1 ELSE 0 END AS isNew
  FROM (
    SELECT game1 AS score, seasonID FROM scores WHERE bowlerID = @bowlerID AND isPenalty = 0 AND game1 IS NOT NULL
    UNION ALL
    SELECT game2 AS score, seasonID FROM scores WHERE bowlerID = @bowlerID AND isPenalty = 0 AND game2 IS NOT NULL
    UNION ALL
    SELECT game3 AS score, seasonID FROM scores WHERE bowlerID = @bowlerID AND isPenalty = 0 AND game3 IS NOT NULL
  ) g
  CROSS JOIN (SELECT seasonID FROM seasons WHERE isCurrentSeason = 1) cur
  WHERE g.score BETWEEN 60 AND 299
  GROUP BY g.score, cur.seasonID
  ORDER BY g.score
`;

export const getScoreMap = cache(async (bowlerID: number, slug: string): Promise<ScoreMapModel> => {
  const rows = await cachedQuery<ScoreMapRow[]>(
    `getScoreMap-${bowlerID}`,
    async () => {
      const db = await getDb();
      const result = await db.request().input('bowlerID', bowlerID).query<ScoreMapRow>(SCORE_MAP_SQL);
      return result.recordset;
    },
    [],
    { sql: SCORE_MAP_SQL, bowlerID, dependsOn: ['scores'] },
  );
  return buildScoreMap(rows, PERFECT_GAME_SLUGS.has(slug));
});
