import { describe, it, expect } from 'vitest';
import {
  careerNightsLadder, slotProfile, rankDebut, rankWithin, nightPinsFor, bestNightContextFor, highGameContextFor, findBigSwing, teamStintsFor, styleFor, seasonPinTotals, rankSwing, findHighGame, rankOwnSeasons, assembleWrapped, computeTenure, nightStreaks,
  BOWLER_WRAPPED_BOWLER_SQL, BOWLER_WRAPPED_SEASON_SQL, mergeRecordsets, SEASON_RECORDSET_SLOTS, WRAPPED_RECORDSET_COUNT,
  type LeagueBowlerRow, type WrappedWeek, type WrappedSeasonRow,
} from './bowler-wrapped';

const league = (rows: Array<Partial<LeagueBowlerRow> & { bowlerID: number; bowlerName: string }>): LeagueBowlerRow[] =>
  rows.map(r => ({ slug: r.bowlerName.toLowerCase().replace(' ', '-'), nights: 8, games: 24, pins: 0, average: 0, turkeys: 0, highGame: 0, highSeries: 0, ...r }));

const week = (w: Partial<WrappedWeek> & { week: number }): WrappedWeek => ({
  matchDate: null, game1: null, game2: null, game3: null, scratchSeries: null, turkeys: 0,
  incomingAvg: null, incomingHcp: null, teamID: 18, opponentName: null, opponentSlug: null,
  teamGamePts: null, oppGamePts: null, teamSeries: null, teamBestSeries: null, handSeries: null, teamBestHandSeries: null, ...w,
});

describe('the two batches', () => {
  const split = (sql: string) => sql.split(';\n').filter(s => s.trim());
  it('per-bowler batch is every statement keyed on @bowlerID, per-season batch has none', () => {
    const bowler = split(BOWLER_WRAPPED_BOWLER_SQL);
    const season = split(BOWLER_WRAPPED_SEASON_SQL);
    expect(bowler.length + season.length).toBe(WRAPPED_RECORDSET_COUNT);
    expect(season).toHaveLength(SEASON_RECORDSET_SLOTS.length);
    for (const s of bowler) expect(s).toContain('@bowlerID');
    for (const s of season) expect(s).not.toContain('@bowlerID');
    for (const s of season) expect(s).toContain('@seasonID');
  });
  it('mergeRecordsets interleaves the season slots back into the assembler order', () => {
    const bowler = Array.from({ length: WRAPPED_RECORDSET_COUNT - SEASON_RECORDSET_SLOTS.length }, (_, i) => [`b${i}`]);
    const season = SEASON_RECORDSET_SLOTS.map((_, i) => [`s${i}`]);
    const merged = mergeRecordsets(bowler, season);
    expect(merged).toHaveLength(WRAPPED_RECORDSET_COUNT);
    expect(merged[3]).toEqual(['s0']);
    expect(merged[5]).toEqual(['s1']);
    expect(merged[17]).toEqual(['s6']);
    expect(merged[0]).toEqual(['b0']);
    expect(merged[4]).toEqual(['b3']);
    expect(merged[19]).toEqual(['b12']);
  });
});

describe('rankWithin', () => {
  const field = league([
    { bowlerID: 1, bowlerName: 'Steve', pins: 5008 },
    { bowlerID: 2, bowlerName: 'Erin', pins: 4826 },
    { bowlerID: 3, bowlerName: 'Alex', pins: 4532 },
    { bowlerID: 4, bowlerName: 'Russ', pins: 4285 },
    { bowlerID: 5, bowlerName: 'Mike', pins: 4278 },
  ]);
  it('ranks 1 = most, with the neighbors on either side', () => {
    const r = rankWithin(field, 'pins', 4);
    expect(r.rank).toBe(4);
    expect(r.field).toBe(5);
    expect(r.above.map(n => n.bowlerName)).toEqual(['Alex']);
    expect(r.below.map(n => n.bowlerName)).toEqual(['Mike']);
    expect(r.tiedWith).toEqual([]);
  });
  it('shares a rank on ties and lists who is tied', () => {
    const tied = league([
      { bowlerID: 4, bowlerName: 'Russ', turkeys: 11 },
      { bowlerID: 1, bowlerName: 'Steve', turkeys: 10 },
      { bowlerID: 2, bowlerName: 'Erin', turkeys: 10 },
      { bowlerID: 3, bowlerName: 'Alex', turkeys: 8 },
    ]);
    const steve = rankWithin(tied, 'turkeys', 1);
    expect(steve.rank).toBe(2);
    expect(steve.tiedWith.map(t => t.bowlerName)).toEqual(['Erin']);
    expect(steve.above.map(n => n.bowlerName)).toEqual(['Russ']);
    expect(steve.below[0].rank).toBe(4);
    expect(steve.below.map(n => n.bowlerName)).toEqual(['Alex']);
    const russ = rankWithin(tied, 'turkeys', 4);
    expect(russ.rank).toBe(1);
    expect(russ.above).toEqual([]);
    expect(russ.below.map(n => n.bowlerName)).toEqual(['Erin', 'Steve']);
  });
});

describe('findBigSwing / findHighGame', () => {
  const weeks = [
    week({ week: 1, game1: 194, game2: 146, game3: 204 }),
    week({ week: 7, game1: 168, game2: 155, game3: 216 }),
    week({ week: 2, game1: 190, game2: 226, game3: 155 }),
  ];
  it('finds the biggest swing either way, here a 71-pin drop', () => {
    expect(findBigSwing(weeks)).toEqual({ week: 2, fromGame: 2, from: 226, to: 155, gap: -71 });
  });
  it('a tie between a climb and a drop goes to the climb', () => {
    expect(findBigSwing([week({ week: 1, game1: 200, game2: 150, game3: 200 })])?.gap).toBe(50);
  });
  it('finds the high game and which game it was', () => {
    expect(findHighGame(weeks)).toEqual({ score: 226, week: 2, gameNo: 2 });
  });
  it('null with no consecutive games', () => {
    expect(findBigSwing([week({ week: 1, game1: 200, game2: null, game3: 160 })])).toBeNull();
  });
  it('ranks the swing among league swings in the same direction', () => {
    const scores = [
      { game1: 100, game2: 200, game3: 100 },   // +100 then -100
      { game1: 150, game2: 170, game3: 160 },   // +20 then -10
    ];
    const r = rankSwing({ week: 7, fromGame: 2, from: 155, to: 216, gap: 61 }, scores)!;
    expect(r.leagueRank).toBe(2);
    expect(r.leagueField).toBe(2);
    expect(rankSwing(null, scores)).toBeNull();
  });
});

describe('rankOwnSeasons', () => {
  const s = (seasonID: number, average: number): WrappedSeasonRow =>
    ({ seasonID, romanNumeral: String(seasonID), displayName: '', nights: 8, games: 24, pins: 0, average, highSeries: 0, turkeys: 0 });
  it('ranks by average and names the last season that was as good', () => {
    const r = rankOwnSeasons([s(27, 188.1), s(28, 179.1), s(29, 170.5), s(34, 173.1), s(35, 158.8), s(36, 178.5)], 36);
    expect(r.rank).toBe(3);
    expect(r.total).toBe(6);
    expect(r.bestSince?.seasonID).toBe(28);
    expect(r.previous?.seasonID).toBe(35);
  });
  it('no bestSince when the immediately previous season was as good', () => {
    const r = rankOwnSeasons([s(35, 180), s(36, 178.5)], 36);
    expect(r.bestSince).toBeNull();
  });
});

describe('assembleWrapped', () => {
  const recordsets = () => [
    [{ bowlerID: 548, bowlerName: 'Russ Dean', slug: 'russ-dean', seasonID: 36, romanNumeral: 'XXXVI', displayName: 'Fall 2026', weekCount: 9, leagueSeasonCount: 36 }],
    [
      week({ week: 1, game1: 194, game2: 146, game3: 204, scratchSeries: 544, turkeys: 2, incomingAvg: 162, incomingHcp: 59, teamGamePts: 4, oppGamePts: 2, teamBestSeries: 555 }),
      week({ week: 6, game1: 191, game2: 212, game3: 170, scratchSeries: 573, turkeys: 1, incomingAvg: 168, incomingHcp: 54, teamGamePts: 6, oppGamePts: 0, teamBestSeries: 573 }),
      week({ week: 9, game1: 161, game2: 166, game3: null, scratchSeries: 327, turkeys: 0, incomingAvg: 176, incomingHcp: 46, teamGamePts: 2, oppGamePts: 4, teamBestSeries: 501 }),
    ],
    [{ seasonID: 35, romanNumeral: 'XXXV', displayName: 'Spring 2026', nights: 8, games: 24, pins: 3811, average: 158.8, highSeries: 510, turkeys: 4 },
     { seasonID: 36, romanNumeral: 'XXXVI', displayName: 'Fall 2026', nights: 3, games: 8, pins: 1444, average: 180.5, highSeries: 573, turkeys: 3 }],
    league([
      { bowlerID: 548, bowlerName: 'Russ Dean', games: 24, pins: 1444, average: 180.5, turkeys: 3, highGame: 212 },
      { bowlerID: 1, bowlerName: 'Steve', games: 27, pins: 5008, average: 185.5, turkeys: 10, highGame: 256 },
      { bowlerID: 2, bowlerName: 'Sub', games: 6, pins: 1300, average: 216.7, turkeys: 0, highGame: 230 },
    ]),
    [{ bowlerID: 9, bowlerName: 'Christina Manzella', slug: 'christina-manzella', nightsTogether: 7 }],
    [{ teamID: 18, teamName: 'Lucky Strikes', slug: 'lucky-strikes', divisionName: 'Division A', wins: 32, xp: 19, matches: 9 },
     { teamID: 3, teamName: 'Stinky Cheese', slug: 'stinky-cheese', divisionName: 'Division A', wins: 36, xp: 18, matches: 9 },
     { teamID: 7, teamName: 'HOT FUN', slug: 'hot-fun', divisionName: 'Division B', wins: 42, xp: 22, matches: 9 }],
    [{ code: 'highSeries', week: 6 }],
    [],
    [{ firstNight: new Date('2017-01-16'), leagueFirstNight: new Date('2007-04-16'), seasonLastNight: new Date('2026-11-02'), careerNights: 150, leagueNightsSinceFirst: 170, lastNight: new Date('2026-11-02') }],
    [{ song: 'Bad and Boujee', artist: 'Migos featuring Lil Uzi Vert', film: 'Hidden Figures' }],
    [{ bowlerID: 7, bowlerName: 'Amy Kostrewa', slug: 'amy-kostrewa', isActive: true }],
    [
      { seasonID: 35, romanNumeral: 'XXXV', week: 8, matchDate: new Date('2026-04-27'), bowled: 1 },
      { seasonID: 35, romanNumeral: 'XXXV', week: 9, matchDate: new Date('2026-05-04'), bowled: 1 },
      { seasonID: 36, romanNumeral: 'XXXVI', week: 1, matchDate: new Date('2026-07-13'), bowled: 0 },
      { seasonID: 36, romanNumeral: 'XXXVI', week: 2, matchDate: new Date('2026-07-20'), bowled: 1 },
    ],
    [{ bowlersInWindow: 101, bowlersBelow: 98 }],
    [
      { bowlerID: 7, bowlerName: 'Amy Kostrewa', slug: 'amy-kostrewa', nights: 300 },
      { bowlerID: 1, bowlerName: 'Steve', slug: 'steve', nights: 151 },
      { bowlerID: 548, bowlerName: 'Russ Dean', slug: 'russ-dean', nights: 150 },
      { bowlerID: 9, bowlerName: 'Christina Manzella', slug: 'christina-manzella', nights: 150 },
      { bowlerID: 2, bowlerName: 'Sub', slug: 'sub', nights: 3 },
    ],
    [{ avg1: 150.2, avg2: 152.8, avg3: 154.1 }],
    [
      { bowlerID: 1, bowlerName: 'Steve', slug: 'steve', seasonID: 3, romanNumeral: 'III', games: 30, average: 190.1 },
      { bowlerID: 548, bowlerName: 'Russ Dean', slug: 'russ-dean', seasonID: 35, romanNumeral: 'XXXV', games: 24, average: 158.8 },
      { bowlerID: 2, bowlerName: 'Sub', slug: 'sub', seasonID: 36, romanNumeral: 'XXXVI', games: 6, average: 216.7 },
    ],
    [
      { week: 6, bowlerID: 548, bowlerName: 'Russ Dean', bowlerSlug: 'russ-dean', teamID: 18, teamName: 'Lucky Strikes', game1: 191, game2: 212, game3: 170, incomingHcp: 54 },
      { week: 6, bowlerID: 1, bowlerName: 'Steve', bowlerSlug: 'steve', teamID: 3, teamName: 'Stinky Cheese', game1: 200, game2: 200, game3: 200, incomingHcp: 30 },
    ],
    [
      { week: 6, homeTeamID: 18, awayTeamID: 3, team1Game1: 900, team1Game2: 900, team1Game3: 900, team1Series: 2700, team2Game1: 880, team2Game2: 880, team2Game3: 880, team2Series: 2640 },
    ],
    [
      { seasonID: 28, week: 3, scratchSeries: 640 },
      { seasonID: 36, week: 6, scratchSeries: 573 },
      { seasonID: 35, week: 2, scratchSeries: 510 },
    ],
    [
      { seasonID: 28, romanNumeral: 'XXVIII', week: 3, matchDate: new Date('2022-03-14'), game1: 224, game2: 210, game3: 206 },
      { seasonID: 35, romanNumeral: 'XXXV', week: 2, matchDate: new Date('2026-03-16'), game1: 170, game2: 170, game3: 170 },
      { seasonID: 36, romanNumeral: 'XXXVI', week: 1, matchDate: new Date('2026-07-13'), game1: 194, game2: 146, game3: 204 },
      { seasonID: 36, romanNumeral: 'XXXVI', week: 6, matchDate: new Date('2026-08-17'), game1: 191, game2: 212, game3: 170 },
      { seasonID: 36, romanNumeral: 'XXXVI', week: 9, matchDate: new Date('2026-09-07'), game1: 161, game2: 166, game3: null },
    ],
  ];
  it('derives totals, divides by games actually bowled, and builds the team card', () => {
    const v = assembleWrapped(recordsets() as unknown[][])!;
    expect(v.games).toBe(8);
    expect(v.pins).toBe(1444);
    expect(v.average).toBe(180.5);
    expect(v.turkeys).toBe(3);
    expect(v.turkeyNights).toBe(2);
    expect(v.startingAvg).toBe(162);
    expect(v.endingAvg).toBe(176);
    expect(v.bestNight?.week).toBe(6);
    expect(v.seasonNumber).toBe(2);
    expect(v.ranks.pins.rank).toBe(2);
    // week 9 => 18-game minimum, so the 6-game sub drops out of the average field only
    expect(v.ranks.average.rank).toBe(2);
    expect(v.ranks.average.field).toBe(2);
    expect(v.ranks.highGame.field).toBe(3);
    expect(v.team?.place).toBe(2);
    expect(v.team?.divisionSize).toBe(2);
    expect(v.team?.losses).toBe(22);
    expect(v.team?.matchRecordWithMe).toEqual({ won: 12, lost: 6 });
    expect(v.team?.nightsAsTeamBest).toBe(1);
    expect(v.tenure.pctOfHistory).toBe(50);
    expect(v.tenure.careerNights).toBe(150);
    expect(v.tenure.leagueNightsSinceFirst).toBe(170);
    expect(v.firstNightCulture).toEqual({ song: 'Bad and Boujee', artist: 'Migos featuring Lil Uzi Vert' });
    expect(v.firstNightFilm).toBe('Hidden Figures');
    expect(v.firstNightClassmates.map(c => c.slug)).toEqual(['amy-kostrewa']);
    expect(v.attendance.pctBowlersBelow).toBe(98);
    expect(v.bestNight?.week).toBe(6);
    expect(v.bestNightContext?.careerRank).toBe(2);
    expect(v.bestNightContext?.careerNights).toBe(3);
    expect(v.bestNightContext?.otherNightsAvg).toBe(436);
    // Russ's 245/266/224 handicap games carried a 20-pin-a-game match; a blind 199 loses all three.
    expect(v.bestNightContext?.pin?.pin).toBe(6);
    expect(v.nightPins).toHaveLength(1);
    expect(v.style?.impact.total).toBe(6);
    expect(v.style?.aboveBelow.basis).toBe('book');
    // Fixture games vs book: w1 (162): 194 146 204 -> 2 up 1 down; w6 (168): 191 212 170 -> 3 up; w9 (176): 161 166 -> 2 down.
    expect(v.style?.aboveBelow).toMatchObject({ above: 5, below: 3, even: 0 });
    expect(v.highGame).toEqual({ score: 212, week: 6, gameNo: 2 });
    expect(v.highGameContext?.careerRank).toBe(2);
    expect(v.highGameContext?.careerGames).toBe(14);
    expect(v.highGameContext?.games200).toBe(2);
    expect(v.highGameContext?.lastAsGood?.score).toBe(224);
    expect(v.highGameContext?.lastAsGood?.romanNumeral).toBe('XXVIII');
    expect(v.attendance.pctOfNights).toBe(75);
    expect(v.attendance.longestStreak?.length).toBe(2);
    expect(v.attendance.currentStreak).toBe(1);
  });
  it('still assembles the career cards when the bowler sat this season out', () => {
    const rs = recordsets();
    rs[1] = [];
    const v = assembleWrapped(rs as unknown[][])!;
    expect(v.nights).toBe(0);
    expect(v.pins).toBe(0);
    expect(v.bestNight).toBeNull();
    expect(v.team).toBeNull();
    expect(v.tenure.careerNights).toBe(150);
  });
  it('null when the bowler has never bowled', () => {
    const rs = recordsets();
    rs[1] = []; rs[2] = [];
    expect(assembleWrapped(rs as unknown[][])).toBeNull();
  });
});

describe('computeTenure', () => {
  it('night one of the league is 100% of its history', () => {
    const t = computeTenure(new Date('2007-04-16'), new Date('2007-04-16'), new Date('2026-11-02'));
    expect(t.pctOfHistory).toBe(100);
  });
  it('null when any date is missing', () => {
    expect(computeTenure(null, new Date('2007-04-16'), new Date('2026-11-02')).pctOfHistory).toBeNull();
  });
});

describe('nightStreaks', () => {
  const n = (week: number, bowled: 0 | 1) => ({ seasonID: 36, romanNumeral: 'XXXVI', week, matchDate: new Date(2026, 6, week), bowled });
  it('finds the longest run and the run still alive', () => {
    const r = nightStreaks([n(1, 1), n(2, 1), n(3, 1), n(4, 0), n(5, 1), n(6, 1)]);
    expect(r.longest).toEqual({ length: 3, from: new Date(2026, 6, 1), to: new Date(2026, 6, 3) });
    expect(r.current).toBe(2);
  });
  it('current is 0 after a missed night, longest null with no nights bowled', () => {
    expect(nightStreaks([n(1, 1), n(2, 0)]).current).toBe(0);
    expect(nightStreaks([n(1, 0)]).longest).toBeNull();
  });
});

describe('careerNightsLadder', () => {
  const rows = [
    { bowlerID: 7, bowlerName: 'Amy', slug: 'amy', nights: 300 },
    { bowlerID: 1, bowlerName: 'Steve', slug: 'steve', nights: 151 },
    { bowlerID: 548, bowlerName: 'Russ', slug: 'russ', nights: 150 },
    { bowlerID: 9, bowlerName: 'Christina', slug: 'christina', nights: 150 },
    { bowlerID: 2, bowlerName: 'Sub', slug: 'sub', nights: 3 },
  ];
  it('ranks with shared ties and finds the neighbors either side', () => {
    const r = careerNightsLadder(rows, 548);
    expect(r.rank).toBe(3);
    expect(r.total).toBe(5);
    expect(r.tiedWith).toBe(1);
    expect(r.rankAfterOneMore).toBe(2);
    expect(r.above).toMatchObject({ bowlerName: 'Steve', nights: 151, rank: 2 });
    expect(r.below).toMatchObject({ bowlerName: 'Sub', nights: 3 });
  });
  it('top of the list has nobody above and keeps rank 1 after one more', () => {
    const r = careerNightsLadder(rows, 7);
    expect(r.rank).toBe(1);
    expect(r.above).toBeNull();
    expect(r.rankAfterOneMore).toBe(1);
    expect(r.below?.bowlerName).toBe('Steve');
  });
  it('a bowler missing from the list ranks last of total + 1 with 0 nights', () => {
    const r = careerNightsLadder(rows, 999);
    expect(r.rank).toBe(6);
    expect(r.total).toBe(6);
    expect(r.rankAfterOneMore).toBe(6);
    expect(r.below).toBeNull();
  });
});

describe('slotProfile', () => {
  it('averages each game slot, skipping unbowled games, and classifies the shape', () => {
    const p = slotProfile([
      week({ week: 1, game1: 160, game2: 170, game3: 190 }),
      week({ week: 2, game1: 150, game2: 170, game3: null }),
    ], { avg1: 150, avg2: 152, avg3: 154 })!;
    expect(p.avg1).toBe(155);
    expect(p.avg2).toBe(170);
    expect(p.avg3).toBe(190);
    expect(p.bestGame).toBe(3);
    expect(p.archetype).toBe('Late Bloomer');
    expect(p.league?.avg3).toBe(154);
  });
  it('null without a full set of slots', () => {
    expect(slotProfile([week({ week: 1, game1: 160, game2: null, game3: null })], undefined)).toBeNull();
  });
});

describe('rankDebut', () => {
  const rows = [
    { bowlerID: 1, bowlerName: 'Steve', slug: 'steve', seasonID: 3, romanNumeral: 'III', games: 30, average: 190.1 },
    { bowlerID: 637, bowlerName: 'Ben Rice', slug: 'ben-rice', seasonID: 36, romanNumeral: 'XXXVI', games: 18, average: 167.5 },
    { bowlerID: 2, bowlerName: 'Sub', slug: 'sub', seasonID: 36, romanNumeral: 'XXXVI', games: 6, average: 216.7 },
  ];
  it('ranks against first seasons that cleared the games line, always keeping the bowler', () => {
    const r = rankDebut(rows, 637, 18)!;
    expect(r.rank).toBe(2);
    expect(r.field).toBe(2);
    expect(r.above[0].bowlerName).toBe('Steve');
  });
  it('null when the bowler has no first-season row', () => {
    expect(rankDebut(rows, 999, 18)).toBeNull();
  });
});

describe('bestNightContextFor', () => {
  it('null without a best night', () => {
    expect(bestNightContextFor(null, [], [], [])).toBeNull();
  });
  it('one-night season has no other-nights average and ranks within the career', () => {
    const only = week({ week: 2, scratchSeries: 500 });
    const ctx = bestNightContextFor(only, [only], [{ seasonID: 36, week: 2, scratchSeries: 500 }], [])!;
    expect(ctx.otherNightsAvg).toBeNull();
    expect(ctx.careerRank).toBe(1);
    expect(ctx.pin).toBeNull();
  });
});

describe('nightPinsFor', () => {
  it('ranks the bowler among everyone with a PIN that week', () => {
    const scores = [
      { week: 1, bowlerID: 10, bowlerName: 'A', bowlerSlug: 'a', teamID: 1, teamName: 'T1', game1: 210, game2: 210, game3: 210, incomingHcp: 40 },
      { week: 1, bowlerID: 11, bowlerName: 'B', bowlerSlug: 'b', teamID: 2, teamName: 'T2', game1: 150, game2: 150, game3: 150, incomingHcp: 40 },
    ];
    const matches = [{ week: 1, homeTeamID: 1, awayTeamID: 2, team1Game1: 900, team1Game2: 900, team1Game3: 900, team1Series: 2700, team2Game1: 890, team2Game2: 890, team2Game3: 890, team2Series: 2670 }];
    const a = nightPinsFor(10, scores, matches);
    expect(a).toEqual([{ week: 1, pin: 6, rank: 1, field: 2, tiedWith: 0 }]);
    const b = nightPinsFor(11, scores, matches);
    expect(b[0].rank).toBe(2);
  });
});

describe('highGameContextFor', () => {
  const career = [
    { seasonID: 35, romanNumeral: 'XXXV', week: 2, matchDate: new Date('2026-03-16'), game1: 150, game2: 150, game3: 150 },
    { seasonID: 36, romanNumeral: 'XXXVI', week: 1, matchDate: new Date('2026-07-13'), game1: 180, game2: 160, game3: 160 },
    { seasonID: 36, romanNumeral: 'XXXVI', week: 4, matchDate: new Date('2026-08-03'), game1: 160, game2: 190, game3: 160 },
  ];
  const weeks = [week({ week: 1, game1: 180, game2: 160, game3: 160 }), week({ week: 4, game1: 160, game2: 190, game3: 160 })];
  it('a career high has nothing as good before it', () => {
    const ctx = highGameContextFor({ score: 190, week: 4, gameNo: 2 }, weeks, career, 36)!;
    expect(ctx.careerRank).toBe(1);
    expect(ctx.lastAsGood).toBeNull();
    expect(ctx.otherGamesAvg).toBe(164);
    expect(ctx.games200).toBe(0);
  });
  it('finds the most recent earlier game at least as high, including earlier this season', () => {
    const ctx = highGameContextFor({ score: 180, week: 1, gameNo: 1 }, weeks, [...career, { seasonID: 30, romanNumeral: 'XXX', week: 5, matchDate: new Date('2023-04-10'), game1: 185, game2: 100, game3: 100 }], 36)!;
    expect(ctx.lastAsGood?.romanNumeral).toBe('XXX');
  });
  it('null without a high game', () => {
    expect(highGameContextFor(null, [], [], 36)).toBeNull();
  });
});

describe('teamStintsFor', () => {
  const standings = [
    { teamID: 15, teamName: 'Hot Shotz', slug: 'hot-shotz', divisionName: 'A', wins: 26, xp: 9, matches: 9 },
    { teamID: 28, teamName: 'Sparadigm Shift', slug: 'sparadigm-shift', divisionName: 'B', wins: 30, xp: 12, matches: 9 },
  ];
  it('one stint per team, most nights first, earliest first on a tie, with the record on those nights', () => {
    const stints = teamStintsFor([
      week({ week: 2, teamID: 15, teamGamePts: 2, oppGamePts: 4, scratchSeries: 489, teamBestSeries: 489 }),
      week({ week: 4, teamID: 28, teamGamePts: 6, oppGamePts: 0, scratchSeries: 511, teamBestSeries: 600 }),
      week({ week: 3, teamID: 15, teamGamePts: 3, oppGamePts: 3 }),
      week({ week: 6, teamID: 28, teamGamePts: 4, oppGamePts: 2 }),
    ], standings);
    expect(stints.map(s => s.teamName)).toEqual(['Hot Shotz', 'Sparadigm Shift']);
    expect(stints[0]).toMatchObject({ nights: 2, record: { won: 5, lost: 7 }, nightsAsTeamBest: 1 });
    expect(stints[1].record).toEqual({ won: 10, lost: 2 });
  });
  it('a team missing from standings still gets a stint', () => {
    expect(teamStintsFor([week({ week: 1, teamID: 99 })], standings)[0].teamName).toBe('Unknown team');
  });
});

describe('styleFor / seasonPinTotals', () => {
  const scores = [
    { week: 1, bowlerID: 10, bowlerName: 'A', bowlerSlug: 'a', teamID: 1, teamName: 'T1', game1: 210, game2: 210, game3: 210, incomingHcp: 40 },
    { week: 1, bowlerID: 11, bowlerName: 'B', bowlerSlug: 'b', teamID: 2, teamName: 'T2', game1: 100, game2: 200, game3: 150, incomingHcp: 40 },
  ];
  const matches = [{ week: 1, homeTeamID: 1, awayTeamID: 2, team1Game1: 900, team1Game2: 900, team1Game3: 900, team1Series: 2700, team2Game1: 890, team2Game2: 890, team2Game3: 890, team2Series: 2670 }];
  it('totals PIN per bowler across the season', () => {
    const totals = seasonPinTotals(scores, matches);
    expect(totals.get(10)).toBe(6);
    // A blind 199 beats the 140 B opened with, and that game was lost by 10, so the blind would have won it.
    expect(totals.get(11)).toBe(-2);
  });
  it('a flat line is the steadiest in the field and the wobble is the most mercurial', () => {
    const steady = styleFor(10, [week({ week: 1, game1: 210, game2: 210, game3: 210 })], scores, matches, 1)!;
    expect(steady.variation).toBe(0);
    expect(steady.variationPercentile).toBe(0);
    expect(steady.fieldSize).toBe(2);
    expect(steady.impact).toMatchObject({ total: 6, rank: 1, field: 2 });
    const wobbly = styleFor(11, [week({ week: 1, game1: 100, game2: 200, game3: 150 })], scores, matches, 1)!;
    expect(wobbly.variationPercentile).toBe(100);
    expect(wobbly.aboveBelow).toMatchObject({ above: 1, below: 1, even: 1, basis: 'season' });
  });
  it('null without games', () => {
    expect(styleFor(10, [], scores, matches, 1)).toBeNull();
  });
});
