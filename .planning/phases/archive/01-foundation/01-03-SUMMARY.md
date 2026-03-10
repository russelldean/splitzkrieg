---
phase: 01-foundation
plan: 03
subsystem: ui
tags: [fuse.js, search, autocomplete, static-generation, next.js-route-handler]

# Dependency graph
requires:
  - phase: 01-foundation/01
    provides: "SearchBar placeholder component and Header layout"
  - phase: 01-foundation/02
    provides: "Azure SQL connection pool (getDb) and bowler slug schema"
provides:
  - "Build-time search index JSON at /api/search-index"
  - "Client-side fuzzy search with Fuse.js in SearchBar"
  - "SearchEntry type for bowler search data"
affects: [02-bowler-profiles, ui-components]

# Tech tracking
tech-stack:
  added: [fuse.js]
  patterns: [static-route-handler-for-build-time-data, client-side-fuzzy-search]

key-files:
  created:
    - src/lib/search-index.ts
    - src/app/api/search-index/route.ts
  modified:
    - src/components/layout/SearchBar.tsx
    - package.json

key-decisions:
  - "Used bowlers.slug column directly instead of generating slugs from firstName/lastName -- ensures consistency with existing bowler page routing"
  - "LEFT JOIN roster for seasonsActive count -- includes bowlers with zero roster entries"

patterns-established:
  - "Static route handlers with force-static for build-time data generation"
  - "Client component fetches pre-built JSON on mount for zero-runtime-DB patterns"

requirements-completed: [INFRA-03]

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 1 Plan 3: Search Index Summary

**Build-time search index from Azure SQL with Fuse.js fuzzy autocomplete in SearchBar -- 619 bowlers searchable client-side with keyboard navigation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T23:13:33Z
- **Completed:** 2026-03-02T23:15:51Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Search index generated at build time via static route handler -- no runtime DB queries
- Fuse.js fuzzy matching with threshold 0.3 handles typos and partial names
- Full autocomplete dropdown with keyboard navigation (arrows, enter, escape) and ARIA roles
- Seasons active count displayed per result for context

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Fuse.js and create search index generator** - `ea4cf80` (feat)
2. **Task 2: Wire Fuse.js into SearchBar with autocomplete dropdown** - `489a4a7` (feat)

## Files Created/Modified
- `src/lib/search-index.ts` - SearchEntry type and generateSearchIndex() function querying Azure SQL
- `src/app/api/search-index/route.ts` - Static route handler (force-static) serving pre-built JSON
- `src/components/layout/SearchBar.tsx` - Upgraded from placeholder to full Fuse.js autocomplete
- `package.json` - Added fuse.js dependency

## Decisions Made
- Used `bowlers.slug` column directly from DB instead of generating slugs from firstName/lastName. The bowlers table already has a slug column used by getAllBowlerSlugs and getBowlerBySlug -- reusing it ensures search results link to the correct pre-rendered pages.
- Used LEFT JOIN on roster table for seasonsActive count so bowlers with no roster entries still appear in search results (with 0 seasons).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used existing slug column instead of generating from firstName/lastName**
- **Found during:** Task 1 (search index generator)
- **Issue:** Plan specified generating slugs from firstName + lastName, but the bowlers table already has a slug column. Generating would risk mismatches with pre-rendered bowler pages that use the DB slug.
- **Fix:** Query slug directly from bowlers table, matching the pattern in queries.ts
- **Files modified:** src/lib/search-index.ts
- **Verification:** Build passes, /api/search-index generates correct JSON
- **Committed in:** ea4cf80 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug prevention)
**Impact on plan:** Essential for correctness -- generated slugs could have mismatched pre-rendered routes. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Search infrastructure complete, ready for Phase 2 bowler profile expansion
- SearchBar will automatically include new bowlers added to the DB on next build
- Fuse.js threshold (0.3) may need tuning based on user feedback

---
*Phase: 01-foundation*
*Completed: 2026-03-02*
