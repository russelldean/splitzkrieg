import { describe, it, expect } from 'vitest';
import { countGames, nightRecordStr } from './game-record';

describe('countGames', () => {
  it('counts wins, losses, and ties across three games', () => {
    expect(countGames([180, 150, 200], [170, 160, 200])).toEqual({ w: 1, l: 1, t: 1 });
  });

  it('handles a 2-1-0 night', () => {
    expect(countGames([180, 190, 150], [170, 160, 200])).toEqual({ w: 2, l: 1, t: 0 });
  });

  it('skips games with null totals (unplayed)', () => {
    expect(countGames([180, null, null], [170, null, null])).toEqual({ w: 1, l: 0, t: 0 });
  });
});

describe('nightRecordStr', () => {
  it('formats as W-L-T', () => {
    expect(nightRecordStr([180, 190, 150], [170, 160, 200])).toBe('2-1-0');
  });
});
