---
phase: 05-polish-and-team-h2h
plan: 02
subsystem: ui
tags: [sql, react, head-to-head, matchResults, expand-collapse]

requires:
  - phase: 04-teams-and-seasons
    provides: "Team profile page, matchResults table (786 rows), schedule table, team page routing"
provides:
  - "getTeamH2H query returning all matchup rows per team across 10 seasons"
  - "getActiveTeamIDs query for currently active teams"
  - "HeadToHead component with summary table and expandable per-opponent drill-down"
affects: [06-all-time-leaderboards]

tech-stack:
  added: []
  patterns: ["Client-side grouping of flat query results into summary + detail views"]

key-files:
  created: []
  modified:
    - src/lib/queries/teams.ts
    - src/components/team/HeadToHead.tsx
    - src/app/team/[slug]/page.tsx

key-decisions:
  - "Single flat query per team returning all matchup rows; component groups by opponent client-side"
  - "Win/loss determined by comparing ourGamePts vs theirGamePts per matchup week"
  - "Ghost Team included naturally as an opponent with no special filtering"

patterns-established:
  - "Flat query + client-side grouping: fetch all rows in one query, group/aggregate in component with useMemo"

requirements-completed: []

duration: 2min
completed: 2026-03-08
---

# Phase 5 Plan 02: Team H2H Summary

**Real head-to-head matchup records on team pages with summary table sorted by rivalry intensity and expandable per-opponent drill-down across 10 seasons**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-08T21:01:41Z
- **Completed:** 2026-03-08T21:03:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Replaced HeadToHead placeholder with real matchup data from matchResults table (786 rows, 10 seasons)
- Summary table shows W/L/T/win% per opponent sorted by most matchups first (biggest rivalries)
- Click-to-expand drill-down shows individual matchup history with dates, season links, weekly results links, and color-coded W/L/T indicators
- "Have not yet faced" list shows only currently active teams without matchup history

## Task Commits

Each task was committed atomically:

1. **Task 1: H2H query function and TypeScript interfaces** - `efef4d3` (feat)
2. **Task 2: HeadToHead component and team page wiring** - `805b6c4` (feat)

## Files Created/Modified
- `src/lib/queries/teams.ts` - Added getTeamH2H, getActiveTeamIDs, TeamH2HMatchup, TeamH2HActiveTeam
- `src/components/team/HeadToHead.tsx` - Complete rewrite from placeholder to interactive H2H component
- `src/app/team/[slug]/page.tsx` - Added H2H data fetching to Promise.all, passed props to HeadToHead

## Decisions Made
- Single flat query per team returning all matchup rows; component groups by opponent client-side using useMemo -- simpler than aggregating in SQL, one DB round-trip
- Win/loss per matchup week determined by comparing ourGamePts vs theirGamePts (not individual games)
- Ghost Team included naturally as an opponent -- no special filtering needed
- "Not yet faced" list uses a separate getActiveTeamIDs query with stable cache flag

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Team H2H section is fully functional with real data
- All team pages now show complete profiles (hero, roster, seasons, all-time, H2H)
- Ready for Phase 6 leaderboards and profile depth work

---
*Phase: 05-polish-and-team-h2h*
*Completed: 2026-03-08*
