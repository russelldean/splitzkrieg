import { describe, it, expect } from 'vitest';
import { ordinal, rankAmong } from './draft';

describe('ordinal', () => {
  it.each([
    [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'],
    [11, '11th'], [12, '12th'], [13, '13th'],
    [21, '21st'], [22, '22nd'], [23, '23rd'],
    [101, '101st'], [111, '111th'], [112, '112th'],
  ])('%i -> %s', (n, s) => {
    expect(ordinal(n)).toBe(s);
  });
});

describe('rankAmong', () => {
  it('ranks highest first by default', () => {
    expect(rankAmong(741, [700, 741, 760, 650])).toEqual({ rank: 2, tied: false });
  });

  it('marks a tie when another value is equal', () => {
    expect(rankAmong(741, [741, 741, 760])).toEqual({ rank: 2, tied: true });
  });

  it('counts the value itself once even if it is in the list', () => {
    expect(rankAmong(800, [800])).toEqual({ rank: 1, tied: false });
  });

  it('ranks lowest first when asked (fastest = fewest games)', () => {
    expect(rankAmong(300, [280, 300, 300, 350], 'asc')).toEqual({ rank: 2, tied: true });
  });
});
