# Phase 3 Team Page View-Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the team page's ~30 DB round-trips (a base ~11 **plus an N+1**: one `getTeamSeasonBowlers` per season) into ~2: one batched `@teamID` read + one shared league context. Keep all six sections. Also fix the N+1 (all seasons in one query) and clear two backlog `stable:true`-on-mutable cache violations by folding those queries into the `dependsOn`-based batch.

**Architecture:** Direct analog of the shipped bowler view-model — **read `src/lib/views/bowler-page.ts` and `src/lib/views/league-context.ts` as the reference implementation.** A new `src/lib/views/team-page.ts` runs the 8 per-team SELECTs (7 existing, reused verbatim via exported constants, + one NEW all-seasons-bowlers query that replaces the N+1) as ONE batched mssql request (`result.recordsets[0..7]`); a pure `assembleTeamView` maps them to a flat DTO (including grouping the all-seasons-bowlers rows into `bowlersBySeason`). A `getTeamLeagueContext()` bundles the 2 shared reads. The page becomes `Promise.all([getTeamPageView, getTeamLeagueContext])` plus a small Ghost-Team branch.

**Tech Stack:** Next.js (App Router, server components), TypeScript, `mssql` (Azure SQL), vitest, the existing `cachedQuery` disk cache.

---

## Background the engineer needs

- **This is the second page in the Phase 3 rollout.** The bowler page (`src/lib/views/bowler-page.ts`, `src/lib/views/league-context.ts`, `src/app/bowler/[slug]/page.tsx`) already shipped this exact shape. Mirror it. The batch↔assembly recordset-order contract, the `EMPTY_*` fallback, the `cache()` wrapper, and the pure-helper + TDD approach are all established there.
- **Root cause is the same (round-trip count) PLUS an N+1.** `src/app/team/[slug]/page.tsx:162-167` loops `getTeamSeasonBowlers(teamID, seasonID)` once per season. A 15-20 season team = ~30 cold round-trips. Fixing the N+1 is the single biggest win.
- **KEY DIFFERENCE FROM BOWLER — cache key:** teams have NO per-team data-version channel (there is no `teamID` option in `cachedQuery`, unlike `bowlerID`). So `getTeamPageView` uses **`dependsOn: ['scores', 'schedule', 'bowlers']`** (the union of channels its statements read), NOT a per-team tag. This is coarser (any import in those channels busts all team views) but teams are on-demand and few (~20-45), so it is fine. Confirm the union by checking each folded query's current `dependsOn`.
- **The two `stable:true` fixes (Russ approved):** `getTeamFranchiseHistory` (`teams/history.ts:160`, reads `teamNameHistory`) and `getTeamPlayoffH2H` (`teams/h2h.ts:255`, reads `playoffResults`) are currently `stable:true` on mutable tables (2 of the cache-invariant backlog violations). Folding them into the `dependsOn`-based batch means the view is NOT stable, so they gain real invalidation on scores/schedule/bowlers imports. This is strictly better than `stable:true` (never invalidates). It does not perfectly track their own rare changes (a playoff result imported without a scores/schedule bump could lag), but playoff/name data is imported alongside score/schedule data in practice. Acceptable; note it.
- **Ghost Team (teamID 45) special case:** the page branches heavily (`isGhostTeam`). For ghost it uses `getGhostTeamH2H()` and hides the all-time roster + regular/playoff H2H. Keep `getGhostTeamH2H` as a SEPARATE conditional call (it is one team). The batch still runs the common 8 statements for ghost; the h2h/playoff results are simply unused for ghost (negligible — one team, same single round-trip). Do NOT try to make the batch conditional.
- **The 8 per-team queries to batch (all key on `@teamID` only):**
  1. `GET_TEAM_CURRENT_ROSTER_SQL` (roster.ts) — `dependsOn:['scores']`
  2. `GET_TEAM_SEASON_BY_SEASON_SQL` (history.ts) — `dependsOn:['scores','schedule']`
  3. `GET_TEAM_ALL_TIME_ROSTER_SQL` (roster.ts) — `dependsOn:['scores']`
  4. `GET_TEAM_FRANCHISE_HISTORY_SQL` (history.ts) — currently `stable:true`
  5. `GET_TEAM_CURRENT_STANDING_SQL` (profile.ts) — `dependsOn:['schedule']`
  6. `GET_TEAM_H2H_SQL` (h2h.ts) — `dependsOn:['schedule']`
  7. `GET_TEAM_PLAYOFF_H2H_SQL` (h2h.ts) — currently `stable:true`
  8. **NEW** `GET_TEAM_ALL_SEASON_BOWLERS_SQL` (defined in team-page.ts) — replaces the per-season N+1
- **Shared → league context:** `getActiveTeamIDs` (h2h.ts, `dependsOn:['scores']`) + `getCurrentSeasonSlug` (seasons/core.ts).
- **Stays separate:** `getTeamBySlug` (`@slug`, `dependsOn:['bowlers']`, `throwOnError` — the gating lookup, used by both the page and `generateMetadata`).

## File Structure

- **Create** `src/lib/views/team-page.ts` — DTO `TeamPageView`, the NEW all-seasons-bowlers SQL, pure helpers (`groupBowlersBySeason`, `assembleTeamView`), batch SQL, and `getTeamPageView(teamID)`.
- **Create** `src/lib/views/team-league-context.ts` — `TeamLeagueContext` + `getTeamLeagueContext()`.
- **Create** `src/lib/views/team-page.test.ts` — vitest unit tests for the pure helpers.
- **Modify** `src/lib/queries/teams/roster.ts` — `export` `GET_TEAM_CURRENT_ROSTER_SQL`, `GET_TEAM_ALL_TIME_ROSTER_SQL`.
- **Modify** `src/lib/queries/teams/history.ts` — `export` `GET_TEAM_SEASON_BY_SEASON_SQL`, `GET_TEAM_FRANCHISE_HISTORY_SQL`.
- **Modify** `src/lib/queries/teams/h2h.ts` — `export` `GET_TEAM_H2H_SQL`, `GET_TEAM_PLAYOFF_H2H_SQL`.
- **Modify** `src/lib/queries/teams/profile.ts` — `export` `GET_TEAM_CURRENT_STANDING_SQL`.
- **Modify** `src/app/team/[slug]/page.tsx` — flat read; keep the Ghost branch.
- **Create** `scripts/phase3/profile-team-view.mjs` — measure round-trips + N+1 correctness (evidence gate).

---

## Task 1: Export the reused per-team SQL constants

**Files:** `src/lib/queries/teams/{roster,history,h2h,profile}.ts`

Purely mechanical: add `export` to 7 existing `const NAME_SQL` declarations. Change ONLY the keyword; leave SQL untouched.

- [ ] **Step 1:** In `teams/roster.ts`: `export const GET_TEAM_CURRENT_ROSTER_SQL`, `export const GET_TEAM_ALL_TIME_ROSTER_SQL`.
- [ ] **Step 2:** In `teams/history.ts`: `export const GET_TEAM_SEASON_BY_SEASON_SQL`, `export const GET_TEAM_FRANCHISE_HISTORY_SQL`.
- [ ] **Step 3:** In `teams/h2h.ts`: `export const GET_TEAM_H2H_SQL`, `export const GET_TEAM_PLAYOFF_H2H_SQL`.
- [ ] **Step 4:** In `teams/profile.ts`: `export const GET_TEAM_CURRENT_STANDING_SQL`.
- [ ] **Step 5:** Also confirm the row interfaces the view will import are exported: `TeamRosterMember`, `TeamSeasonBowler`, `AllTimeRosterMember` (roster.ts); `TeamSeasonRow`, `FranchiseNameEntry` (history.ts); `TeamCurrentStanding` (profile.ts); `TeamH2HMatchup`, `PlayoffH2HMatchup` (h2h.ts). If any is not exported, add `export` to its `interface`. Use Grep to find exact names before editing.
- [ ] **Step 6:** `npx tsc --noEmit` — exits 0.
- [ ] **Step 7:** Commit:
```bash
git add src/lib/queries/teams/roster.ts src/lib/queries/teams/history.ts src/lib/queries/teams/h2h.ts src/lib/queries/teams/profile.ts
git commit -m "refactor: export per-team SQL constants for team view-model reuse

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0126jX3qkNnUBEVPWQNYz7dE"
```

---

## Task 2: Pure DTO assembly + N+1 grouping (TDD)

**Files:** Create `src/lib/views/team-page.ts` (helpers + the new SQL only; the DB function is Task 3) and `src/lib/views/team-page.test.ts`.

**FIRST: read `src/lib/views/bowler-page.ts` end-to-end** — this task mirrors its structure (types, pure helpers, `assemble*`, recordset-order contract). The only genuinely new logic is `groupBowlersBySeason` (the N+1 fix).

### The N+1-fixing SQL
The old per-season query (`roster.ts:76-94`) filters `AND sc.seasonID = @seasonID`. The all-seasons variant drops that filter, adds `sc.seasonID` to SELECT + GROUP BY, and orders by season then the SAME within-season order:

```sql
SELECT
  sc.seasonID,
  b.bowlerID,
  b.bowlerName,
  b.slug,
  COUNT(sc.scoreID) * 3 AS gamesBowled,
  SUM(sc.scratchSeries) AS totalPins,
  CAST(
    SUM(sc.scratchSeries) * 1.0 /
    NULLIF(COUNT(sc.scoreID) * 3, 0)
  AS DECIMAL(5,1)) AS average
FROM scores sc
JOIN bowlers b ON sc.bowlerID = b.bowlerID
WHERE sc.teamID = @teamID
  AND sc.isPenalty = 0
GROUP BY sc.seasonID, b.bowlerID, b.bowlerName, b.slug
ORDER BY sc.seasonID, gamesBowled DESC, average DESC
```
`groupBowlersBySeason` then buckets rows by `seasonID` into `Record<number, TeamSeasonBowler[]>`; because rows are already ordered `gamesBowled DESC, average DESC` within each season, each bucket matches the old per-season `getTeamSeasonBowlers` output exactly.

- [ ] **Step 1: Write the failing test.** Create `src/lib/views/team-page.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { groupBowlersBySeason, assembleTeamView } from './team-page';

describe('groupBowlersBySeason', () => {
  it('buckets all-season rows by seasonID, preserving row order within a season', () => {
    const rows = [
      { seasonID: 34, bowlerID: 1, bowlerName: 'A', slug: 'a', gamesBowled: 30, totalPins: 5400, average: 180 },
      { seasonID: 34, bowlerID: 2, bowlerName: 'B', slug: 'b', gamesBowled: 27, totalPins: 4700, average: 174 },
      { seasonID: 36, bowlerID: 1, bowlerName: 'A', slug: 'a', gamesBowled: 9, totalPins: 1700, average: 189 },
    ];
    const bySeason = groupBowlersBySeason(rows as any);
    expect(Object.keys(bySeason).sort()).toEqual(['34', '36']);
    expect(bySeason[34]).toHaveLength(2);
    expect(bySeason[34][0].slug).toBe('a');
    expect(bySeason[34][1].slug).toBe('b');
    expect(bySeason[36]).toHaveLength(1);
    expect(bySeason[36][0].gamesBowled).toBe(9);
  });
  it('returns an empty object for no rows', () => {
    expect(groupBowlersBySeason([] as any)).toEqual({});
  });
});

describe('assembleTeamView', () => {
  const recordsets = () => [
    [{ bowlerID: 1, bowlerName: 'A', slug: 'a', gamesBowled: 9, seasonAverage: 189, firstSeason: 'Spring 2026' }], // 0 currentRoster
    [{ seasonID: 36, displayName: 'Spring 2026' }, { seasonID: 34, displayName: 'Spring 2025' }],                   // 1 teamSeasons
    [{ bowlerID: 1, bowlerName: 'A', slug: 'a', totalGames: 39, totalPins: 7100, average: 182, seasonsWithTeam: 2, firstSeason: 'Spring 2025', lastSeason: 'Spring 2026' }], // 2 allTimeRoster
    [{ teamID: 7, teamName: 'Lucky Strikes', seasonID: 36 }],                                                        // 3 franchiseHistory
    [{ divisionRank: 3, divisionSize: 6, wins: 12, losses: 8 }],                                                    // 4 currentStanding (TeamCurrentStanding.divisionRank)
    [{ opponentID: 9, opponentName: 'Hot Shotz', seasonID: 36, week: 4 }],                                          // 5 h2h (TeamH2HMatchup)
    [{ opponentID: 9, opponentName: 'Hot Shotz', seasonID: 34, round: 'Semifinal', won: true }],                     // 6 playoffH2H (PlayoffH2HMatchup.won boolean, one row per matchup)
    [ // 7 all-season bowlers
      { seasonID: 36, bowlerID: 1, bowlerName: 'A', slug: 'a', gamesBowled: 9, totalPins: 1700, average: 189 },
      { seasonID: 34, bowlerID: 1, bowlerName: 'A', slug: 'a', gamesBowled: 30, totalPins: 5400, average: 180 },
    ],
  ];
  it('maps the 8 recordsets into the DTO and builds bowlersBySeason', () => {
    const view = assembleTeamView(recordsets() as any);
    expect(view.currentRoster).toHaveLength(1);
    expect(view.teamSeasons).toHaveLength(2);
    expect(view.allTimeRoster[0].totalGames).toBe(39);
    expect(view.franchiseHistory[0].teamName).toBe('Lucky Strikes');
    expect(view.currentStanding?.divisionRank).toBe(3);
    expect(view.h2hMatchups[0].opponentName).toBe('Hot Shotz');
    expect(view.playoffH2H[0].won).toBe(true);
    expect(view.bowlersBySeason[36][0].gamesBowled).toBe(9);
    expect(view.bowlersBySeason[34][0].gamesBowled).toBe(30);
  });
  it('currentStanding null when recordset 4 empty; empty arrays elsewhere', () => {
    const view = assembleTeamView([[], [], [], [], [], [], [], []] as any);
    expect(view.currentStanding).toBeNull();
    expect(view.currentRoster).toEqual([]);
    expect(view.bowlersBySeason).toEqual({});
  });
});
```

- [ ] **Step 2:** Run it — expected FAIL (`Cannot find module './team-page'`).

- [ ] **Step 3: Write the helpers.** Create `src/lib/views/team-page.ts`. Import the row interfaces from the query modules (do not redefine). The DTO field names MUST match what the page reads (currentRoster, teamSeasons, allTimeRoster, franchiseHistory, currentStanding, h2hMatchups, playoffH2H, bowlersBySeason):

```ts
/**
 * Team page view-model: one batched per-team read + pure assembly.
 * Mirrors src/lib/views/bowler-page.ts. Consolidates 8 per-team SELECTs (7 reused
 * verbatim + one all-seasons-bowlers query that replaces the per-season N+1) into
 * one mssql request (result.recordsets[0..7]).
 */
import type { TeamRosterMember, TeamSeasonBowler, AllTimeRosterMember } from '../queries/teams/roster';
import type { TeamSeasonRow, FranchiseNameEntry } from '../queries/teams/history';
import type { TeamCurrentStanding } from '../queries/teams/profile';
import type { TeamH2HMatchup, PlayoffH2HMatchup } from '../queries/teams/h2h';

export interface TeamPageView {
  currentRoster: TeamRosterMember[];
  teamSeasons: TeamSeasonRow[];
  allTimeRoster: AllTimeRosterMember[];
  franchiseHistory: FranchiseNameEntry[];
  currentStanding: TeamCurrentStanding | null;
  h2hMatchups: TeamH2HMatchup[];
  playoffH2H: PlayoffH2HMatchup[];
  bowlersBySeason: Record<number, TeamSeasonBowler[]>;
}

type AllSeasonBowlerRow = TeamSeasonBowler & { seasonID: number };

/** Bucket all-season bowler rows by seasonID (rows arrive pre-ordered within season). */
export function groupBowlersBySeason(rows: AllSeasonBowlerRow[]): Record<number, TeamSeasonBowler[]> {
  const out: Record<number, TeamSeasonBowler[]> = {};
  for (const r of rows) {
    const { seasonID, ...bowler } = r;
    (out[seasonID] ??= []).push(bowler);
  }
  return out;
}

/**
 * Assemble the flat DTO from the 8 recordsets, in this fixed order:
 * 0 currentRoster, 1 teamSeasons, 2 allTimeRoster, 3 franchiseHistory,
 * 4 currentStanding, 5 h2h, 6 playoffH2H, 7 allSeasonBowlers.
 */
export function assembleTeamView(recordsets: unknown[][]): TeamPageView {
  return {
    currentRoster: (recordsets[0] ?? []) as TeamRosterMember[],
    teamSeasons: (recordsets[1] ?? []) as TeamSeasonRow[],
    allTimeRoster: (recordsets[2] ?? []) as AllTimeRosterMember[],
    franchiseHistory: (recordsets[3] ?? []) as FranchiseNameEntry[],
    currentStanding: ((recordsets[4] ?? [])[0] as TeamCurrentStanding) ?? null,
    h2hMatchups: (recordsets[5] ?? []) as TeamH2HMatchup[],
    playoffH2H: (recordsets[6] ?? []) as PlayoffH2HMatchup[],
    bowlersBySeason: groupBowlersBySeason((recordsets[7] ?? []) as AllSeasonBowlerRow[]),
  };
}
```
NOTE: if the imported interface names differ from those above, correct them from the actual query modules (Task 1 step 5 lists where each lives). Do not invent fields.

- [ ] **Step 4:** Run tests — expected PASS.
- [ ] **Step 5:** `npx tsc --noEmit` — exits 0.
- [ ] **Step 6:** Commit:
```bash
git add src/lib/views/team-page.ts src/lib/views/team-page.test.ts
git commit -m "feat: pure team view-model assembly + N+1 season-bowler grouping (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0126jX3qkNnUBEVPWQNYz7dE"
```

---

## Task 3: getTeamPageView — one 8-statement batched read

**Files:** Modify `src/lib/views/team-page.ts`. Mirror `getBowlerPageView` in `bowler-page.ts` exactly, but with `dependsOn: ['scores','schedule','bowlers']` instead of `{ bowlerID }`.

- [ ] **Step 1:** Add imports at the top:
```ts
import { cache } from 'react';
import { getDb, cachedQuery } from '../db';
import { GET_TEAM_CURRENT_ROSTER_SQL, GET_TEAM_ALL_TIME_ROSTER_SQL } from '../queries/teams/roster';
import { GET_TEAM_SEASON_BY_SEASON_SQL, GET_TEAM_FRANCHISE_HISTORY_SQL } from '../queries/teams/history';
import { GET_TEAM_H2H_SQL, GET_TEAM_PLAYOFF_H2H_SQL } from '../queries/teams/h2h';
import { GET_TEAM_CURRENT_STANDING_SQL } from '../queries/teams/profile';
```

- [ ] **Step 2:** Append the new SQL, batch, EMPTY_VIEW, and cached read:
```ts
/** All-seasons bowler rows for the team (replaces the per-season N+1). Statement 8. */
const GET_TEAM_ALL_SEASON_BOWLERS_SQL = `
  SELECT
    sc.seasonID,
    b.bowlerID,
    b.bowlerName,
    b.slug,
    COUNT(sc.scoreID) * 3 AS gamesBowled,
    SUM(sc.scratchSeries) AS totalPins,
    CAST(
      SUM(sc.scratchSeries) * 1.0 /
      NULLIF(COUNT(sc.scoreID) * 3, 0)
    AS DECIMAL(5,1)) AS average
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.teamID = @teamID
    AND sc.isPenalty = 0
  GROUP BY sc.seasonID, b.bowlerID, b.bowlerName, b.slug
  ORDER BY sc.seasonID, gamesBowled DESC, average DESC
`;

/**
 * Batched per-team SQL. Order MUST match assembleTeamView's recordset order:
 * 0 currentRoster, 1 teamSeasons, 2 allTimeRoster, 3 franchiseHistory,
 * 4 currentStanding, 5 h2h, 6 playoffH2H, 7 allSeasonBowlers.
 * The first 7 are reused verbatim from the query modules - do NOT edit them here.
 */
export const TEAM_VIEW_BATCH_SQL = [
  GET_TEAM_CURRENT_ROSTER_SQL,
  GET_TEAM_SEASON_BY_SEASON_SQL,
  GET_TEAM_ALL_TIME_ROSTER_SQL,
  GET_TEAM_FRANCHISE_HISTORY_SQL,
  GET_TEAM_CURRENT_STANDING_SQL,
  GET_TEAM_H2H_SQL,
  GET_TEAM_PLAYOFF_H2H_SQL,
  GET_TEAM_ALL_SEASON_BOWLERS_SQL,
].join(';\n');

const EMPTY_VIEW: TeamPageView = {
  currentRoster: [],
  teamSeasons: [],
  allTimeRoster: [],
  franchiseHistory: [],
  currentStanding: null,
  h2hMatchups: [],
  playoffH2H: [],
  bowlersBySeason: {},
};

/**
 * One round-trip for the whole team page (was ~11 + one per season). No per-team
 * data-version channel exists, so invalidate on the union of channels the folded
 * queries read: scores, schedule, bowlers. This also gives franchiseHistory +
 * playoffH2H real invalidation (they were stable:true on mutable tables).
 */
export const getTeamPageView = cache(async (teamID: number): Promise<TeamPageView> => {
  return cachedQuery(
    `getTeamPageView-${teamID}`,
    async () => {
      const db = await getDb();
      const result = await db.request().input('teamID', teamID).query(TEAM_VIEW_BATCH_SQL);
      return assembleTeamView(result.recordsets as unknown[][]);
    },
    EMPTY_VIEW,
    { sql: TEAM_VIEW_BATCH_SQL, dependsOn: ['scores', 'schedule', 'bowlers'] },
  );
});
```

- [ ] **Step 3:** `npx tsc --noEmit` — exits 0.
- [ ] **Step 4:** Re-run `npx vitest run src/lib/views/team-page.test.ts` — PASS.
- [ ] **Step 5:** Commit:
```bash
git add src/lib/views/team-page.ts
git commit -m "feat: getTeamPageView batched read - fixes N+1, folds 2 stable:true queries

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0126jX3qkNnUBEVPWQNYz7dE"
```

---

## Task 4: getTeamLeagueContext — 2 shared reads

**Files:** Create `src/lib/views/team-league-context.ts`. Mirror `src/lib/views/league-context.ts`.

- [ ] **Step 1:** Write it:
```ts
/**
 * Shared league-wide context for the team page (identical for every team).
 * React.cache composition of existing cached reads - no new cache entry.
 */
import { cache } from 'react';
import { getCurrentSeasonSlug } from '@/lib/queries';
import { getActiveTeamIDs } from '@/lib/queries/teams/h2h';

export interface TeamLeagueContext {
  activeTeams: number[];
  currentSlug: string | undefined;
}

export const getTeamLeagueContext = cache(async (): Promise<TeamLeagueContext> => {
  const [activeTeams, currentSlug] = await Promise.all([
    getActiveTeamIDs(),
    getCurrentSeasonSlug(),
  ]);
  return { activeTeams, currentSlug };
});
```
- [ ] **Step 2:** Verify the imports resolve. `getActiveTeamIDs` returns `number[]` (confirm — it may return a typed array; match the actual return type in the interface). If `getActiveTeamIDs` is exported from the barrel `@/lib/queries`, import it from there instead. Check with `grep -rn "export .*getActiveTeamIDs" src/lib/queries`.
- [ ] **Step 3:** `npx tsc --noEmit` — exits 0.
- [ ] **Step 4:** Commit:
```bash
git add src/lib/views/team-league-context.ts
git commit -m "feat: getTeamLeagueContext bundles the 2 shared team-page reads

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0126jX3qkNnUBEVPWQNYz7dE"
```

---

## Task 5: Convert the team page to the flat read

**Files:** Modify `src/app/team/[slug]/page.tsx`. READ the current file first. `generateMetadata` stays as-is (uses `getTeamBySlug`).

- [ ] **Step 1: Replace the query imports.** Replace the big `@/lib/queries` block (getTeamBySlug, getTeamCurrentRoster, getTeamSeasonByseason, getTeamSeasonBowlers, getTeamAllTimeRoster, getTeamFranchiseHistory, getTeamCurrentStanding, getTeamH2H, getActiveTeamIDs, getGhostTeamH2H, getTeamPlayoffH2H, getCurrentSeasonSlug, type TeamSeasonBowler) with:
```ts
import { getTeamBySlug, getGhostTeamH2H, type GhostTeamMatchup } from '@/lib/queries';
import { getTeamPageView } from '@/lib/views/team-page';
import { getTeamLeagueContext } from '@/lib/views/team-league-context';
```
Keep all the component imports and the two local helper components (`GhostTeamAllTime`, `GhostTeamExplainer`) unchanged. `getTeamBySlug` + `getGhostTeamH2H` stay from the barrel; `GhostTeamMatchup` type too. Remove the now-unused `TeamSeasonBowler` import (it comes typed inside the view now). If `getGhostTeamH2H`/`GhostTeamMatchup` are not in the barrel, import from `@/lib/queries/teams/h2h`.

- [ ] **Step 2: Replace the body data-fetch (page.tsx:147-167).** Replace the `// Parallel build-time data fetching` `Promise.all([...10...])` AND the `bowlersBySeason` N+1 loop with:
```ts
  const [view, league] = await Promise.all([
    getTeamPageView(team.teamID),
    getTeamLeagueContext(),
  ]);

  const { currentRoster, teamSeasons, allTimeRoster, franchiseHistory, currentStanding, h2hMatchups, playoffH2H, bowlersBySeason } = view;
  const { activeTeams, currentSlug } = league;

  // Ghost Team (teamID 45) uses a bespoke matchup query; unused for all other teams.
  const ghostH2H = isGhostTeam ? await getGhostTeamH2H() : [];
```
`isGhostTeam` is already computed above this block (`const isGhostTeam = team.teamID === 45;`). Keep it. The rest of the derivations below (rosterCount, seasonsActive, ghostWinPct) reference `currentRoster`, `teamSeasons`, `ghostH2H` — all now defined. Keep them unchanged.

- [ ] **Step 3:** The JSX return block is UNCHANGED — it already reads `currentRoster`, `teamSeasons`, `bowlersBySeason`, `allTimeRoster`, `franchiseHistory`, `currentStanding`, `h2hMatchups`, `playoffH2H`, `activeTeams`, `ghostH2H`, `ghostWinPct`, `currentSlug`, `rosterCount`, `seasonsActive`, `isGhostTeam`, all with identical names. Do NOT change any JSX.

- [ ] **Step 4:** `npx tsc --noEmit` — exits 0. Remove any leftover unused import it flags.
- [ ] **Step 5:** Re-run the team unit tests — PASS.
- [ ] **Step 6: Verify render behind the wall.** `npm run dev`, then eyeball vs the pre-change page:
  - A long-running current team (exercises the N+1 fix + many seasons): e.g. `http://localhost:3000/team/lucky-strikes`
  - A historical/defunct team.
  - The Ghost Team: `http://localhost:3000/team/ghost-team` (the bespoke branch).
  - Unknown slug -> 404.
  Confirm all six sections render identically (roster, season-by-season WITH each season's bowlers, all-time roster, franchise history, H2H, playoff H2H; ghost shows its special sections).
- [ ] **Step 7:** Commit:
```bash
git add src/app/team/[slug]/page.tsx
git commit -m "perf: team page reads one batched view + shared league context (~30 -> ~2 round-trips)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0126jX3qkNnUBEVPWQNYz7dE"
```

---

## Task 6: Measure the gate (round-trips + N+1 correctness)

**Files:** Create `scripts/phase3/profile-team-view.mjs`. Model on `scripts/phase3/profile-bowler-view.mjs` (the shipped bowler profiler — READ it).

- [ ] **Step 1:** Write the profiler. For a few sampled teams (heaviest by season count, a mid team, and the Ghost Team id 45):
  1. Resolve teamID + slug.
  2. Time the batched read (`.input('teamID', id).query(TEAM_VIEW_BATCH_SQL)`), assert `recordsets.length === 8` (one-round-trip proof).
  3. **N+1 correctness:** for each of the team's seasons, run the OLD per-season `GET_TEAM_SEASON_BOWLERS_SQL` (with `@teamID` + `@seasonID`) and compare its rows to `groupBowlersBySeason(recordsets[7])[seasonID]` — assert same bowlers, same order, same games/pins/average per season. Print PASS/FAIL.
  4. **Round-trip comparison:** print batched (1 round-trip) vs legacy (7 base per-team queries + N per-season bowler queries = 7 + seasonCount) round-trip count and summed ms.
  Extract SQL via the same regex helper; the new `GET_TEAM_ALL_SEASON_BOWLERS_SQL` lives in `src/lib/views/team-page.ts`.
- [ ] **Step 2:** Run `node scripts/phase3/profile-team-view.mjs`. Expected: 1 round-trip (8 recordsets), per-season bowler data matches the legacy per-season path for every season, big round-trip reduction. Paste full output.
- [ ] **Step 3:** Do NOT crawl team pages concurrently (on-demand; saturates the DB). Verify a couple individually behind the bypass.
- [ ] **Step 4:** Commit:
```bash
git add scripts/phase3/profile-team-view.mjs
git commit -m "chore: phase3 team view-model profiler (round-trip + N+1 correctness gate)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0126jX3qkNnUBEVPWQNYz7dE"
```

---

## Self-Review Notes (for the executor)

- **Reference implementation:** `src/lib/views/bowler-page.ts` + `league-context.ts` + `src/app/bowler/[slug]/page.tsx` are the shipped analog. When in doubt, match their shape.
- **The N+1 is the headline win** and the one piece with genuinely new SQL — Task 6 step 1.3 is the correctness anchor (grouped-by-season must equal per-season). Do not skip it.
- **Cache key deviates from bowler on purpose:** `dependsOn: ['scores','schedule','bowlers']`, NOT a per-team tag (no teamID channel exists). This coarser invalidation is acceptable (few on-demand team pages) and is what lets us fold the 2 `stable:true` queries in with real invalidation.
- **Content:** all six sections kept (Russ: keep unless too slow — it won't be, per the bowler result). Ghost Team stays a separate branch.
- **No em dashes** anywhere in new code or comments (hard project rule). Use `-` or `:`.
- **After this gate passes:** roll the same shape to season/week/stats pages, then relaunch the whole site (flip `MAINTENANCE_MODE` off).
