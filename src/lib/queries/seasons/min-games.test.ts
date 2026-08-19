import { describe, it, expect } from 'vitest';
import { getMinGamesForWeek } from './standings';

// Characterization tests: getMinGamesForWeek already shipped untested, and the
// week page snapshot now depends on it, so pin the ramp before leaning on it.
describe('getMinGamesForWeek', () => {
  it('ramps the minimum as the season accumulates games', () => {
    const ramp = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(getMinGamesForWeek);
    expect(ramp).toEqual([3, 3, 6, 6, 9, 9, 12, 15, 18]);
  });

  it('holds at 18 games for every week past the ramp', () => {
    expect(getMinGamesForWeek(10)).toBe(18);
    expect(getMinGamesForWeek(11)).toBe(18);
    expect(getMinGamesForWeek(99)).toBe(18);
  });

  it('never demands more games than a bowler could have bowled by that week', () => {
    for (let week = 1; week <= 11; week++) {
      expect(getMinGamesForWeek(week)).toBeLessThanOrEqual(week * 3);
    }
  });
});
