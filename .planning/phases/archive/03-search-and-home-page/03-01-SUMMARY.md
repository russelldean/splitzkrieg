---
phase: 03-search-and-home-page
plan: 01
subsystem: database
tags: [mssql, react-cache, typescript, queries]

requires:
  - phase: 02-bowler-profiles
    provides: "Established query pattern (env check, try/catch, React.cache) in queries.ts"
provides:
  - "getNextBowlingNight() for countdown clock"
  - "getAllBowlersDirectory() for /bowlers directory page"
  - "getRecentMilestones() for milestone ticker"
  - "getCurrentSeasonSnapshot() for season stats card"
  - "DirectoryBowler, Milestone, SeasonSnapshot TypeScript interfaces"
affects: [03-02, 03-03]

tech-stack:
  added: []
  patterns:
    - "Multi-step sequential queries within single function for complex aggregations (getCurrentSeasonSnapshot)"
    - "CROSS JOIN VALUES for threshold-based milestone detection"

key-files:
  created: []
  modified:
    - src/lib/queries.ts

key-decisions:
  - "Used sequential queries for SeasonSnapshot rather than single complex JOIN for readability"
  - "Career game milestones use COUNT(scoreID)*3 matching existing pattern for game counting"

patterns-established:
  - "Phase 3 query section header separates home page queries from profile queries"

requirements-completed: [HOME-03, HOME-04, HOME-05]

duration: 2min
completed: 2026-03-03
---

# Phase 3 Plan 1: Home Page Data Layer Summary

**Four build-time query functions for home page countdown, milestone ticker, season snapshot, and bowler directory with full TypeScript interfaces**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T13:56:06Z
- **Completed:** 2026-03-03T13:57:31Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added getNextBowlingNight and getAllBowlersDirectory with DirectoryBowler interface
- Added getRecentMilestones with career game threshold detection (50-500 game milestones)
- Added getCurrentSeasonSnapshot with nested top average, high game, high series aggregations
- All four functions follow established error handling pattern with graceful defaults

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getNextBowlingNight and getAllBowlersDirectory queries** - `199d0fa` (feat)
2. **Task 2: Add getRecentMilestones and getCurrentSeasonSnapshot queries** - `9ab972b` (feat)

## Files Created/Modified
- `src/lib/queries.ts` - Four new query functions and three new TypeScript interfaces for Phase 3 home page components

## Decisions Made
- Used sequential queries in getCurrentSeasonSnapshot (5 separate queries) rather than a single monolithic SQL statement for readability and maintainability -- acceptable at build time
- Career game milestones computed as COUNT(scoreID) * 3, consistent with existing gamesBowled calculation pattern
- Milestone "recently achieved" window set to 9 games above threshold (~3 bowling nights)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four query functions are exported and ready for Plans 02 and 03 to build components
- TypeScript interfaces provide stable contracts for component development
- React.cache wrappers in place for functions used by both generateMetadata and page components

---
*Phase: 03-search-and-home-page*
*Completed: 2026-03-03*
