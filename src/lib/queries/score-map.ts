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
    -- 1 if the bowler rolled this score at least once in the current season
    MAX(CASE WHEN sc.seasonID = cur.seasonID THEN 1 ELSE 0 END) AS thisSeason,
    -- 1 if the score's first-ever roll is the current season (a newly-filled square)
    CASE WHEN MIN(sc.seasonID) = cur.seasonID THEN 1 ELSE 0 END AS isNew
  FROM scores sc
  CROSS APPLY (VALUES (sc.game1), (sc.game2), (sc.game3)) AS g(score)
  OUTER APPLY (SELECT seasonID FROM seasons WHERE isCurrentSeason = 1) AS cur(seasonID)
  WHERE sc.bowlerID = @bowlerID
    AND sc.isPenalty = 0
    AND g.score BETWEEN 60 AND 299
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
    { sql: SCORE_MAP_SQL, bowlerID },
  );
  return buildScoreMap(rows, PERFECT_GAME_SLUGS.has(slug));
});
