/**
 * Score Map: pure transform from per-score SQL aggregates to a render-ready model.
 * Regular-season data only. The 300 medallion is driven by the honor roll below,
 * NOT the data, because Geoffrey Berry's 300 was in a playoff and is not in `scores`.
 */

/** Bowlers with a 300 on record. DePasquale's is in `scores`; Berry's playoff 300 is not, so it is listed explicitly. */
export const PERFECT_GAME_SLUGS = new Set<string>(['mike-depasquale', 'geoffrey-berry']);

/** One row per distinct score the bowler has rolled in the regular season (60-299). */
export interface ScoreMapRow {
  score: number;      // 60..299
  total: number;      // all-time regular-season count of this exact score
  thisSeason: number; // 1 if rolled at least once in the current season, else 0
  isNew: number;      // 1 if the first-ever roll of this score is the current season
}

export type HeatBin = 0 | 1 | 2 | 3 | 4 | 5;

export interface ScoreCell {
  score: number;
  count: number;      // all-time regular-season count (0 = a gap)
  bin: HeatBin;
  thisSeason: boolean;
  isNew: boolean;
  aboveMax: boolean;  // empty cell sitting above the bowler's max, in the top ten-row
}

export interface ScoreMapModel {
  hasData: boolean;
  minScore: number;
  maxScore: number;
  minDecade: number;  // floor(minScore/10)*10
  maxDecade: number;  // floor(maxScore/10)*10
  decades: number[];  // ten-row starts, minDecade..maxDecade step 10
  cells: Record<number, ScoreCell>; // keyed by score, every score minDecade..maxDecade+9
  mostRolled: number | null; // score with highest count; ties broken by lowest score
  filledCount: number;       // distinct scores rolled
  seasonCount: number;       // distinct scores hit this season
  newCount: number;          // distinct scores first rolled this season
  hasPerfect: boolean;       // show the 300 medallion
}

/** Absolute frequency bins. Same shade means the same thing on every card. */
export function heatBin(count: number): HeatBin {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  if (count <= 10) return 4;
  return 5;
}
