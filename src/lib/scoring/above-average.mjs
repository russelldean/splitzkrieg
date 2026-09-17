/**
 * "Above Average Every Game" — the one definition.
 *
 * Written 2026-09-17 after the rule was found living in three places that had
 * drifted apart. Russ ruled on 2026-08-04 that matching your average COUNTS
 * ("we give above average even if you tie it"). The two SQL copies were moved
 * to >= then and 343 patches were backfilled; the TS copy that renders the week
 * page was missed and kept using >.
 *
 * The failure was silent and one-sided. The patch pipeline awarded the badge,
 * so it showed on the bowler page, while the week page computed its own list
 * and left the same bowler off. 347 bowler-weeks league-wide, caught only
 * because Russ noticed Brooke Insley missing from S36 week 5.
 *
 * This file is .mjs on purpose, following src/lib/data-invariants.mjs: that is
 * what lets a TS component, a TS admin module and a plain node script all
 * import the same definition rather than each keeping a copy.
 *
 * Consumers:
 *   - src/components/season/weekStatsUtils.ts  (week page list)   -> predicate
 *   - src/lib/admin/scores.ts                  (post-import)      -> SQL
 *   - scripts/populate-patches.mjs             (canonical)        -> SQL
 *
 * The remaining duplication is unavoidable: one JS predicate and one SQL
 * fragment, because the week page filters rows it already has in memory while
 * the patch writers filter in the database. They are pinned to each other by
 * above-average.test.mjs, which runs both against the same case table.
 */

/**
 * SQL predicate over the `scores` table, aliased `sc`.
 * Used by both patch writers. Callers append their own week/season filter.
 */
export const ABOVE_AVG_SQL = `sc.isPenalty = 0
      AND sc.incomingAvg IS NOT NULL AND sc.incomingAvg > 0
      AND sc.game1 >= sc.incomingAvg
      AND sc.game2 >= sc.incomingAvg
      AND sc.game3 >= sc.incomingAvg`;

/**
 * In-memory form of the same rule, for rows already fetched.
 *
 * @param {{game1: number|null, game2: number|null, game3: number|null,
 *          incomingAvg: number|null, isPenalty?: boolean}} s
 * @returns {boolean}
 */
export function isAboveAverageAllThree(s) {
  if (s.isPenalty) return false;
  // A null or zero average means there is nothing to be above: new bowlers take
  // a flat 219 per handicap game rather than carrying an average.
  if (s.incomingAvg == null || s.incomingAvg === 0) return false;
  return (
    s.game1 != null && s.game1 >= s.incomingAvg &&
    s.game2 != null && s.game2 >= s.incomingAvg &&
    s.game3 != null && s.game3 >= s.incomingAvg
  );
}
