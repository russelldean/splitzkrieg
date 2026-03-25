---
phase: 12-navigation-and-discoverability-overhaul
plan: 01
subsystem: ui
tags: [posthog, tracking, intersection-observer, bowler-profile, analytics]

requires: []
provides:
  - ExitRamp tracked link component for PostHog exit_ramp_clicked events
  - TrackVisibility wrapper component for section_viewed events
  - useTrackVisibility hook for ref-based visibility tracking
  - Reordered bowler profile with personality content above stat tables
affects: [12-02, 12-03]

tech-stack:
  added: []
  patterns: [fire-once IntersectionObserver tracking, client component wrapping server content]

key-files:
  created:
    - src/components/tracking/ExitRamp.tsx
    - src/components/tracking/TrackVisibility.tsx
    - src/components/tracking/useTrackVisibility.ts
  modified:
    - src/app/bowler/[slug]/page.tsx

key-decisions:
  - "ExitRamp uses default className with override via prop for flexibility"
  - "TrackVisibility wraps server-rendered content as client boundary with no visual treatment"

patterns-established:
  - "Fire-once tracking: IntersectionObserver disconnects after first section_viewed capture"
  - "Tracking wrapper pattern: client component div around server-rendered children"

requirements-completed: [D-07, D-11, D-12, D-13]

duration: 4min
completed: 2026-03-25
---

# Phase 12 Plan 01: Tracking Components and Bowler Profile Reorder Summary

**PostHog tracking library (ExitRamp, TrackVisibility, useTrackVisibility) plus bowler profile reorder surfacing YouAreAStar and GameProfile above chart/stats**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T00:45:28Z
- **Completed:** 2026-03-25T00:49:28Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created three reusable tracking components for PostHog analytics (ExitRamp, TrackVisibility, useTrackVisibility)
- Reordered bowler profile to surface personality content (YouAreAStar, GameProfile) above statistical tables
- Wrapped 5 key bowler profile sections with visibility tracking for section_viewed analytics

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tracking components** - `e19463f` (feat)
2. **Task 2: Reorder bowler profile and add visibility tracking** - `465c546` (feat)

## Files Created/Modified
- `src/components/tracking/ExitRamp.tsx` - Tracked link component with PostHog exit_ramp_clicked capture and 44px touch target
- `src/components/tracking/TrackVisibility.tsx` - IntersectionObserver wrapper firing section_viewed at 30% visibility, fire-once
- `src/components/tracking/useTrackVisibility.ts` - Ref-based hook version of TrackVisibility for direct integration
- `src/app/bowler/[slug]/page.tsx` - Reordered sections (YouAreAStar/GameProfile moved up), added TrackVisibility wrapping on 5 sections

## Decisions Made
- ExitRamp accepts optional className prop to override default styling for future use in different contexts
- TrackVisibility renders an invisible div wrapper with no visual treatment to avoid layout impact

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tracking components ready for Plans 02 and 03 to use ExitRamp in blog recaps and hub pages
- Bowler profile reorder deployed, ready for D-14 impact measurement via section_viewed events

## Self-Check: PASSED

- All 4 files exist on disk
- Commits e19463f and 465c546 verified in git log

---
*Phase: 12-navigation-and-discoverability-overhaul*
*Completed: 2026-03-25*
