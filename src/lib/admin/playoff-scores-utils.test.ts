import { describe, it, expect } from 'vitest';
import { rollupTeamTotals, flagAlternates } from './playoff-scores-utils';

describe('rollupTeamTotals', () => {
  it('sums three bowlers into team game and series totals', () => {
    const rows = [
      { bowlerID: 1, game1: 200, game2: 210, game3: 190, incomingAvg: 180 },
      { bowlerID: 2, game1: 150, game2: 160, game3: 170, incomingAvg: 150 },
      { bowlerID: 3, game1: 220, game2: 180, game3: 200, incomingAvg: 200 },
    ];
    const result = rollupTeamTotals(rows);
    expect(result.scratch).toEqual({ game1: 570, game2: 550, game3: 560, series: 1680 });
  });

  it('returns zeros for an empty lineup', () => {
    expect(rollupTeamTotals([])).toEqual({
      scratch: { game1: 0, game2: 0, game3: 0, series: 0 },
    });
  });

  it('treats null games as zero', () => {
    const rows = [
      { bowlerID: 1, game1: 200, game2: null, game3: 190, incomingAvg: 180 },
      { bowlerID: 2, game1: null, game2: 160, game3: null, incomingAvg: 150 },
    ];
    const result = rollupTeamTotals(rows);
    expect(result.scratch).toEqual({ game1: 200, game2: 160, game3: 190, series: 550 });
  });
});

describe('flagAlternates', () => {
  it('flags bowlers who bowled but are not in the qualifier list', () => {
    const bowled = [{ bowlerID: 1 }, { bowlerID: 2 }, { bowlerID: 3 }];
    const qualifiers = [{ bowlerID: 1 }, { bowlerID: 2 }];
    const result = flagAlternates(bowled, qualifiers);
    expect(result).toEqual([
      { bowlerID: 1, isAlternate: false },
      { bowlerID: 2, isAlternate: false },
      { bowlerID: 3, isAlternate: true },
    ]);
  });

  it('returns no alternates when qualifier and bowled sets match', () => {
    const bowled = [{ bowlerID: 1 }, { bowlerID: 2 }];
    const qualifiers = [{ bowlerID: 1 }, { bowlerID: 2 }];
    expect(flagAlternates(bowled, qualifiers).every(r => !r.isAlternate)).toBe(true);
  });
});
