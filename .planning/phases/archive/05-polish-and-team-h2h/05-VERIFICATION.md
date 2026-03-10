---
phase: 05-polish-and-team-h2h
verified: 2026-03-08T21:30:00Z
status: human_needed
score: 13/13 must-haves verified
re_verification: false
human_verification:
  - test: "Load any season page in next dev -- check standings heading shows '(after Wk N)'"
    expected: "Standings heading reads 'Standings (after Wk N)' where N is the max week number"
    why_human: "Needs visual confirmation in browser"
  - test: "Load any active team page -- check hero card shows W-L record"
    expected: "Standing callout shows e.g. '12.5W-5.5L' and links to /week/{seasonSlug}"
    why_human: "Needs visual confirmation of layout and link target"
  - test: "Load a bowler with 4+ seasons -- check season stats table"
    expected: "Only 3 seasons visible, 'Show all N seasons' button present, career totals row visible below button"
    why_human: "Interactive expand/collapse behavior needs manual testing"
  - test: "Click 'Show all' button on season stats table"
    expected: "All seasons appear, button changes to 'Show fewer' with up chevron"
    why_human: "Client-side state toggle needs manual testing"
  - test: "Load any active team page -- check H2H section has real data"
    expected: "Summary table with opponent names, matchup counts, W/L/T, win%. Sorted by most matchups first."
    why_human: "Needs visual confirmation of data correctness and layout"
  - test: "Click an H2H summary row to expand drill-down"
    expected: "Individual matchups appear with date, season, week, W/L/T result (color-coded), series totals. Reverse chronological."
    why_human: "Interactive expand/collapse and color coding need manual testing"
  - test: "Check 'Have not yet faced' list on a team page"
    expected: "Only currently active teams shown, each linked to their team page"
    why_human: "Data correctness requires cross-referencing active teams"
  - test: "Check Ghost Team page H2H section"
    expected: "Ghost Team shows H2H data -- opponents who forfeited against it"
    why_human: "Edge case needs visual confirmation"
---

# Phase 5: Polish and Team H2H Verification Report

**Phase Goal:** Fix remaining bugs, add polish items, and wire up real head-to-head data on team pages
**Verified:** 2026-03-08T21:30:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

**Plan 01 Truths:**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Standings heading shows week number (e.g. 'Standings (after Wk 3)') | VERIFIED | `Standings.tsx` line 135 and 149: renders `(after Wk ${weekNumber})` when weekNumber is truthy |
| 2 | TeamHero standing card shows full W-L record, not just wins | VERIFIED | `TeamHero.tsx` line 50: renders `{currentStanding.wins}W-{currentStanding.losses}L` |
| 3 | TeamHero standing card links to league nights page for current season | VERIFIED | `TeamHero.tsx` line 41: `href={/week/${currentStanding.seasonSlug}}` |
| 4 | Bowler profile season stats table shows only 3 most recent seasons by default with 'Show all' expander | VERIFIED | `SeasonStatsTable.tsx` lines 10, 48, 108-133: `INITIAL_VISIBLE=3`, `visibleSeasons` slice, toggle button |
| 5 | Career totals row is always visible even when collapsed | VERIFIED | `SeasonStatsTable.tsx` lines 136-151: career totals row rendered after the expand/collapse toggle, outside the sliced array |

**Plan 02 Truths:**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | Team page shows H2H summary table with W, L, T, win% per opponent, sorted by most matchups | VERIFIED | `HeadToHead.tsx` lines 50-80: `useMemo` groups by opponent, computes W/L/T/winPct, sorts by `totalMatchups` DESC |
| 7 | Clicking a summary row expands to show individual matchup history (date, season, week, result, series totals) | VERIFIED | `HeadToHead.tsx` lines 162-206: `SummaryRow` with `onClick={onToggle}`, renders `DrillDown` when `isOpen` |
| 8 | H2H drill-down rows are reverse chronological (newest first) | VERIFIED | `teams.ts` query orders by `sn.year DESC, CASE sn.period... DESC, m.week DESC`; data arrives pre-sorted |
| 9 | W/L results are color-coded green (win), amber (tie), navy (loss) | VERIFIED | `HeadToHead.tsx` lines 20-24: `matchResultClass` returns green-600/amber-600/navy-65 |
| 10 | Opponent names link to their team pages | VERIFIED | `HeadToHead.tsx` lines 180-186: `Link href={/team/${s.opponentSlug}}` with `stopPropagation` |
| 11 | Drill-down rows link to weekly results page for that week | VERIFIED | `HeadToHead.tsx` line 231: `Link href={/week/${m.seasonSlug}/${m.week}}` |
| 12 | 'Have not yet faced' list shows only currently active teams with no matchups | VERIFIED | `HeadToHead.tsx` lines 82-87: filters `activeTeams` excluding `currentTeamID` and faced opponents |
| 13 | Ghost Team appears as a normal opponent in H2H (no special filtering) | VERIFIED | No Ghost Team filtering in query or component; team page renders HeadToHead for all teams including Ghost Team |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/season/Standings.tsx` | Week number in standings heading | VERIFIED | Contains `after Wk` pattern, weekNumber prop in interface |
| `src/components/team/TeamHero.tsx` | Full W-L record display and league nights link | VERIFIED | Contains `losses` field usage, links to `/week/` |
| `src/components/bowler/SeasonStatsTable.tsx` | Collapsible season stats with show/hide toggle | VERIFIED | Has `'use client'`, useState, INITIAL_VISIBLE=3, show/hide button |
| `src/lib/queries/teams.ts` | TeamCurrentStanding with losses, getTeamH2H, getActiveTeamIDs | VERIFIED | `losses` in interface and query, both H2H functions exported |
| `src/components/team/HeadToHead.tsx` | Full H2H UI with summary table and expandable drill-down | VERIFIED | `'use client'`, useMemo grouping, expand/collapse, drill-down table, color coding |
| `src/app/team/[slug]/page.tsx` | H2H data fetched and passed to HeadToHead component | VERIFIED | `getTeamH2H` and `getActiveTeamIDs` in Promise.all, props passed to HeadToHead |
| `src/app/season/[slug]/page.tsx` | Passes totalWeeks as weekNumber to Standings | VERIFIED | Line 121: `weekNumber={totalWeeks \|\| null}` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| season/[slug]/page.tsx | Standings.tsx | `weekNumber={totalWeeks \|\| null}` prop | WIRED | Line 121 passes computed totalWeeks |
| queries/teams.ts | TeamHero.tsx | `TeamCurrentStanding.losses` field | WIRED | Interface has losses, query computes it, component renders it |
| team/[slug]/page.tsx | queries/teams.ts | `getTeamH2H(team.teamID)` in Promise.all | WIRED | Line 104 in Promise.all destructuring |
| team/[slug]/page.tsx | HeadToHead.tsx | `matchups` prop | WIRED | Line 147: `<HeadToHead matchups={h2hMatchups} activeTeams={activeTeams} currentTeamID={team.teamID} />` |
| HeadToHead.tsx | /week/[seasonSlug]/[weekNum] | Link in drill-down rows | WIRED | Line 231: `href={/week/${m.seasonSlug}/${m.week}}` |

### Requirements Coverage

Both plans declare `requirements: []`. However, REQUIREMENTS.md maps 8 requirement IDs to Phase 5:

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BWLR-07 | None | Profile shows milestone tracker | ORPHANED | Leaderboard/profile depth feature -- belongs in Phase 6 per ROADMAP |
| BWLR-08 | None | Profile shows leaderboard context | ORPHANED | Leaderboard/profile depth feature -- belongs in Phase 6 per ROADMAP |
| BWLR-10 | None | Profile shows career timeline | ORPHANED | Profile enhancement -- belongs in Phase 6 per ROADMAP |
| LEAD-01 | None | All-time leaderboards filterable | ORPHANED | Explicitly listed in Phase 6 ROADMAP scope |
| LEAD-02 | None | Leaderboard categories | ORPHANED | Explicitly listed in Phase 6 ROADMAP scope |
| LEAD-03 | None | Sortable tables with profile links | ORPHANED | Explicitly listed in Phase 6 ROADMAP scope |
| LEAD-04 | None | Scratch vs handicap toggle | ORPHANED | Explicitly listed in Phase 6 ROADMAP scope |
| LEAD-05 | None | League-wide aggregate stats | ORPHANED | Explicitly listed in Phase 6 ROADMAP scope |

**Note:** These 8 requirements are stale mappings in REQUIREMENTS.md. The ROADMAP was updated to narrow Phase 5 scope to "Polish and Team H2H" and move all leaderboard/profile depth work to Phase 6. REQUIREMENTS.md should be updated to reflect the Phase 5 -> Phase 6 migration for these IDs.

### ROADMAP Success Criteria Coverage

The ROADMAP lists 4 success criteria for Phase 5:

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Mobile parallax works on iOS/Android | PRE-EXISTING | Already fixed before Phase 5 plans (per MEMORY.md: "Mobile parallax -- FIXED") |
| 2 | Standings show week number in title | VERIFIED | Standings.tsx renders "(after Wk N)" |
| 3 | Match results have color legend or tooltip | DROPPED | Per CONTEXT.md decisions: "Dropped -- green/red/amber color coding is self-explanatory" |
| 4 | Team H2H section shows real data for 10 seasons | VERIFIED | getTeamH2H query joins matchResults + schedule, HeadToHead renders full interactive UI |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns found |

No TODOs, FIXMEs, placeholders, empty implementations, or console.log-only handlers found in any modified file.

### Commits Verified

All 4 commits referenced in summaries exist in git history:

| Commit | Message | Plan |
|--------|---------|------|
| `1b2ca9b` | feat(05-01): standings week number and TeamHero W-L record | 05-01 |
| `d10f41d` | feat(05-01): collapsible season stats table | 05-01 |
| `efef4d3` | feat(05-02): add H2H query functions and TypeScript interfaces | 05-02 |
| `805b6c4` | feat(05-02): HeadToHead component with summary table and expandable drill-down | 05-02 |

### Human Verification Required

### 1. Standings Week Number Display

**Test:** Load any season page with score data in `next dev`
**Expected:** Standings heading reads "Standings (after Wk N)" where N is the max week number
**Why human:** Visual layout confirmation needed

### 2. TeamHero W-L Record and Link

**Test:** Load any active team page
**Expected:** Standing callout shows full W-L record (e.g. "12.5W-5.5L") and clicking navigates to `/week/{seasonSlug}`
**Why human:** Visual layout and navigation behavior

### 3. SeasonStatsTable Collapse/Expand

**Test:** Load a bowler with 4+ seasons
**Expected:** Only 3 seasons visible initially, "Show all N seasons" button present, career totals always visible. Clicking toggles all seasons.
**Why human:** Interactive client-side state behavior

### 4. H2H Summary Table and Drill-Down

**Test:** Load any active team page, scroll to Head-to-Head Records section
**Expected:** Summary table with opponents sorted by most matchups. Click row to expand drill-down with dates, scores, color-coded W/L/T.
**Why human:** Interactive expand/collapse, color coding, data correctness

### 5. Ghost Team H2H

**Test:** Load Ghost Team page
**Expected:** H2H section shows matchup data against teams that forfeited
**Why human:** Edge case data correctness

### Gaps Summary

No gaps found. All 13 observable truths verified across both plans. All artifacts exist, are substantive (no stubs), and are properly wired. No anti-patterns detected.

The 8 orphaned requirements in REQUIREMENTS.md (BWLR-07/08/10, LEAD-01-05) are stale mappings that should be updated to Phase 6, where the ROADMAP explicitly scopes them.

---

_Verified: 2026-03-08T21:30:00Z_
_Verifier: Claude (gsd-verifier)_
