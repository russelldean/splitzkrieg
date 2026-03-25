---
phase: 12-navigation-and-discoverability-overhaul
plan: 03
subsystem: ui
tags: [next.js, posthog, navigation, component, tracking]

# Dependency graph
requires:
  - phase: 12-01
    provides: TrailNav and ExitRamp patterns for destination page navigation
provides:
  - NextStopNudge component with contextual forward-path navigation
  - Forward path wired across 4 destination pages (week, season, stats, milestones)
  - PostHog next_stop_clicked tracking event
affects: [12-04, 12-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [sequential-path-nudge, contextual-destination-mapping]

key-files:
  created:
    - src/components/ui/NextStopNudge.tsx
  modified:
    - src/app/week/[seasonSlug]/[weekNum]/page.tsx
    - src/app/season/[slug]/page.tsx
    - src/app/stats/[slug]/page.tsx
    - src/app/milestones/page.tsx

key-decisions:
  - "NextStopNudge uses getNextStop function with fallback paths when seasonSlug is absent"

patterns-established:
  - "NextStopNudge placed before bottom TrailNav with mt-8 spacing"
  - "Sequential path: week -> season standings -> season leaderboards -> milestones -> all-time records"

requirements-completed: [D-08, D-09, D-10, D-21, D-22]

# Metrics
duration: 2min
completed: 2026-03-25
---

# Phase 12 Plan 03: NextStopNudge Summary

**Forward-path NextStopNudge component on 4 destination pages creating linear week-to-all-time-records exploration path with PostHog tracking**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-25T00:48:12Z
- **Completed:** 2026-03-25T00:49:32Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created NextStopNudge component with contextual path map (week -> season -> stats -> milestones -> all-time)
- Wired nudge into all 4 destination pages before bottom TrailNav
- PostHog next_stop_clicked event fires with current_page, destination, and nudge_label

## Task Commits

Each task was committed atomically:

1. **Task 1: Create NextStopNudge component** - `c5ffc13` (feat)
2. **Task 2: Wire NextStopNudge into destination pages** - `da5ec4a` (feat)

## Files Created/Modified
- `src/components/ui/NextStopNudge.tsx` - Client component with sequential path map, PostHog tracking, and full-width card layout
- `src/app/week/[seasonSlug]/[weekNum]/page.tsx` - Added NextStopNudge with currentPage="week" and seasonSlug
- `src/app/season/[slug]/page.tsx` - Added NextStopNudge with currentPage="season" and slug
- `src/app/stats/[slug]/page.tsx` - Added NextStopNudge with currentPage="stats"
- `src/app/milestones/page.tsx` - Added NextStopNudge with currentPage="milestones"

## Decisions Made
- NextStopNudge uses fallback paths (/seasons, /stats) when seasonSlug is not provided, ensuring the component works for both season-specific and general contexts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Forward path complete across all destination pages
- Ready for Plan 04+ to add additional navigation layers

---
*Phase: 12-navigation-and-discoverability-overhaul*
*Completed: 2026-03-25*
