import { describe, it, expect } from 'vitest';
import { ordinal, rankAmong, seasonRankPhrase, clubPhrase, fastestPhrase, milestoneLabel } from './draft';

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

describe('seasonRankPhrase', () => {
  it('is null outside the top 10', () => {
    expect(seasonRankPhrase({ rank: 11, tied: false })).toBeNull();
  });
  it('reads "best of the season so far" for 1st', () => {
    expect(seasonRankPhrase({ rank: 1, tied: false })).toBe('best of the season so far');
  });
  it('reads "tied for best" for a shared 1st', () => {
    expect(seasonRankPhrase({ rank: 1, tied: true })).toBe('tied for best of the season so far');
  });
  it('reads "3rd best of the season"', () => {
    expect(seasonRankPhrase({ rank: 3, tied: false })).toBe('3rd best of the season');
  });
  it('reads "tied for 10th best of the season"', () => {
    expect(seasonRankPhrase({ rank: 10, tied: true })).toBe('tied for 10th best of the season');
  });
});

describe('clubPhrase', () => {
  it('reads "#91 in the club"', () => {
    expect(clubPhrase({ rank: 91, tied: false })).toBe('#91 in the club');
  });
  it('reads "tied for #90 in the club"', () => {
    expect(clubPhrase({ rank: 90, tied: true })).toBe('tied for #90 in the club');
  });
});

describe('fastestPhrase', () => {
  it('reads "9th fastest"', () => {
    expect(fastestPhrase({ rank: 9, tied: false })).toBe('9th fastest');
  });
  it('reads "fastest ever" for 1st', () => {
    expect(fastestPhrase({ rank: 1, tied: false })).toBe('fastest ever');
  });
  it('reads "tied for 4th fastest"', () => {
    expect(fastestPhrase({ rank: 4, tied: true })).toBe('tied for 4th fastest');
  });
  it('reads "tied for fastest ever" for a shared 1st', () => {
    expect(fastestPhrase({ rank: 1, tied: true })).toBe('tied for fastest ever');
  });
});

describe('milestoneLabel', () => {
  it.each([
    ['totalGames', 250, '250 career games'],
    ['totalPins', 100000, '100,000 career pins'],
    ['totalTurkeys', 100, '100 career turkeys'],
    ['games200Plus', 25, '25 200 games'],
    ['series600Plus', 10, '10 600 series'],
  ] as const)('%s %i -> %s', (category, threshold, label) => {
    expect(milestoneLabel(category, threshold)).toBe(label);
  });
});
