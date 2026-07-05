import { describe, it, expect } from 'vitest';
import {
  reduceStarStats,
  mapFacts,
  deriveTeams,
  buildGameProfile,
  assembleBowlerView,
  computeWeekDelta,
  BOWLER_VIEW_BATCH_SQL,
} from './bowler-page';

describe('BOWLER_VIEW_BATCH_SQL', () => {
  it('has exactly 8 statements, matching assembleBowlerView recordset indices', () => {
    // Guard the highest-risk invariant: statement order/count must stay in lockstep
    // with assembleBowlerView's recordsets[0..7]. Reordering or adding a statement
    // without updating the assembler would silently mis-map data.
    const statements = BOWLER_VIEW_BATCH_SQL.split(';\n').filter(s => s.trim());
    expect(statements).toHaveLength(8);
    // sanity: every statement is a per-bowler read keyed on @bowlerID
    for (const s of statements) expect(s).toContain('@bowlerID');
  });
});

describe('reduceStarStats', () => {
  it('maps patch codes to counts, defaults missing to 0', () => {
    const s = reduceStarStats([
      { code: 'perfectGame', cnt: 1 },
      { code: 'botw', cnt: 3 },
      { code: 'captain', cnt: 1 },
    ]);
    expect(s.perfectGames).toBe(1);
    expect(s.botwWins).toBe(3);
    expect(s.isCaptain).toBe(true);
    expect(s.championships).toBe(0);
  });
  it('all-zero / not-captain for an empty recordset', () => {
    const s = reduceStarStats([]);
    expect(s.perfectGames).toBe(0);
    expect(s.isCaptain).toBe(false);
  });
});

describe('mapFacts', () => {
  it('maps rows with null milestone/date-window fields', () => {
    const facts = mapFacts([{
      factTypeID: 1, bowlerName: 'Amy K', bowlerSlug: 'amy-k', gender: 'F',
      seasonSlug: 'spring-2026', week: 4, year: 2026, value: 245,
      previousValue: 230, isCareerHigh: true,
      referenceDate: new Date('2026-04-01T00:00:00.000Z'),
    }]);
    expect(facts[0].value).toBe(245);
    expect(facts[0].referenceDate).toBe('2026-04-01T00:00:00.000Z');
    expect(facts[0].refMonth).toBeNull();
    expect(facts[0].milestoneCategory).toBeNull();
  });
  it('handles null referenceDate / previousValue', () => {
    const facts = mapFacts([{
      factTypeID: 2, bowlerName: 'B', bowlerSlug: 'b', gender: null,
      seasonSlug: 'fall-2025', week: 1, year: 2025, value: 600,
      previousValue: null, isCareerHigh: false, referenceDate: null,
    }]);
    expect(facts[0].referenceDate).toBeNull();
    expect(facts[0].previousValue).toBeNull();
  });
});

describe('deriveTeams', () => {
  it('groups by team, sums nights, sorts desc, computes pct', () => {
    const { teams, totalNights } = deriveTeams([
      { teamSlug: 'lucky-strikes', canonicalTeamName: 'Lucky Strikes', teamName: 'Lucky Strikes', nightsBowled: 8 },
      { teamSlug: 'lucky-strikes', canonicalTeamName: 'Lucky Strikes', teamName: 'Lucky Strikes', nightsBowled: 2 },
      { teamSlug: 'hot-shotz', canonicalTeamName: 'Hot Shotz', teamName: 'Hot Shotz', nightsBowled: 5 },
    ] as any);
    expect(totalNights).toBe(15);
    expect(teams[0].teamName).toBe('Lucky Strikes');
    expect(teams[0].nights).toBe(10);
    expect(teams[0].pct).toBe(67);
    expect(teams[1].pct).toBe(33);
  });
  it('pct 0 when no nights', () => {
    const { teams, totalNights } = deriveTeams([] as any);
    expect(totalNights).toBe(0);
    expect(teams).toEqual([]);
  });
});

describe('buildGameProfile', () => {
  const id = { bowlerName: 'Amy K', slug: 'amy-k', isActive: true };
  it('builds the archetype row from a single-bowler AVG row', () => {
    const gp = buildGameProfile({ games: 30, avg1: 180, avg2: 185, avg3: 200 }, id);
    expect(gp).not.toBeNull();
    expect(gp!.slug).toBe('amy-k');
    expect(gp!.nights).toBe(30);
    expect(gp!.games).toBe(90);
    expect(gp!.avg3).toBe(200);
    expect(gp!.bestGame).toBe(3);
    expect(gp!.archetype).toBe('Late Bloomer');
    expect(gp!.isActive).toBe(true);
  });
  it('classifies a tight spread as Flatliner', () => {
    const gp = buildGameProfile({ games: 30, avg1: 190, avg2: 191, avg3: 192 }, id);
    expect(gp!.archetype).toBe('Flatliner');
  });
  it('returns null when the bowler has no qualifying games', () => {
    expect(buildGameProfile(undefined, id)).toBeNull();
    expect(buildGameProfile({ games: 0, avg1: null, avg2: null, avg3: null } as any, id)).toBeNull();
  });
});

describe('assembleBowlerView', () => {
  const recordsets = () => [
    [{ bowlerID: 1, bowlerName: 'Amy K', slug: 'amy-k', isActive: true, highGame: 279, highSeries: 720, rollingAvg: 188.2, prevRollingAvg: 185.0 }],
    [{ teamSlug: 'lucky-strikes', canonicalTeamName: 'Lucky Strikes', teamName: 'Lucky Strikes', nightsBowled: 9, seasonID: 36 }],
    [{ seasonID: 36, week: 4, game1: 200, game2: 210, game3: 220, scratchSeries: 630, turkeys: 1, incomingAvg: 186 }],
    [{ seasonID: 36, week: 1, rollingAvg: 185 }],
    [{ seasonID: 36, week: 4, patch: 'highGame' }],
    [{ code: 'botw', cnt: 2 }],
    [{ factTypeID: 1, bowlerName: 'Amy K', bowlerSlug: 'amy-k', gender: 'F', seasonSlug: 'spring-2026', week: 4, year: 2026, value: 279, previousValue: 270, isCareerHigh: true, referenceDate: null }],
    [{ games: 30, avg1: 180, avg2: 185, avg3: 200 }],
  ];
  it('maps the 8 recordsets into the DTO and derives teams + gameProfile', () => {
    const view = assembleBowlerView(recordsets() as any);
    expect(view.careerSummary?.highGame).toBe(279);
    expect(view.seasonStats).toHaveLength(1);
    expect(view.gameLog[0].scratchSeries).toBe(630);
    expect(view.rollingAvgHistory[0].rollingAvg).toBe(185);
    expect(view.patches[0].patch).toBe('highGame');
    expect(view.starStats.botwWins).toBe(2);
    expect(view.facts[0].value).toBe(279);
    expect(view.teams[0].teamSlug).toBe('lucky-strikes');
    expect(view.gameProfile?.archetype).toBe('Late Bloomer');
  });
  it('careerSummary null + gameProfile null when recordsets are empty', () => {
    const view = assembleBowlerView([[], [], [], [], [], [], [], []] as any);
    expect(view.careerSummary).toBeNull();
    expect(view.teams).toEqual([]);
    expect(view.gameProfile).toBeNull();
  });
});

describe('computeWeekDelta', () => {
  const baseView = {
    careerSummary: { rollingAvg: 190, highGame: 279, highSeries: 720 },
    seasonStats: [{ seasonID: 36 }],
    gameLog: [{ seasonID: 36, week: 4, game1: 200, game2: 210, game3: 300, scratchSeries: 710, turkeys: 2, incomingAvg: 187 }],
  } as any;
  it('computes the delta when latest season is the current season', () => {
    const d = computeWeekDelta(baseView, 36);
    expect(d!.totalPins).toBe(710);
    expect(d!.games200Plus).toBe(3);
    expect(d!.series600Plus).toBe(1);
    expect(d!.turkeys).toBe(2);
    expect(d!.avgChange).toBeCloseTo(3);
    expect(d!.newHighGame).toBe(true);
    expect(d!.newHighSeries).toBe(false);
  });
  it('null when latest season is not the current season', () => {
    expect(computeWeekDelta(baseView, 35)).toBeNull();
  });
  it('null when no career summary', () => {
    expect(computeWeekDelta({ ...baseView, careerSummary: null }, 36)).toBeNull();
  });
});
