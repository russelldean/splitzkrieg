import { describe, it, expect } from 'vitest';
import { ordinal, rankAmong, seasonRankPhrase, clubPhrase, fastestPhrase, milestoneLabel, buildWeekDraft, type DraftInput } from './draft';

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

const base: DraftInput = {
  bowlersOfWeek: [{ bowlerName: 'Vance Woods', teamName: 'HOT FUN', handSeries: 741, seasonRank: { rank: 3, tied: false } }],
  teamOfWeek: { teamName: 'Wild Llamas', hcpSeries: 2813, seasonRank: { rank: 1, tied: false } },
  personalBests: { highGames: 6, highSeries: 7 },
  milestones: [
    { bowlerName: 'Mark Oates', category: 'totalPins', threshold: 100000, club: { rank: 14, tied: false }, fastest: { rank: 9, tied: false } },
    { bowlerName: 'Kelly Shirley', category: 'totalGames', threshold: 250, club: { rank: 90, tied: true }, fastest: null },
  ],
};

describe('buildWeekDraft', () => {
  it('writes all four sections in Russ\'s format', () => {
    expect(buildWeekDraft(base)).toBe(
      [
        '**Bowler of the Week**: <bowler>Vance Woods</bowler> (HOT FUN) - 741 handicap series (3rd best of the season)',
        '',
        '**Team of the Week**: <team>Wild Llamas</team> - 2,813 handicap series (best of the season so far)',
        '',
        '**Personal Bests**: 6 all-time high games, 7 all-time high series, see below',
        '',
        '**Career Milestones**',
        '',
        '   - <bowler>Mark Oates</bowler> - 100,000 career pins, #14 in the club, 9th fastest',
        '   - <bowler>Kelly Shirley</bowler> - 250 career games, tied for #90 in the club',
        '',
      ].join('\n'),
    );
  });

  it('drops the season rank clause outside the top 10', () => {
    const out = buildWeekDraft({
      ...base,
      bowlersOfWeek: [{ ...base.bowlersOfWeek[0], seasonRank: { rank: 12, tied: false } }],
    });
    expect(out).toContain('(HOT FUN) - 741 handicap series\n');
  });

  it('joins tied bowlers of the week with "and"', () => {
    const out = buildWeekDraft({
      ...base,
      bowlersOfWeek: [
        { bowlerName: 'A One', teamName: 'T1', handSeries: 700, seasonRank: { rank: 20, tied: true } },
        { bowlerName: 'B Two', teamName: 'T2', handSeries: 700, seasonRank: { rank: 20, tied: true } },
      ],
    });
    expect(out).toContain('**Bowlers of the Week**: <bowler>A One</bowler> (T1) and <bowler>B Two</bowler> (T2) - 700 handicap series');
  });

  it('drops a zero personal-best clause, and the line when both are zero', () => {
    expect(buildWeekDraft({ ...base, personalBests: { highGames: 0, highSeries: 2 } }))
      .toContain('**Personal Bests**: 2 all-time high series, see below');
    expect(buildWeekDraft({ ...base, personalBests: { highGames: 1, highSeries: 0 } }))
      .toContain('**Personal Bests**: 1 all-time high game, see below');
    expect(buildWeekDraft({ ...base, personalBests: { highGames: 0, highSeries: 0 } }))
      .not.toContain('Personal Bests');
  });

  it('drops the milestones section when there are none', () => {
    expect(buildWeekDraft({ ...base, milestones: [] })).not.toContain('Career Milestones');
  });

  it('omits BOTW and TOTW lines when there is nothing to report', () => {
    const out = buildWeekDraft({ ...base, bowlersOfWeek: [], teamOfWeek: null });
    expect(out).not.toContain('of the Week');
  });

  it('never contains an em dash', () => {
    expect(buildWeekDraft(base)).not.toMatch(/\u2014/);
  });
});
