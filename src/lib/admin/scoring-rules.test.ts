import { describe, it, expect } from 'vitest';
import { bonusPoints } from './scoring-rules';

/**
 * bonusPoints was 15 anonymous lines inside runMatchResults, a 234-line
 * database function with no tests. The behaviour below was verified against
 * every stored bonus value in the database before these were written: 5,991
 * values across 36 seasons, 15 of them containing forfeits, all reproduced
 * exactly. So these pin what the league has always done, not what looks right.
 */

/** n teams with descending series, so position maps to teamID. */
function ladder(n: number, start = 900, step = 10) {
  return Array.from({ length: n }, (_, i) => ({ teamID: i + 1, series: start - i * step }));
}

describe('bonusPoints', () => {
  it('awards 3 to the top five, 2 to the next five, 1 to the next five', () => {
    const b = bonusPoints(ladder(20));
    expect([1, 2, 3, 4, 5].map((t) => b.get(t))).toEqual([3, 3, 3, 3, 3]);
    expect([6, 7, 8, 9, 10].map((t) => b.get(t))).toEqual([2, 2, 2, 2, 2]);
    expect([11, 12, 13, 14, 15].map((t) => b.get(t))).toEqual([1, 1, 1, 1, 1]);
    expect([16, 17, 18, 19, 20].map((t) => b.get(t))).toEqual([0, 0, 0, 0, 0]);
  });

  it('gives every tied team the better bonus', () => {
    // Three teams tied on the 5th-place score: all three take 3, because the
    // comparison is >= against the score at the cutoff, not the position.
    const teams = [
      { teamID: 1, series: 900 }, { teamID: 2, series: 890 },
      { teamID: 3, series: 880 }, { teamID: 4, series: 870 },
      { teamID: 5, series: 870 }, { teamID: 6, series: 870 },
      ...Array.from({ length: 14 }, (_, i) => ({ teamID: 10 + i, series: 800 - i })),
    ];
    const b = bonusPoints(teams);
    expect(b.get(4)).toBe(3);
    expect(b.get(5)).toBe(3);
    expect(b.get(6)).toBe(3);
  });

  it('a league-wide tie gives everyone 3', () => {
    const b = bonusPoints(ladder(20, 800, 0));
    expect([...b.values()].every((v) => v === 3)).toBe(true);
  });

  it('awards no 1-point band below fifteen teams', () => {
    // A bye or a split night. The 15th-place cutoff does not exist, so nobody
    // can take the bottom band, but the 3 and 2 bands still apply.
    const b = bonusPoints(ladder(12));
    expect(b.get(1)).toBe(3);
    expect(b.get(10)).toBe(2);
    expect(b.get(11)).toBe(0);
    expect(b.get(12)).toBe(0);
    expect([...b.values()]).not.toContain(1);
  });

  it('awards no 2-point band below ten teams', () => {
    const b = bonusPoints(ladder(7));
    expect(b.get(5)).toBe(3);
    expect(b.get(6)).toBe(0);
    expect([...b.values()]).not.toContain(2);
  });

  it('awards nothing below five teams', () => {
    const b = bonusPoints(ladder(4));
    expect([...b.values()]).toEqual([0, 0, 0, 0]);
  });

  it('returns an entry for every team it was given', () => {
    expect(bonusPoints(ladder(20)).size).toBe(20);
  });

  it('handles an empty week without throwing', () => {
    expect(bonusPoints([]).size).toBe(0);
  });

  it('does not reorder the caller\'s array', () => {
    const teams = [
      { teamID: 1, series: 700 },
      { teamID: 2, series: 900 },
    ];
    bonusPoints(teams);
    expect(teams.map((t) => t.teamID)).toEqual([1, 2]);
  });
});
