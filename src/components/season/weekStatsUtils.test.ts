import { describe, it, expect } from 'vitest';
import { computeWeeklyAwards } from './weekStatsUtils';
import type { WeeklyMatchScore } from '@/lib/queries';

/**
 * These exist because the week page and the patch pipeline each carried their
 * own copy of the "above average every game" rule, and they disagreed.
 *
 * Russ ruled on 2026-08-04 that matching your average COUNTS: "we give above
 * average even if you tie it". `scripts/populate-patches.mjs` was changed to
 * `>=` and 343 patches were backfilled. This file's `computeWeeklyAwards` was
 * never updated, so it kept using `>`.
 *
 * The result was silent and one-sided: a bowler who tied got the badge on their
 * bowler page but was missing from the list on their own week page. 347
 * bowler-weeks league-wide were affected before this was caught, five of them
 * in S36 alone.
 *
 * The first test below is that exact regression, with the numbers that shipped.
 */

function score(over: Partial<WeeklyMatchScore>): WeeklyMatchScore {
  return {
    week: 5,
    matchDate: null,
    teamID: 12,
    teamName: 'Guttermouths',
    teamSlug: 'guttermouths',
    bowlerID: 84,
    bowlerName: 'Brooke Insley',
    bowlerSlug: 'brooke-insley',
    game1: null,
    game2: null,
    game3: null,
    scratchSeries: null,
    handSeries: null,
    incomingAvg: null,
    incomingHcp: null,
    turkeys: 0,
    gender: 'F',
    isFirstNight: false,
    priorBestGame: null,
    priorBestSeries: null,
    isPenalty: false,
    ...over,
  };
}

const namesOf = (rows: { bowlerName: string }[]) => rows.map((r) => r.bowlerName);

describe('computeWeeklyAwards — above average every game', () => {
  it('counts a bowler who ties their average (S36 wk5 Brooke Insley, the case that shipped)', () => {
    // 157/147/144 against a 144 average: above on two, exactly level on the third.
    const b = score({ game1: 157, game2: 147, game3: 144, incomingAvg: 144 });
    const { aboveAvgEveryGame } = computeWeeklyAwards([b], [b]);
    expect(namesOf(aboveAvgEveryGame)).toEqual(['Brooke Insley']);
  });

  it('counts the other S36 wk5 tie (Elizabeth Read, 147/179/125 on a 125 average)', () => {
    const b = score({
      bowlerName: 'Elizabeth Read',
      bowlerSlug: 'elizabeth-read',
      bowlerID: 188,
      game1: 147,
      game2: 179,
      game3: 125,
      incomingAvg: 125,
    });
    const { aboveAvgEveryGame } = computeWeeklyAwards([b], [b]);
    expect(namesOf(aboveAvgEveryGame)).toEqual(['Elizabeth Read']);
  });

  it('counts a bowler who ties on all three games', () => {
    const b = score({ game1: 140, game2: 140, game3: 140, incomingAvg: 140 });
    const { aboveAvgEveryGame } = computeWeeklyAwards([b], [b]);
    expect(namesOf(aboveAvgEveryGame)).toEqual(['Brooke Insley']);
  });

  it('still excludes a bowler who falls one pin short on a single game', () => {
    const b = score({ game1: 157, game2: 147, game3: 143, incomingAvg: 144 });
    const { aboveAvgEveryGame } = computeWeeklyAwards([b], [b]);
    expect(aboveAvgEveryGame).toHaveLength(0);
  });

  it('still counts a bowler clear of their average on all three', () => {
    const b = score({ game1: 200, game2: 175, game3: 266, incomingAvg: 171 });
    const { aboveAvgEveryGame } = computeWeeklyAwards([b], [b]);
    expect(namesOf(aboveAvgEveryGame)).toEqual(['Brooke Insley']);
  });

  it('ignores a bowler with no incoming average, who cannot be measured', () => {
    const b = score({ game1: 200, game2: 200, game3: 200, incomingAvg: null });
    expect(computeWeeklyAwards([b], [b]).aboveAvgEveryGame).toHaveLength(0);
  });

  it('ignores a zero incoming average rather than treating every game as above it', () => {
    const b = score({ game1: 90, game2: 80, game3: 70, incomingAvg: 0 });
    expect(computeWeeklyAwards([b], [b]).aboveAvgEveryGame).toHaveLength(0);
  });

  it('ignores a missing game rather than counting a partial night', () => {
    const b = score({ game1: 157, game2: null, game3: 144, incomingAvg: 144 });
    expect(computeWeeklyAwards([b], [b]).aboveAvgEveryGame).toHaveLength(0);
  });
});
