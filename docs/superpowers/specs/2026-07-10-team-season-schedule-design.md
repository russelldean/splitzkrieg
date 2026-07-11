# Team Season Schedule - Design

**Date:** 2026-07-10
**Status:** Approved (design), pending spec review

## Problem

There is no single place where a team (e.g. Lucky Strikes) can see its current-season
schedule. The team page (`/team/[slug]`) shows records, roster, season-by-season history,
and head-to-head, but nothing forward-looking. The schedule data exists in the DB
(`schedule` + `matchResults`) but is never surfaced per team as a chronological slate.

Confirmed there is no existing/dormant team schedule component to duplicate. The team page
renders: `TeamHero`, `TeamSeasonByseason`, `AllTimeRoster`, `HeadToHead`, `PlayoffH2H`
(+ ghost-team variants). `HeadToHead` is the nearest neighbor but is organized by opponent
across all seasons (all-time matchup history), not a current-season chronological schedule
with upcoming games. Nothing is hidden waiting for data that would overlap this feature.

## Goal

Add a "Season Schedule" section to the team page for teams in the current season. It shows
the full current-season slate (played + upcoming) with a compact visual of the season trend
plus a detail table.

## Scope

- Current season only. Hidden entirely for teams not in the current season.
- Regular season matches (`schedule` + `matchResults`). Playoffs out of scope for v1
  (they live in `playoffResults`); can be a fast-follow.
- No home/away and no lane (neither is cleanly in the DB; home/away is not meaningful here).

## Scoring model (verified in `scripts/populate-match-results.mjs` + schema)

There is **no match-level W/L**. A night is just the points a team earned, up to **9**:

- **Game points** (bottom strip segment): 3 games x 2 points. Win = 2, tie = 1 each, loss = 0.
  Max **6**.
- **XP / bonus** (top strip segment): a single 0-3 rank by handicap series each night
  (top 5 -> 3, top 10 -> 2, top 15 -> 1). Max **3**.
- **Total for the night** = gamePts + xp (0-9).

`matchResults` ALREADY stores everything needed - no schema change, no populate change:

- `team1Game1/2/3`, `team2Game1/2/3` - per-game handicap totals (for the W-L-T record).
- `team1GamePts`, `team2GamePts` - game-point totals (0-6).
- `team1BonusPts`, `team2BonusPts` - XP (0-3).

## Shared util (extracted from `HeadToHead.tsx`)

`HeadToHead` already computes the per-night record from per-game totals via `countGames()`
and `nightRecordStr()` (format "W-L-T", e.g. "2-1-0"). Extract these into a shared module
(e.g. `src/lib/game-record.ts`) and have both `HeadToHead` and the new schedule use it, so the
record format stays consistent across the site. Pure functions over `{game1,game2,game3}`
pairs; no behavior change to `HeadToHead`.

## Data

New cached query:

```
getTeamCurrentSeasonSchedule(teamID: number, seasonID: number): TeamScheduleRow[]
```

Built from `schedule sch LEFT JOIN matchResults mr ON mr.scheduleID = sch.scheduleID`,
filtered to `sch.seasonID = @seasonID AND (sch.team1ID = @teamID OR sch.team2ID = @teamID)`,
ordered by `sch.week` (then `sch.matchDate`). The team resolves to whichever side (team1/team2)
it is; the opponent is the other side. Because a team only bowls its own night, `matchDate`
is unambiguous (Lucky Strikes' week 1 = July 20, not the "July 13 & July 20" split).

`TeamScheduleRow`:

```
{
  week: number;
  matchDate: string | null;        // the team's own night
  opponentName: string;
  opponentSlug: string;
  played: boolean;                  // false when no matchResults row yet
  // present only when played:
  ourGame1/2/3: number | null;      // team handicap totals per game (for the record)
  theirGame1/2/3: number | null;
  gamePts: number;                  // team's game-point total, 0-6
  xp: number;                       // team's bonus, 0-3
  total: number;                    // gamePts + xp, 0-9
}
```

- The W-L-T record is derived in the component via the shared `countGames()` over the
  `our*/their*` per-game totals - matches `HeadToHead` exactly.
- Gated by a schedule-based membership check, NOT `currentRoster` (that is scores-based
  and empty during preseason - it would hide the schedule exactly when captains want it).
  Add a shared cached `getCurrentSeasonTeamIDs(): Promise<Set<number>>` (DISTINCT team1ID/
  team2ID from the latest season's `schedule`), wrapped in React `cache()` so it runs once
  per build. Only teams in that set run `getTeamCurrentSeasonSchedule`, keeping it to ~20
  per-team queries + 1 shared, not 41.
- Cache: `dependsOn: ['scores', 'schedule']` (results change on weekly publish; schedule is
  stable-ish). Follows the existing `cachedQuery(..., { sql, dependsOn })` pattern; not
  `stable: true`.
- Standalone query, NOT folded into the batched `getTeamPageView` (that batch is carefully
  tuned and per-team cached; isolation is lower-risk for a ~20-query cost).

## Component: `TeamSchedule.tsx`

A "Season Schedule" section with two parts, both always visible.

### 1. Season strip (top) - `SeasonPointsStrip` (sub-component)

A row of per-week bottom-anchored stacked bars.

- Height of each bar = `total` (0-9). One unit-cell per point.
- Bottom segment = game points, **dark green**. Top segment = XP, **light green**. XP always
  stacks directly on top of game points - no gaps. Bar is shorter than 9 unless a full night.
- A faint background track up to 9 units so "6 of 9" is legible and weeks compare cleanly.
- Upcoming weeks (`played === false`): empty faint/gray track, no fill.
- The next unplayed match gets a star marker.
- Hover tooltip: `Wk 3 - vs Stinky Cheese - 2-1-0, 3 XP - 7 pts`.
- Click a bar -> `/week/[seasonSlug]/[week]`.
- Compact: ~60-75px tall. With ~9-11 weeks the bars are wide and readable.
- All-upcoming (no games played yet): all gray tracks, star on week 1.

### 2. Detail table (below)

Columns: **Week · Date · Opponent · Record · XP · Pts**.

- Date: the team's own night, full month (e.g. "July 20").
- Opponent: links to `/team/[opponentSlug]`.
- Record (played): W-L-T over the 3 games via the shared util (e.g. "2-1-0"), colored the way
  `HeadToHead` colors a night (green when W>L, amber on tie-heavy, muted when L>W).
- XP (played): 0-3.
- Pts (played): total for the night (0-9).
- Next unplayed match: amber "Next" highlight (reuse the standings marker style).
- Later upcoming rows: muted, no record/XP/pts.

## Placement / wiring

- `/team/[slug]/page.tsx`: `CurrentRoster` is imported but not actually rendered, so there is
  no "roster section" to anchor to. Render the `TeamSchedule` section as the FIRST item in the
  main content stack (the `mt-8 space-y-8` div), right after `TeamHero` - forward-looking info
  up top. Non-ghost teams only.
- Gate: fetch `getCurrentSeasonTeamIDs()` (shared, cached); if the team is not in the set (or is
  the Ghost Team, id 45), render nothing. Otherwise fetch `getTeamCurrentSeasonSchedule(teamID,
  currentSeasonID)` (via `getCurrentSeasonID()`) and render. `seasonSlug` for the week links
  comes from `getTeamLeagueContext().currentSlug`.

## Out of scope (v1)

- Playoff matches in the strip/table.
- Home/away, lane.

## Testing / verification

- Verify on the running dev server at `/team/lucky-strikes`:
  - Strip renders one bar per week; played weeks show green/light-green stacks summing to the
    night's points; upcoming weeks are gray; the next match has a star.
  - Table matches the strip (same weeks, opponents); record/XP/pts reconcile
    (record W*2 + T*1 + XP == pts in normal matches).
  - A non-current-season team (e.g. a defunct franchise) shows no section.
- `HeadToHead` still renders identically after the `countGames`/`nightRecordStr` extraction.
- Confirm no new em dashes and no cross-season cache bust (new query only).
