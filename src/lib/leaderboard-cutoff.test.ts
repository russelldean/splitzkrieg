import { describe, it, expect } from 'vitest';
import { cutoffIndex, playoffQualifiers } from './leaderboard-cutoff';

/** Minimal shape the cutoff helpers care about. Values must be sorted descending. */
const entries = (...values: number[]) =>
  values.map((value, i) => ({ bowlerID: i + 1, value }));

describe('cutoffIndex', () => {
  it('returns the list length when there are fewer entries than the cutoff size', () => {
    expect(cutoffIndex([210, 205, 200], 8)).toBe(3);
  });

  it('returns the list length when the list is exactly the cutoff size', () => {
    expect(cutoffIndex([8, 7, 6, 5, 4, 3, 2, 1], 8)).toBe(8);
  });

  it('returns the cutoff size when the entry past the cutoff does not tie', () => {
    expect(cutoffIndex([8, 7, 6, 5, 4, 3, 2, 1, 0], 8)).toBe(8);
  });

  it('extends through a single tie at the cutoff value', () => {
    expect(cutoffIndex([8, 7, 6, 5, 4, 3, 2, 1, 1], 8)).toBe(9);
  });

  it('extends through every entry tied at the cutoff value', () => {
    expect(cutoffIndex([8, 7, 6, 5, 4, 3, 2, 1, 1, 1, 0], 8)).toBe(10);
  });

  it('extends past the cutoff without running off the end of the list', () => {
    expect(cutoffIndex([5, 5, 5, 5], 2)).toBe(4);
  });

  it('returns 0 for an empty list', () => {
    expect(cutoffIndex([], 8)).toBe(0);
  });
});

describe('playoffQualifiers', () => {
  it('qualifies everyone when the field is smaller than the cutoff', () => {
    expect(playoffQualifiers(entries(210, 205), 8)).toEqual(new Set([1, 2]));
  });

  it('qualifies exactly the top 8 when the 9th does not tie', () => {
    const ids = playoffQualifiers(entries(216, 215, 214, 213, 212, 211, 210, 209, 208), 8);
    expect(ids).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
  });

  it('qualifies a 9th bowler tied at the 8th value', () => {
    const ids = playoffQualifiers(entries(216, 215, 214, 213, 212, 211, 210, 209, 209), 8);
    expect(ids).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  });

  it('defaults to a cutoff of 8', () => {
    const ids = playoffQualifiers(entries(9, 8, 7, 6, 5, 4, 3, 2, 1));
    expect(ids.size).toBe(8);
  });

  it('returns an empty set for an empty field', () => {
    expect(playoffQualifiers([], 8)).toEqual(new Set());
  });
});
