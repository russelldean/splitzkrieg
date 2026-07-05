# Phase 3 Bowler Page View-Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the bowler page's ~15 DB round-trips into ~3 cold reads (one 8-statement per-bowler batch + a shared 4-call league context) so it renders in ~1s on demand, keeping every visible section except the one "Featured on Ticker" star line, with no new tables and no full-league scan.

**Architecture:** A new `src/lib/views/bowler-page.ts` runs the 7 existing per-bowler SELECTs **plus** one new single-bowler `AVG(game1/2/3)` (for the GameProfile archetype) as a **single batched mssql request** returning `result.recordsets[0..7]`, then a pure `assembleBowlerView()` maps those into a flat DTO (reusing the query modules' SQL verbatim via exported constants and `classifyArchetype` from `alltime.ts`). A `getLeagueContext()` bundles the 4 league-wide reads the page still needs. The page becomes a flat `Promise.all([getBowlerPageView, getLeagueContext])`, with league-dependent derivations (BOTW flag, week delta) in pure helpers. Two low-value pieces are dropped: the YouAreAStar ticker cross-reference (which alone pulled in `getWeeklyHighlights` + `getLeagueMilestones`) and the page's dependency on `getGameProfiles` (a full-league scan, replaced by the per-bowler archetype).

**Tech Stack:** Next.js (App Router, server components), TypeScript, `mssql` (Azure SQL), vitest, the existing `cachedQuery` disk cache.

---

## Background the engineer needs

- **Root cause (measured):** no bowler query is slow (<200ms each); the ~5-6s is **many separate round-trips** per cold on-demand render, each paying connection + `cachedQuery` wrapper + a 5-slot semaphore (`src/lib/db.ts:41`). The fix is collapsing round-trips. **No schema changes, no SQL rewrites** (the one new SQL statement is a trivial single-bowler aggregate).
- **`cachedQuery` signature** (`src/lib/db.ts:253`): `cachedQuery(key, fn, fallback, options)`. Relevant options: `{ bowlerID }` (per-bowler invalidation — import scripts bump `DATA_VERSIONS.bowlers[bowlerID]`), `{ dependsOn: ['scores'] }`, `{ sql }` (hashed into the key). `bowlerID` and `dependsOn` are **mutually exclusive** for the version tag (db.ts:311-321).
- **The per-bowler batch uses `{ bowlerID }`, NOT `dependsOn: ['scores']`** — matches the 6 queries it consolidates and keeps per-bowler invalidation (a weekly import only busts bowlers who bowled). `dependsOn: ['scores']` would coarsely bust every bowler's view on any score change.
- **On-demand cache reality:** bowler pages are `generateStaticParams: []` (fully on-demand). On Vercel the request-time filesystem is read-only, so the disk cache does not save on-demand renders — the batch runs against the DB on the first cold render per bowler per deploy; Next's ISR/full-route cache serves subsequent hits from CDN. Consolidating round-trips is what makes that first render fast.
- **The 14 original page queries, and what happens to each:**
  - **7 per-bowler → batched (all key on `@bowlerID`):** `getBowlerCareerSummary`, `getBowlerSeasonStats`, `getBowlerGameLog`, `getBowlerRollingAvgHistory`, `getBowlerPatches`, `getBowlerStarStats`, `getBowlerFacts`.
  - **+1 new statement in the same batch:** single-bowler `AVG(game1/2/3)` → GameProfile archetype (replaces `getGameProfiles`, a full-league scan).
  - **League context (4, shared, fetched once):** `getBowlerOfTheWeek` (BOTW badge), `getLeagueGameAvgs` (GameProfile comparison bar), `getCurrentSeasonID` (delta gate), `getCurrentSeasonSlug` (TrailNav).
  - **Removed from the page:** `getGameProfiles` (still backs `/stats/all-time`), `getWeeklyHighlights` + `getLeagueMilestones` (still back home / `/milestones`) — they were only pulled in by the ticker cross-ref.
  - **Removed derivation:** the "Featured on Ticker" star line in YouAreAStar.

## File Structure

- **Create** `src/lib/views/bowler-page.ts` — DTO `BowlerPageView` (incl. `gameProfile`), `WeekDelta`, batch SQL, pure helpers (`reduceStarStats`, `mapFacts`, `deriveTeams`, `buildGameProfile`, `assembleBowlerView`, `computeWeekDelta`), and `getBowlerPageView(bowlerID)`.
- **Create** `src/lib/views/league-context.ts` — `LeagueContext` + `getLeagueContext()`.
- **Create** `src/lib/views/bowler-page.test.ts` — vitest unit tests for the pure helpers.
- **Modify** `src/lib/queries/bowlers.ts` — `export` 6 SQL constants.
- **Modify** `src/lib/queries/facts.ts` — `export BOWLER_FACTS_SQL`.
- **Modify** `src/lib/queries/alltime.ts` — `export` `classifyArchetype`.
- **Modify** `src/components/bowler/YouAreAStar.tsx` — remove the `inTicker` prop + its star line.
- **Modify** `src/app/bowler/[slug]/page.tsx` — flat read; drop ticker/league-milestone/game-profiles usage.
- **Create** `scripts/phase3/profile-bowler-view.mjs` — measure round-trips + timing (evidence gate).

---

## Task 1: Export reused SQL + the archetype classifier

**Files:**
- Modify: `src/lib/queries/bowlers.ts` (constants at lines 102, 210, 288, 347, 463, 477)
- Modify: `src/lib/queries/facts.ts` (constant at line 64)
- Modify: `src/lib/queries/alltime.ts` (`classifyArchetype` at line 354)

- [ ] **Step 1: Add `export` to the 6 bowler SQL constants**

In `src/lib/queries/bowlers.ts`, prefix these `const` declarations with `export` (SQL untouched):

```ts
export const GET_BOWLER_CAREER_SUMMARY_SQL = `
export const BOWLER_SEASON_STATS_SQL = `
export const GET_BOWLER_GAME_LOG_SQL = `
export const GET_BOWLER_ROLLING_AVG_HISTORY_SQL = `
export const GET_BOWLER_STAR_STATS_SQL = `
export const GET_BOWLER_PATCHES_SQL = `
```

- [ ] **Step 2: Add `export` to the facts SQL constant**

In `src/lib/queries/facts.ts` line 64: `export const BOWLER_FACTS_SQL = `

- [ ] **Step 3: Export `classifyArchetype`**

In `src/lib/queries/alltime.ts` line 354, change `function classifyArchetype(` to `export function classifyArchetype(`. (`GameProfileRow` and `GameArchetype` are already exported.)

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/bowlers.ts src/lib/queries/facts.ts src/lib/queries/alltime.ts
git commit -m "refactor: export bowler-page SQL + classifyArchetype for view-model reuse"
```

---

## Task 2: Pure DTO assembly + derivation helpers (TDD)

**Files:**
- Create: `src/lib/views/bowler-page.ts` (helpers only in this task)
- Test: `src/lib/views/bowler-page.test.ts`

The pure logic mirrors today's behavior exactly: star-stats reduction (`bowlers.ts:519-535`), facts mapping (`facts.ts:95-111`), team breakdown (`page.tsx:128-146`), the per-row GameProfile build (`alltime.ts:395-413`), and the last-week delta (`page.tsx:154-189`).

- [ ] **Step 1: Write the failing test**

Create `src/lib/views/bowler-page.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  reduceStarStats,
  mapFacts,
  deriveTeams,
  buildGameProfile,
  assembleBowlerView,
  computeWeekDelta,
} from './bowler-page';

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
    // avg3 highest, wide spread -> Late Bloomer
    const gp = buildGameProfile({ games: 30, avg1: 180, avg2: 185, avg3: 200 }, id);
    expect(gp).not.toBeNull();
    expect(gp!.slug).toBe('amy-k');
    expect(gp!.nights).toBe(30);
    expect(gp!.games).toBe(90);       // nights * 3
    expect(gp!.avg3).toBe(200);
    expect(gp!.bestGame).toBe(3);
    expect(gp!.archetype).toBe('Late Bloomer');
    expect(gp!.isActive).toBe(true);
  });
  it('classifies a tight spread as Flatliner', () => {
    // pctSpread below FLATLINER_PCT_CUTOFF (~1.6%)
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
    [{ bowlerID: 1, bowlerName: 'Amy K', slug: 'amy-k', isActive: true, highGame: 279, highSeries: 720, rollingAvg: 188.2, prevRollingAvg: 185.0 }], // 0 careerSummary
    [{ teamSlug: 'lucky-strikes', canonicalTeamName: 'Lucky Strikes', teamName: 'Lucky Strikes', nightsBowled: 9, seasonID: 36 }], // 1 seasonStats
    [{ seasonID: 36, week: 4, game1: 200, game2: 210, game3: 220, scratchSeries: 630, turkeys: 1, incomingAvg: 186 }], // 2 gameLog
    [{ seasonID: 36, week: 1, rollingAvg: 185 }], // 3 rollingAvgHistory
    [{ seasonID: 36, week: 4, patch: 'highGame' }], // 4 patches
    [{ code: 'botw', cnt: 2 }], // 5 starStats
    [{ factTypeID: 1, bowlerName: 'Amy K', bowlerSlug: 'amy-k', gender: 'F', seasonSlug: 'spring-2026', week: 4, year: 2026, value: 279, previousValue: 270, isCareerHigh: true, referenceDate: null }], // 6 facts
    [{ games: 30, avg1: 180, avg2: 185, avg3: 200 }], // 7 archetype
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/views/bowler-page.test.ts`
Expected: FAIL — `Failed to resolve import "./bowler-page"`.

- [ ] **Step 3: Write the pure helpers**

Create `src/lib/views/bowler-page.ts`:

```ts
/**
 * Bowler page view-model: one batched per-bowler read + pure assembly.
 *
 * Consolidates the 7 per-bowler SELECTs plus a single-bowler AVG(game1/2/3) for the
 * GameProfile archetype into one mssql request (result.recordsets[0..7]), then maps
 * them into a flat DTO. Per-bowler SQL is reused verbatim from the query modules.
 */
import type {
  BowlerCareerSummary,
  BowlerSeasonStats,
  GameLogWeek,
  RollingAvgPoint,
  BowlerPatch,
  BowlerStarStats,
} from '../queries/bowlers';
import type { RandomFact } from '../queries/facts';
import { classifyArchetype, type GameProfileRow } from '../queries/alltime';
import type { TeamStat } from '@/components/bowler/TeamBreakdown';

export interface BowlerPageView {
  careerSummary: BowlerCareerSummary | null;
  seasonStats: BowlerSeasonStats[];
  gameLog: GameLogWeek[];
  rollingAvgHistory: RollingAvgPoint[];
  patches: BowlerPatch[];
  starStats: BowlerStarStats;
  facts: RandomFact[];
  teams: TeamStat[];
  gameProfile: GameProfileRow | null;
}

export interface WeekDelta {
  totalPins: number;
  totalGames: number;
  games200Plus: number;
  series600Plus: number;
  turkeys: number | null;
  avgChange: number | null;
  newHighGame: boolean;
  newHighSeries: boolean;
}

/** Mirror of getBowlerStarStats' post-processing (bowlers.ts:519-535). */
export function reduceStarStats(rows: Array<{ code: string; cnt: number }>): BowlerStarStats {
  const counts = new Map(rows.map(r => [r.code, r.cnt]));
  return {
    perfectGames: counts.get('perfectGame') ?? 0,
    botwWins: counts.get('botw') ?? 0,
    playoffAppearances: counts.get('playoff') ?? 0,
    championships: counts.get('champion') ?? 0,
    isCaptain: (counts.get('captain') ?? 0) > 0,
    weeklyHighGameWins: counts.get('highGame') ?? 0,
    weeklyHighSeriesWins: counts.get('highSeries') ?? 0,
    aboveAvgAllThreeCount: counts.get('aboveAvg') ?? 0,
    threeOfAKindCount: counts.get('threeOfAKind') ?? 0,
    scratchPlayoffAppearances: counts.get('scratchPlayoff') ?? 0,
    hcpPlayoffAppearances: counts.get('hcpPlayoff') ?? 0,
    scratchChampionships: counts.get('scratchChampion') ?? 0,
    hcpChampionships: counts.get('hcpChampion') ?? 0,
  };
}

/** Mirror of getBowlerFacts' row mapping (facts.ts:95-111). */
export function mapFacts(rows: Array<Record<string, unknown>>): RandomFact[] {
  return rows.map((r) => ({
    factTypeID: r.factTypeID as number,
    bowlerName: r.bowlerName as string,
    bowlerSlug: r.bowlerSlug as string,
    seasonSlug: r.seasonSlug as string,
    week: r.week as number,
    year: r.year as number,
    value: r.value as number,
    previousValue: (r.previousValue as number) ?? null,
    isCareerHigh: !!r.isCareerHigh,
    gender: (r.gender as string) ?? null,
    referenceDate: r.referenceDate ? (r.referenceDate as Date).toISOString() : null,
    refMonth: null,
    refDay: null,
    milestoneCategory: null,
    milestoneOrdinal: null,
  }));
}

/** Mirror of the page's team-breakdown derivation (page.tsx:128-146). */
export function deriveTeams(seasonStats: BowlerSeasonStats[]): { teams: TeamStat[]; totalNights: number } {
  const teamMap = new Map<string, { teamName: string; teamSlug: string | null; nights: number }>();
  for (const s of seasonStats) {
    const key = s.teamSlug ?? s.canonicalTeamName ?? s.teamName ?? 'Unknown';
    const existing = teamMap.get(key);
    if (existing) {
      existing.nights += s.nightsBowled;
    } else {
      teamMap.set(key, {
        teamName: s.canonicalTeamName ?? s.teamName ?? 'Unknown',
        teamSlug: s.teamSlug,
        nights: s.nightsBowled,
      });
    }
  }
  const totalNights = seasonStats.reduce((sum, s) => sum + s.nightsBowled, 0);
  const teams: TeamStat[] = Array.from(teamMap.values())
    .sort((a, b) => b.nights - a.nights)
    .map(t => ({
      teamName: t.teamName,
      teamSlug: t.teamSlug,
      nights: t.nights,
      pct: totalNights > 0 ? Math.round((t.nights / totalNights) * 100) : 0,
    }));
  return { teams, totalNights };
}

/**
 * Build the bowler's own GameProfile row from a single-bowler AVG row.
 * Mirror of the per-row build in getGameProfiles (alltime.ts:395-413), for one bowler.
 * Returns null when the bowler has no qualifying (all-three-non-null) games.
 */
export function buildGameProfile(
  row: { games: number; avg1: number | null; avg2: number | null; avg3: number | null } | undefined,
  id: { bowlerName: string; slug: string; isActive: boolean | null },
): GameProfileRow | null {
  if (!row || !row.games || row.avg1 == null || row.avg2 == null || row.avg3 == null) return null;
  const { avg1, avg2, avg3 } = row;
  const overallAvg = (avg1 + avg2 + avg3) / 3;
  const spread = Math.max(avg1, avg2, avg3) - Math.min(avg1, avg2, avg3);
  const pctSpread = overallAvg > 0 ? (spread / overallAvg) * 100 : 0;
  const { bestGame, archetype } = classifyArchetype(avg1, avg2, avg3, pctSpread);
  return {
    bowlerName: id.bowlerName,
    slug: id.slug,
    nights: row.games,
    games: row.games * 3,
    avg1, avg2, avg3,
    overallAvg,
    pctSpread,
    bestGame,
    archetype,
    isActive: !!id.isActive,
  };
}

/**
 * Assemble the flat DTO from the 8 recordsets, in this fixed order:
 * 0 careerSummary, 1 seasonStats, 2 gameLog, 3 rollingAvgHistory,
 * 4 patches, 5 starStats(code/cnt), 6 facts, 7 archetype(games,avg1..3).
 */
export function assembleBowlerView(recordsets: unknown[][]): BowlerPageView {
  const careerSummary = ((recordsets[0] ?? [])[0] as BowlerCareerSummary) ?? null;
  const seasonStats = (recordsets[1] ?? []) as BowlerSeasonStats[];
  const { teams } = deriveTeams(seasonStats);
  const gameProfile = careerSummary
    ? buildGameProfile(
        (recordsets[7] ?? [])[0] as { games: number; avg1: number | null; avg2: number | null; avg3: number | null } | undefined,
        { bowlerName: careerSummary.bowlerName, slug: careerSummary.slug, isActive: careerSummary.isActive },
      )
    : null;
  return {
    careerSummary,
    seasonStats,
    gameLog: (recordsets[2] ?? []) as GameLogWeek[],
    rollingAvgHistory: (recordsets[3] ?? []) as RollingAvgPoint[],
    patches: (recordsets[4] ?? []) as BowlerPatch[],
    starStats: reduceStarStats((recordsets[5] ?? []) as Array<{ code: string; cnt: number }>),
    facts: mapFacts((recordsets[6] ?? []) as Array<Record<string, unknown>>),
    teams,
    gameProfile,
  };
}

/**
 * Last-week delta (page.tsx:154-189). Needs currentSeasonID (league state) to gate
 * "active in the current season" — kept OUT of the cached view so the per-bowler
 * cache key stays clean; the page passes league.currentSeasonID in.
 */
export function computeWeekDelta(view: BowlerPageView, currentSeasonID: number | null): WeekDelta | null {
  const { careerSummary, seasonStats, gameLog } = view;
  const latestSeason = seasonStats.length > 0 ? seasonStats[0] : null;
  const isCurrentSeason = latestSeason != null && latestSeason.seasonID === currentSeasonID;
  if (!isCurrentSeason || !careerSummary) return null;

  const latestSeasonLog = gameLog.filter(w => latestSeason && w.seasonID === latestSeason.seasonID);
  const lastWeek = latestSeasonLog.length > 0 ? latestSeasonLog[latestSeasonLog.length - 1] : null;
  if (!lastWeek) return null;

  const games = [lastWeek.game1, lastWeek.game2, lastWeek.game3].filter(
    (g): g is number => g !== null && g > 0,
  );
  const weekPins = games.reduce((sum, g) => sum + g, 0);
  const weekMaxGame = games.length > 0 ? Math.max(...games) : 0;
  const weekSeries = lastWeek.scratchSeries ?? 0;
  const avgChange = careerSummary.rollingAvg != null && lastWeek.incomingAvg != null
    ? careerSummary.rollingAvg - lastWeek.incomingAvg
    : null;

  return {
    totalPins: weekPins,
    totalGames: games.length,
    games200Plus: games.filter(g => g >= 200).length,
    series600Plus: weekSeries >= 600 ? 1 : 0,
    turkeys: lastWeek.turkeys,
    avgChange,
    newHighGame: careerSummary.highGame !== null && weekMaxGame >= careerSummary.highGame,
    newHighSeries: careerSummary.highSeries !== null && weekSeries >= careerSummary.highSeries,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/views/bowler-page.test.ts`
Expected: PASS (all green). If `buildGameProfile`'s Flatliner test fails, confirm `classifyArchetype`'s cutoff (`FLATLINER_PCT_CUTOFF = 1.5977`, alltime.ts:27): 190/191/192 spread is 2, overallAvg 191, pctSpread ~1.05% < 1.5977 -> Flatliner. Correct.

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/views/bowler-page.ts src/lib/views/bowler-page.test.ts
git commit -m "feat: pure bowler-page view-model assembly + derivations incl. archetype (TDD)"
```

---

## Task 3: `getBowlerPageView(bowlerID)` — one 8-statement batched read

**Files:**
- Modify: `src/lib/views/bowler-page.ts` (add batch SQL + DB function)

- [ ] **Step 1: Add imports, the archetype SQL, the batch, and the cached read**

Add to the import block at the top of `src/lib/views/bowler-page.ts`:

```ts
import { cache } from 'react';
import { getDb, cachedQuery } from '../db';
import {
  GET_BOWLER_CAREER_SUMMARY_SQL,
  BOWLER_SEASON_STATS_SQL,
  GET_BOWLER_GAME_LOG_SQL,
  GET_BOWLER_ROLLING_AVG_HISTORY_SQL,
  GET_BOWLER_PATCHES_SQL,
  GET_BOWLER_STAR_STATS_SQL,
} from '../queries/bowlers';
import { BOWLER_FACTS_SQL } from '../queries/facts';
```

Append to the bottom of the file:

```ts
/**
 * New single-bowler archetype aggregate (same WHERE as getGameProfiles, one bowler).
 * Statement 8 of the batch; feeds buildGameProfile.
 */
const BOWLER_ARCHETYPE_SQL = `
  SELECT
    COUNT(*) AS games,
    AVG(CAST(game1 AS FLOAT)) AS avg1,
    AVG(CAST(game2 AS FLOAT)) AS avg2,
    AVG(CAST(game3 AS FLOAT)) AS avg3
  FROM scores
  WHERE bowlerID = @bowlerID
    AND isPenalty = 0
    AND game1 IS NOT NULL AND game2 IS NOT NULL AND game3 IS NOT NULL
`;

/**
 * Batched per-bowler SQL. Order MUST match assembleBowlerView's recordset order:
 * 0 careerSummary, 1 seasonStats, 2 gameLog, 3 rollingAvgHistory,
 * 4 patches, 5 starStats, 6 facts, 7 archetype.
 * The first 7 are reused verbatim from the query modules — do NOT edit them here.
 */
export const BOWLER_VIEW_BATCH_SQL = [
  GET_BOWLER_CAREER_SUMMARY_SQL,
  BOWLER_SEASON_STATS_SQL,
  GET_BOWLER_GAME_LOG_SQL,
  GET_BOWLER_ROLLING_AVG_HISTORY_SQL,
  GET_BOWLER_PATCHES_SQL,
  GET_BOWLER_STAR_STATS_SQL,
  BOWLER_FACTS_SQL,
  BOWLER_ARCHETYPE_SQL,
].join(';\n');

const EMPTY_VIEW: BowlerPageView = {
  careerSummary: null,
  seasonStats: [],
  gameLog: [],
  rollingAvgHistory: [],
  patches: [],
  starStats: reduceStarStats([]),
  facts: [],
  teams: [],
  gameProfile: null,
};

/**
 * One round-trip for the whole bowler page (was 8). Per-bowler cache invalidation
 * via { bowlerID } (NOT dependsOn: ['scores']). React.cache dedupes within a render.
 */
export const getBowlerPageView = cache(async (bowlerID: number): Promise<BowlerPageView> => {
  return cachedQuery(
    `getBowlerPageView-${bowlerID}`,
    async () => {
      const db = await getDb();
      const result = await db
        .request()
        .input('bowlerID', bowlerID)
        .query(BOWLER_VIEW_BATCH_SQL);
      // mssql returns one entry per statement in result.recordsets, in order.
      return assembleBowlerView(result.recordsets as unknown[][]);
    },
    EMPTY_VIEW,
    { sql: BOWLER_VIEW_BATCH_SQL, bowlerID },
  );
});
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Re-run the unit tests (no regressions)**

Run: `npx vitest run src/lib/views/bowler-page.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/views/bowler-page.ts
git commit -m "feat: getBowlerPageView 8-statement batched read (8 round-trips -> 1)"
```

---

## Task 4: `getLeagueContext()` — 4 shared league reads

**Files:**
- Create: `src/lib/views/league-context.ts`

A `React.cache` composition of already-cached shared functions — NOT a new `cachedQuery` entry (each underlying function keeps its own correct per-channel invalidation).

- [ ] **Step 1: Write the bundler**

Create `src/lib/views/league-context.ts`:

```ts
/**
 * League-wide bowler-page context, bundled behind one call. Identical for every
 * bowler, so the page fetches it once. React.cache composition of existing
 * independently-cached reads (no new cache entry). Down to 4 calls after the
 * ticker cross-ref and getGameProfiles were removed from the bowler page.
 */
import { cache } from 'react';
import { getBowlerOfTheWeek, getCurrentSeasonID, getCurrentSeasonSlug } from '@/lib/queries';
import { getLeagueGameAvgs, type LeagueGameAvgs } from '@/lib/queries/alltime';

export interface LeagueContext {
  botwIDs: number[];
  currentSeasonID: number | null;
  currentSlug: string | undefined;
  leagueGameAvgs: LeagueGameAvgs;
}

export const getLeagueContext = cache(async (): Promise<LeagueContext> => {
  const [botwIDs, currentSeasonID, currentSlug, leagueGameAvgs] = await Promise.all([
    getBowlerOfTheWeek(),
    getCurrentSeasonID(),
    getCurrentSeasonSlug(),
    getLeagueGameAvgs(),
  ]);
  return { botwIDs, currentSeasonID, currentSlug, leagueGameAvgs };
});
```

- [ ] **Step 2: Confirm the barrel re-exports the 3 `@/lib/queries` names**

Run: `grep -nE "getBowlerOfTheWeek|getCurrentSeasonID|getCurrentSeasonSlug" src/lib/queries.ts`
Expected: each appears (the page already imports them from `@/lib/queries`). `getLeagueGameAvgs` is imported from `@/lib/queries/alltime` as written.

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/views/league-context.ts
git commit -m "feat: getLeagueContext bundles the 4 remaining league reads"
```

---

## Task 5: Remove the `inTicker` prop from YouAreAStar

**Files:**
- Modify: `src/components/bowler/YouAreAStar.tsx` (Props at line 6, param at line 81, block at lines 189-195)

The "Featured on Ticker" line is the only consumer of the two league queries we're dropping. Remove it cleanly.

- [ ] **Step 1: Remove the prop from the interface**

In `src/components/bowler/YouAreAStar.tsx`, delete the `inTicker: boolean;` line (line 6) from the `Props` interface.

- [ ] **Step 2: Remove it from the destructured params**

Change line 81 from:

```ts
export function YouAreAStar({ stats, inTicker, slug, easterEgg }: Props) {
```
to:
```ts
export function YouAreAStar({ stats, slug, easterEgg }: Props) {
```

- [ ] **Step 3: Delete the ticker star line**

Delete this block (lines 189-195):

```ts
  if (inTicker) {
    lines.push({
      label: 'Featured on Ticker',
      value: 'Now',
      hint: 'Home',
    });
  }
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: FAIL — the bowler page still passes `inTicker` (fixed in Task 6). That is the expected intermediate state; proceed to Task 6 before re-checking. (If you prefer a clean gate, do Task 5 + Task 6 in one commit.)

- [ ] **Step 5: Commit**

```bash
git add src/components/bowler/YouAreAStar.tsx
git commit -m "refactor: drop YouAreAStar 'Featured on Ticker' line (removes 2 league queries)"
```

---

## Task 6: Convert the bowler page to the flat read

**Files:**
- Modify: `src/app/bowler/[slug]/page.tsx` (imports 14-30, `type WeekDelta` 34-43, body 96-267)

`generateMetadata` stays as-is (separate render pass; still uses `getBowlerBySlug` + `getBowlerCareerSummary`).

- [ ] **Step 1: Replace the imports**

Replace the `@/lib/queries` block (lines 14-28), the alltime/facts imports (lines 29-30), and delete the local `type WeekDelta = {...}` (lines 34-43). New imports:

```ts
import {
  getBowlerBySlug,
  getBowlerCareerSummary,
} from '@/lib/queries';
import { getBowlerPageView, computeWeekDelta } from '@/lib/views/bowler-page';
import { getLeagueContext } from '@/lib/views/league-context';
```

Keep all the component imports (`RecordProgression`, `BowlerHero`, `PersonalRecordsPanel`, `SeasonStatsTable`, `AverageProgressionChartLazy`, `GameLog`, `YouAreAStar`, `GameProfile`, `MilestoneWatch`, `TrackVisibility`, `TrailNav`, `StickyContextBar`, `TeamStat` type) and `computePersonalMilestones`. Remove the now-unused `milestoneTickerItems` import (it was in the `@/lib/queries` block).

- [ ] **Step 2: Replace the body data-fetch + derivations**

In `BowlerPage`, replace everything from `// Parallel build-time data fetching` (line 107) through the end of the `weekDelta` block (line 189) with:

```ts
  const [view, league] = await Promise.all([
    getBowlerPageView(bowler.bowlerID),
    getLeagueContext(),
  ]);

  const { careerSummary, seasonStats, gameLog, rollingAvgHistory, patches, starStats, facts: bowlerFacts, teams, gameProfile } = view;
  const { botwIDs, currentSeasonID, currentSlug, leagueGameAvgs } = league;

  const isBowlerOfTheWeek = botwIDs.includes(bowler.bowlerID);

  // Current avg = rolling 27-game average (used for handicap on bowling nights)
  const currentAvg = careerSummary?.rollingAvg?.toFixed(1) ?? null;
  const rollingAvgDelta = careerSummary?.rollingAvg != null && careerSummary?.prevRollingAvg != null
    ? careerSummary.rollingAvg - careerSummary.prevRollingAvg
    : null;

  const latestSeason = seasonStats.length > 0 ? seasonStats[0] : null;
  const isCurrentSeason = latestSeason != null && latestSeason.seasonID === currentSeasonID;
  const lastWeek = (() => {
    const log = gameLog.filter(w => latestSeason && w.seasonID === latestSeason.seasonID);
    return log.length > 0 ? log[log.length - 1] : null;
  })();

  const weekDelta = computeWeekDelta(view, currentSeasonID);
```

- [ ] **Step 3: Update the YouAreAStar JSX (drop `inTicker`)**

Change the `<YouAreAStar ... />` (page.tsx:225-231) to remove the `inTicker` prop entirely:

```tsx
          <YouAreAStar
            stats={starStats}
            slug={slug}
            // EASTER EGG: Mike DePasquale 300 photo, Harper Gordek photo
            easterEgg={slug === 'mike-depasquale' ? { src: '/village-lanes-mp300.jpg', alt: 'Mike\'s 300 - Perfect Game at Village Lanes', width: 4032, height: 3024 } : slug === 'harper-gordek' ? { src: '/IMG_7806.jpeg', alt: 'Harper Gordek', width: 2016, height: 1512 } : undefined}
          />
```

The rest of the JSX is unchanged: it already reads `careerSummary`, `seasonStats`, `gameLog`, `rollingAvgHistory`, `patches`, `starStats`, `bowlerFacts`, `teams`, `gameProfile`, `leagueGameAvgs`, `isBowlerOfTheWeek`, `currentAvg`, `rollingAvgDelta`, `latestSeason`, `isCurrentSeason`, `lastWeek`, `weekDelta`, `currentSlug` — all defined above with identical names/semantics. `<GameProfile profile={gameProfile} leagueAvgs={leagueGameAvgs} />` now gets `gameProfile` from the batch and `leagueGameAvgs` from league context.

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: exits 0. If it flags an unused import, remove that line.

- [ ] **Step 5: Verify the render behind the wall (evidence, not assumption)**

Run: `npm run dev` (no `MAINTENANCE_MODE` locally), then load and eyeball against the pre-change page:
- Heavy: `http://localhost:3000/bowler/amy-kostrewa`
- Light + a historical-only bowler + a current-season bowler (exercises the delta path + GameProfile).
- Unknown slug `http://localhost:3000/bowler/nonexistent-xyz` -> 404.

Expected: every section renders as before EXCEPT the "Featured on Ticker" line is gone from YouAreAStar. GameProfile shows the same archetype + league bar as before.

- [ ] **Step 6: Commit**

```bash
git add src/app/bowler/[slug]/page.tsx
git commit -m "perf: bowler page reads one batched view + shared league context (15 -> ~3 round-trips)"
```

---

## Task 7: Measure the gate (round-trips + timing)

**Files:**
- Create: `scripts/phase3/profile-bowler-view.mjs`

Evidence gate before rolling this shape out to team/season/week/stats.

- [ ] **Step 1: Write the profiling script**

Create `scripts/phase3/profile-bowler-view.mjs`. Copy the env-loading/DB-bootstrap pattern from an existing script in `scripts/` (e.g. `scripts/phase3/profile-bowler.mjs` if present — do NOT invent a new bootstrap). For a list of slugs (heavy `amy-kostrewa`, a light bowler, a historical-only bowler, a current-season bowler):
1. Resolve `bowlerID` via `getBowlerBySlug`.
2. Time `getBowlerPageView(bowlerID)`; log elapsed ms. Confirm `BOWLER_VIEW_BATCH_SQL` has 8 statements and runs as ONE `db.request().query()` (one round-trip).
3. Time `getLeagueGameAvgs()` cold (fresh process / cache-busted) and `getBowlerOfTheWeek()`; log ms — these are the 2 cold league reads. **If `getLeagueGameAvgs` is slow (say >250ms), note it: the fallback is a per-season precompute stored in the existing `leagueSettings` table (no new table), read as a cheap key lookup.**
4. Diff the assembled DTO against the legacy per-function results for the same bowler: `careerSummary`, counts of `seasonStats`/`gameLog`/`patches`/`facts`, `starStats` object equality, and `gameProfile.archetype` vs `getBowlerGameProfile(slug).archetype` (must match).

- [ ] **Step 2: Run it against the live DB**

Run: `node scripts/phase3/profile-bowler-view.mjs`
Expected: batched read is one round-trip and fast; DTO matches legacy output for every sampled bowler (esp. `gameProfile.archetype` equals the old `getGameProfiles`-derived value); `getLeagueGameAvgs` cold time recorded.

- [ ] **Step 3: Do NOT crawl on-demand pages concurrently**

Verify a couple of bowler pages individually behind the bypass. If you need a prebuilt-page smoke: `node scripts/phase1/smoke-404.mjs <base> --tier=current` (bowler pages stay on-demand — never crawl them concurrently; it saturates the DB and bakes 404s).

- [ ] **Step 4: Commit**

```bash
git add scripts/phase3/profile-bowler-view.mjs
git commit -m "chore: phase3 bowler view-model profiler (round-trip + timing gate)"
```

---

## Self-Review Notes (for the executor)

- **Spec coverage:** batched `getBowlerPageView` incl. archetype (Tasks 2-3), `getLeagueContext` 4 calls (Task 4), ticker line removed (Tasks 5-6), `getGameProfiles` removed from page / archetype in batch (Tasks 2-3, 6), page-as-flat-read (Task 6), no schema change (none), per-bowler `{ bowlerID }` cache (Task 3), measurement/correctness gate (Task 7).
- **Correctness anchor for the archetype swap:** `buildGameProfile` uses the SAME WHERE clause (all-three-non-null, non-penalty) and the SAME `classifyArchetype` as `getGameProfiles`, restricted to one bowler — so the archetype must equal the old value. Task 7 step 4 asserts this per bowler.
- **`getLeagueGameAvgs` "once per season":** kept as one shared cached read (recompute only when scores change, not per page). Russ is fine with a rarely-recomputed baseline; if it ever measures slow, precompute per-season into `leagueSettings` (existing table) — a follow-up, not a blocker.
- **Facts invalidation nuance (unchanged from prior review):** `getBowlerFacts` today invalidates on the whole `scores` channel; folded into the `{ bowlerID }` view it invalidates per-bowler. Facts regenerate alongside score imports (which bump the per-bowler version), so they co-invalidate. Confirm during rollout.
- **Rollout after the gate passes:** apply the identical shape to team, then season/week/stats, one at a time behind the maintenance wall; relaunch the whole site together (flip `MAINTENANCE_MODE` off) once the linked core is fast. This plan covers the **bowler pilot only**.
