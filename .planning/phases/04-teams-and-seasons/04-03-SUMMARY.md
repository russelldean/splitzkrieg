---
phase: 04-teams-and-seasons
plan: 03
subsystem: ui
tags: [next.js, react, season-pages, standings, leaderboards, tabbed-ui, countdown]

# Dependency graph
requires:
  - phase: 04-01
    provides: season and team query functions, interfaces, matchResults data
provides:
  - Season page at /season/[slug] with hero, standings, leaderboards, records, full stats
  - Seasons directory at /seasons with reverse chronological listing
  - Tabbed leaderboards with Men's/Women's/Handicap sections
  - Handicap eligibility filtering (top 8 scratch ineligible)
  - Standings with Total Pts, Wins, XP from matchResults
affects: [04-04-weekly-results]

# Tech tracking
tech-stack:
  added: []
  patterns: [tabbed-client-component, server-data-client-tabs, handicap-eligibility-filter, timezone-aware-countdown]

key-files:
  created:
    - src/app/season/[slug]/page.tsx
    - src/app/seasons/page.tsx
    - src/components/season/SeasonHero.tsx
    - src/components/season/Standings.tsx
    - src/components/season/SeasonLeaderboards.tsx
    - src/components/season/FullStatsTable.tsx
  modified:
    - src/lib/queries.ts
    - src/components/home/CountdownClock.tsx

key-decisions:
  - "Standings ordered by Total Pts (Wins + XP) from matchResults, not total pins"
  - "Tabbed leaderboards (Men's/Women's/Handicap) instead of stacked sections for cleaner UX"
  - "Handicap eligibility: top 8 men's + top 8 women's scratch avg filtered from handicap leaders"
  - "Removed hcp high series from handicap tab (not meaningful to users)"
  - "strikeX styling on team names and season numerals only, never on bowler names"
  - "Countdown targets 7:15 PM Eastern using Intl.DateTimeFormat for timezone awareness"

patterns-established:
  - "Tabbed client component pattern: server fetches all data, client component switches tabs"
  - "Handicap eligibility filter: server-side filtering of scratch leaders from handicap standings"

requirements-completed: [SEASN-01, SEASN-02, SEASN-04]

# Metrics
duration: 8min
completed: 2026-03-04
---

# Phase 04 Plan 03: Season Pages Summary

**Season pages with tabbed leaderboards, matchResults-based standings (Total Pts/Wins/XP), handicap eligibility filtering, and timezone-aware countdown clock**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-05T00:55:25Z
- **Completed:** 2026-03-05T01:03:25Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Season page at /season/[slug] with hero, standings, tabbed leaderboards, records, and full sortable stats
- Standings now show Total Pts, Wins, XP (from matchResults), Scratch Avg (rank), HCP Avg (rank) -- removed Roster/Games/Pins/Weeks
- Leaderboards switched from stacked to tabbed (Men's/Women's/Handicap) for cleaner presentation
- Handicap eligibility filter: top 8 men's + top 8 women's scratch avg excluded from handicap tab
- Countdown clock fixed to target 7:15 PM Eastern (timezone-aware via Intl API)
- strikeX styling restricted to team names and season numerals only (not bowler names)
- Seasons directory at /seasons with reverse chronological list of all 35 seasons

## Task Commits

Each task was committed atomically:

1. **Task 1: Create season page with hero, standings, and leaderboards** - `1518c95` (feat)
2. **Task 2: Create full stats table and seasons directory** - `df8b03f` (feat)
3. **Task 3: Apply user feedback to season pages** - `fecd050` (fix)

## Files Created/Modified
- `src/app/season/[slug]/page.tsx` - Season page with static generation, handicap eligibility filter
- `src/app/seasons/page.tsx` - Seasons directory with reverse chronological listing
- `src/components/season/SeasonHero.tsx` - Season hero with stat pills and share button
- `src/components/season/Standings.tsx` - Standings table with Total Pts, Wins, XP, avg ranks
- `src/components/season/SeasonLeaderboards.tsx` - Tabbed leaderboards (Men's/Women's/Handicap) with records
- `src/components/season/FullStatsTable.tsx` - Sortable stats table with gender tabs
- `src/lib/queries.ts` - Updated StandingsRow interface and getSeasonStandings query (matchResults join)
- `src/components/home/CountdownClock.tsx` - Fixed countdown to target 7:15 PM Eastern

## Decisions Made
- Standings ordered by Total Pts (Wins + XP from matchResults unpivoted per-team) instead of total pins
- Tabbed leaderboards replace stacked sections -- cleaner UX when Men's/Women's/Handicap all have data
- Handicap eligibility: top 8 scratch avg bowlers (men's and women's separately) are ineligible for handicap playoffs, filtered from handicap leaderboard
- Removed hcp high series from handicap tab per user feedback (not meaningful)
- Season records section placed below tabs (always visible) instead of duplicated
- Countdown clock uses Intl.DateTimeFormat to detect ET offset for DST-aware 7:15 PM targeting

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] matchResults table schema mismatch**
- **Found during:** Task 3 (build verification)
- **Issue:** Initial standings query assumed matchResults had teamID/result/xp columns, but actual table uses scheduleID with team1GamePts/team2GamePts/team1BonusPts/team2BonusPts
- **Fix:** Rewrote CTE to unpivot matchResults via schedule join, aggregating gamePts as wins and bonusPts as XP per team
- **Files modified:** src/lib/queries.ts
- **Verification:** Build succeeds, all 35 season pages generated
- **Committed in:** Part of prior session commits (63bbafa)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correct standings data. No scope creep.

## Issues Encountered
- Build lock file needed manual removal (stale .next/lock from interrupted prior build)
- Pre-existing getRecentMilestones query error with 'current' keyword -- unrelated, did not affect season pages

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Season pages complete, ready for Plan 04 (weekly results and schedule integration)
- matchResults data confirmed working for standings aggregation
- Tabbed UI pattern established for reuse in weekly results display

---
*Phase: 04-teams-and-seasons*
*Completed: 2026-03-04*
