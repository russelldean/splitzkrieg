---
phase: 08-admin-tools
plan: 02
subsystem: api, ui
tags: [leaguepals, score-pipeline, admin, mssql, fuzzy-matching, validation]

requires:
  - phase: 08-admin-tools/01
    provides: JWT auth, admin types, AdminShell layout, route group
provides:
  - Score pipeline backend (LP pull, insert, match results, patches, cache bump)
  - Score validation warnings for unusual scores
  - Score review UI with inline editing and confirm flow
  - Three API routes (pull, confirm, manual) for score management
affects: [08-admin-tools/03, 08-admin-tools/04, 08-admin-tools/05]

tech-stack:
  added: []
  patterns: [sequential-pipeline-for-azure-sql, bowler-fuzzy-matching, staged-match-review-pattern]

key-files:
  created:
    - src/lib/admin/lp-api.ts
    - src/lib/admin/scores.ts
    - src/lib/admin/validation.ts
    - src/app/api/admin/scores/pull/route.ts
    - src/app/api/admin/scores/confirm/route.ts
    - src/app/api/admin/scores/manual/route.ts
    - src/app/admin/(dashboard)/scores/page.tsx
  modified:
    - src/lib/admin/types.ts

key-decisions:
  - "PersonalBest interface moved to shared types.ts to avoid client importing server-only scores.ts"
  - "Scores page placed under (dashboard) route group for AdminShell layout and auth protection"
  - "Weekly patches only run during confirm (season-level patches like playoff/champion unaffected)"
  - "Match results scoped to week during confirm to avoid regenerating entire season"
  - "Bowler matching uses Levenshtein distance inline instead of Fuse.js for server-side matching"

patterns-established:
  - "Sequential pipeline pattern: delete -> insert -> match results -> patches -> cache bump"
  - "Staged match review: pull data, display for editing, confirm to persist"

requirements-completed: [ADMN-01, ADMN-02]

duration: 18min
completed: 2026-03-15
---

# Phase 08 Plan 02: Score Pipeline Summary

**Score entry pipeline with LP pull, inline review/editing, validation warnings, and sequential confirm flow (insert, match results, patches, cache bump)**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-15T01:53:16Z
- **Completed:** 2026-03-15T02:11:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Full LP API client refactored from import-week-scores.mjs with bowler fuzzy matching and team ID mapping
- Score validation engine (high/low scores, deviation from average, duplicate bowlers)
- Sequential confirm pipeline: delete old scores, insert new, run match results, run patches, bump cache
- Score review UI with editable match cards, penalty toggles, unmatched bowler resolution, turkey counts
- Personal best detection and patch award summary on confirmation

## Task Commits

Each task was committed atomically:

1. **Task 1: Score pipeline backend** - `9f472db` (feat)
2. **Task 2: Score review UI** - `214fd30` (feat)

## Files Created/Modified

- `src/lib/admin/lp-api.ts` - LeaguePals API client with bowler fuzzy matching
- `src/lib/admin/scores.ts` - Pipeline logic (insert, match results, patches, cache)
- `src/lib/admin/validation.ts` - Score validation rules returning non-blocking warnings
- `src/app/api/admin/scores/pull/route.ts` - POST endpoint for LP score pulling
- `src/app/api/admin/scores/confirm/route.ts` - POST endpoint for full pipeline execution
- `src/app/api/admin/scores/manual/route.ts` - POST endpoint for schedule-based empty scaffolds
- `src/app/admin/(dashboard)/scores/page.tsx` - Score review UI with inline editing
- `src/lib/admin/types.ts` - Added PersonalBest interface

## Decisions Made

- Moved PersonalBest interface from scores.ts to types.ts so client components can import without pulling in mssql
- Used Levenshtein distance algorithm inline instead of Fuse.js for server-side bowler matching (same approach as original script)
- Only weekly patches (perfectGame, botw, highGame, highSeries, aboveAvg, threeOfAKind) run during confirm; season-level patches are unaffected by weekly score entry
- Match results are scoped to the specific week during confirm, not regenerated for the entire season
- Scores page lives under (dashboard) route group so it inherits AdminShell layout and JWT auth protection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed PersonalBest import for client component**
- **Found during:** Task 2 (Score review UI)
- **Issue:** Client component importing PersonalBest from scores.ts would pull in mssql (server-only)
- **Fix:** Moved PersonalBest interface to shared types.ts, re-exported from scores.ts for backward compat
- **Files modified:** src/lib/admin/types.ts, src/lib/admin/scores.ts, src/app/admin/(dashboard)/scores/page.tsx
- **Verification:** TypeScript passes, no server module in client bundle
- **Committed in:** 214fd30 (Task 2 commit)

**2. [Rule 3 - Blocking] Placed scores page under (dashboard) route group**
- **Found during:** Task 2 (Score review UI)
- **Issue:** Plan specified src/app/admin/scores/page.tsx but that path bypasses the (dashboard) layout with auth and AdminShell
- **Fix:** Created page at src/app/admin/(dashboard)/scores/page.tsx instead
- **Files modified:** src/app/admin/(dashboard)/scores/page.tsx
- **Verification:** Page inherits auth protection and sidebar navigation
- **Committed in:** 214fd30 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for correct routing and build. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Score pipeline fully functional for LP pull and manual entry workflows
- Blog editor (Plan 03), lineup management (Plan 04), and scoresheet PDF (Plan 05) can proceed independently
- Cache bump integrated with data-versions.json system

---
*Phase: 08-admin-tools*
*Completed: 2026-03-15*
