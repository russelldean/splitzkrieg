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

export function buildScoreMap(rows: ScoreMapRow[], hasPerfect: boolean): ScoreMapModel {
  const filled = rows.filter((r) => r.total > 0 && r.score >= 60 && r.score <= 299);
  if (filled.length === 0) {
    return {
      hasData: false, minScore: 0, maxScore: 0, minDecade: 0, maxDecade: 0,
      decades: [], cells: {}, mostRolled: null,
      filledCount: 0, seasonCount: 0, newCount: 0, hasPerfect,
    };
  }

  const byScore = new Map<number, ScoreMapRow>();
  for (const r of filled) byScore.set(r.score, r);

  const scores = [...byScore.keys()].sort((a, b) => a - b);
  const minScore = scores[0];
  const maxScore = scores[scores.length - 1];
  const minDecade = Math.floor(minScore / 10) * 10;
  const maxDecade = Math.floor(maxScore / 10) * 10;

  const decades: number[] = [];
  for (let d = minDecade; d <= maxDecade; d += 10) decades.push(d);

  const cells: Record<number, ScoreCell> = {};
  for (const d of decades) {
    for (let one = 0; one < 10; one++) {
      const s = d + one;
      const r = byScore.get(s);
      const count = r?.total ?? 0;
      cells[s] = {
        score: s,
        count,
        bin: heatBin(count),
        thisSeason: !!r && r.thisSeason === 1,
        isNew: !!r && r.isNew === 1,
        aboveMax: count === 0 && s > maxScore,
      };
    }
  }

  let mostRolled: number | null = null;
  let best = -1;
  for (const s of scores) {
    const c = byScore.get(s)!.total;
    if (c > best) { best = c; mostRolled = s; }
  }

  const filledCount = scores.length;
  const seasonCount = filled.filter((r) => r.thisSeason === 1).length;
  const newCount = filled.filter((r) => r.isNew === 1).length;

  return {
    hasData: true, minScore, maxScore, minDecade, maxDecade, decades, cells,
    mostRolled, filledCount, seasonCount, newCount, hasPerfect,
  };
}

/** Collapsed-state teaser line. "new" is reserved for genuine first-time fills. */
export function scoreMapTeaser(m: Pick<ScoreMapModel, 'filledCount' | 'seasonCount' | 'newCount'>): string {
  const dot = ' · ';
  const parts = [`${m.filledCount} scores rolled`];
  if (m.seasonCount > 0) parts.push(`${m.seasonCount} this season`);
  if (m.newCount > 0) parts.push(`${m.newCount} new square${m.newCount > 1 ? 's' : ''}!`);
  return parts.join(dot);
}
