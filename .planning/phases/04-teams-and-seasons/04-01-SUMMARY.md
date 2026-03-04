---
phase: 04-teams-and-seasons
plan: 01
subsystem: database
tags: [mssql, typescript, queries, teams, seasons, react-cache]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "getDb() connection pool, queries.ts pattern, db.ts"
  - phase: 02-bowler-profiles
    provides: "Established query patterns (React.cache, parameterized inputs, isPenalty filter)"
provides:
  - "17 new query functions for teams and seasons data layer"
  - "17 TypeScript interfaces for team and season data contracts"
  - "Team queries: slugs, profile, roster, season-by-season, all-time roster, franchise history, directory"
  - "Season queries: slugs, profile, standings, leaderboards, full stats, schedule, records, directory, hero stats"
affects: [04-02-PLAN, 04-03-PLAN, 04-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Season slug computed inline: LOWER(REPLACE(displayName, ' ', '-'))"
    - "teamNameHistory JOIN for historical team names (seasonID, teamID, teamName)"
    - "Switch-based leaderboard query builder for gender-split categories"
    - "SeasonRecords as composite object from multiple TOP 1 subqueries"

key-files:
  created: []
  modified:
    - src/lib/queries.ts

key-decisions:
  - "Adapted FranchiseNameEntry to actual DB schema (id, seasonID, teamName) vs plan's assumed schema (teamNameHistoryId, teamName, startDate, endDate)"
  - "Used switch/case in getSeasonLeaderboard for readable category-specific SQL generation"
  - "getSeasonHeroStats as dedicated lightweight query rather than deriving from getSeasonFullStats"

patterns-established:
  - "Team query section with 8 functions under '// Phase 4: Team Queries' header"
  - "Season query section with 9 functions under '// Phase 4: Season Queries' header"
  - "Season slug strategy: compute in SQL, no slug column on seasons table"

requirements-completed: [TEAM-01, TEAM-02, TEAM-03, TEAM-04, SEASN-01, SEASN-02, SEASN-04, SEASN-05]

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 4 Plan 1: Team and Season Data Layer Summary

**17 SQL query functions with TypeScript interfaces for teams (roster, stats, franchise history, directory) and seasons (standings, leaderboards, schedule, records, directory)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T23:52:38Z
- **Completed:** 2026-03-04T23:56:03Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- 8 team query functions covering slugs, profiles, rosters, season-by-season stats, all-time roster, franchise history, and directory listing
- 9 season query functions covering slugs, profiles, standings with division grouping, gender-split leaderboards, full stats, schedule, records, directory with champion placeholder, and hero stats
- All queries follow established patterns: getDb(), parameterized .input(), isPenalty=0, React.cache where needed
- TypeScript compiles cleanly with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add team query functions and interfaces** - `e9cb858` (feat)
2. **Task 2: Add season query functions and interfaces** - `80c60c6` (feat)

## Files Created/Modified
- `src/lib/queries.ts` - Added 17 new exported query functions and 17 TypeScript interfaces under Team Queries and Season Queries sections

## Decisions Made
- Adapted FranchiseNameEntry interface to match actual DB schema: teamNameHistory table has (id, seasonID, teamID, teamName) columns, not the (teamNameHistoryId, teamName, startDate, endDate) assumed in the plan. The actual table maps team names per season rather than using date ranges.
- Used switch/case pattern in getSeasonLeaderboard to build category-specific SQL. This keeps the function readable while supporting 7 leaderboard categories (avg, highGame, highSeries, totalPins, games200, series600, turkeys) with gender filtering.
- Created getSeasonHeroStats as a dedicated lightweight query rather than deriving from getSeasonFullStats, avoiding loading the full stats table just for hero section display.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted FranchiseNameEntry to actual DB schema**
- **Found during:** Task 1 (Team query functions)
- **Issue:** Plan assumed teamNameHistory has columns (teamNameHistoryID, teamName, startDate, endDate) but actual DB table has (id, seasonID, teamID, teamName) -- confirmed via populate script and existing query usage
- **Fix:** Changed FranchiseNameEntry interface to use {id, seasonID, teamName} and updated getTeamFranchiseHistory to JOIN with seasons table for chronological ordering
- **Files modified:** src/lib/queries.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** e9cb858 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Schema adaptation necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 17 query functions ready for consumption by Plan 02 (team pages) and Plan 03 (season pages)
- Every function has typed return values for strong component contracts
- React.cache applied to queries that will be called from both generateMetadata and page components
- seasonChampions LEFT JOIN in getAllSeasonsDirectory returns null until table is populated

---
*Phase: 04-teams-and-seasons*
*Completed: 2026-03-04*
