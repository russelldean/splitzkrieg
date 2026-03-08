---
phase: 05-polish-and-team-h2h
plan: 01
subsystem: ui
tags: [next.js, react, sql, standings, team-hero, collapsible]

# Dependency graph
requires:
  - phase: 04-teams-seasons
    provides: Team profile pages, standings component, season stats table
provides:
  - Standings heading with week context
  - TeamHero W-L record with league nights link
  - Collapsible season stats (3 most recent by default)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client component for expand/collapse state in SeasonStatsTable"
    - "matchCounts CTE pattern for deriving losses from game points"

key-files:
  created: []
  modified:
    - src/components/season/Standings.tsx
    - src/components/team/TeamHero.tsx
    - src/components/bowler/SeasonStatsTable.tsx
    - src/lib/queries/teams.ts
    - src/app/season/[slug]/page.tsx

key-decisions:
  - "Losses computed as (matchWeeks * 3 - wins) to handle ties as half-values"
  - "TeamHero links to /week/{seasonSlug} (league nights) instead of /season/{slug}#standings"
  - "SeasonStatsTable converted to client component for expand/collapse state"

patterns-established:
  - "Collapsible table pattern: useState + slice with always-visible totals row"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-03-08
---

# Phase 05 Plan 01: Polish Items Summary

**Standings week context, TeamHero full W-L record with league nights link, and collapsible season stats table**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-08T21:01:34Z
- **Completed:** 2026-03-08T21:04:04Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Standings heading shows "(after Wk N)" for temporal context
- TeamHero standing card displays full W-L record and links to league nights page
- SeasonStatsTable shows 3 most recent seasons by default with "Show all" expander, career totals always visible

## Task Commits

Each task was committed atomically:

1. **Task 1: Standings week number and TeamHero W-L record** - `1b2ca9b` (feat)
2. **Task 2: SeasonStatsTable collapsible seasons** - `d10f41d` (feat)

## Files Created/Modified
- `src/lib/queries/teams.ts` - Added losses field and matchCounts CTE to TeamCurrentStanding query
- `src/components/season/Standings.tsx` - Added weekNumber prop, displays "after Wk N" in heading
- `src/app/season/[slug]/page.tsx` - Passes totalWeeks as weekNumber to Standings
- `src/components/team/TeamHero.tsx` - Shows W-L record, links to /week/ league nights page
- `src/components/bowler/SeasonStatsTable.tsx` - Client component with expand/collapse for 3+ seasons

## Decisions Made
- Losses derived from matchCounts CTE: `(matchWeeks * 3) - wins` handles ties as half-values naturally
- TeamHero standing card links to league nights (/week/) per CONTEXT.md locked decisions
- SeasonStatsTable uses 'use client' with useState for expand/collapse -- minimal client JS

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All polish items complete, ready for plan 02 (Team H2H)
- No blockers

---
*Phase: 05-polish-and-team-h2h*
*Completed: 2026-03-08*
