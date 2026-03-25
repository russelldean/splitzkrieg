---
phase: 12-navigation-and-discoverability-overhaul
plan: 02
subsystem: ui
tags: [react, next.js, posthog, blog, exit-ramps, discovery]

requires:
  - phase: 12-navigation-and-discoverability-overhaul
    plan: 01
    provides: ExitRamp and TrackVisibility tracking components

provides:
  - Condensed WeekRecap with inline ExitRamp exit ramps for results, standings, leaderboards, milestones
  - RecapCallout component for new-feature announcement banners
  - DiscoverySection component with stable links and rotating highlights
  - CompactStandingsPreview showing top 4 teams
  - CompactLeaderboardPreview showing top 3 men's/women's scratch avg leaders

affects: [blog-system, weekly-recaps, navigation]

tech-stack:
  added: []
  patterns:
    - "Condensed-headline recap: show preview data + ExitRamp to full page"
    - "Rotating highlights from content/updates.ts feat entries"

key-files:
  created:
    - src/components/blog/CompactStandingsPreview.tsx
    - src/components/blog/CompactLeaderboardPreview.tsx
    - src/components/blog/RecapCallout.tsx
    - src/components/blog/DiscoverySection.tsx
  modified:
    - src/components/blog/WeekRecap.tsx

key-decisions:
  - "Used actual StandingsRow type from queries instead of plan-specified interface to match real data shape"
  - "Sweep detection uses total game + bonus pts (4-0) from WeeklyMatchupResult"
  - "CompactStandingsPreview shows W/XP instead of W-L-T since StandingsRow lacks losses/ties fields"

patterns-established:
  - "Compact preview pattern: server component showing top N entries + 'and N more' footer"
  - "Condensed recap section: heading + preview + ExitRamp below"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-06, D-19, D-20]

duration: 4min
completed: 2026-03-24
---

# Phase 12 Plan 02: Blog Recap Condensed Hybrid Summary

**WeekRecap transformed from full-data hub to condensed-headline format with ExitRamp exit ramps, RecapCallout banner, and DiscoverySection with stable links and rotating highlights**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T00:48:18Z
- **Completed:** 2026-03-25T00:52:33Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- WeekRecap sections 2-5 condensed from full components to headline previews with ExitRamp links to destination pages
- RecapCallout banner at top of recap for new-feature announcements (conditional, only renders when callout prop provided)
- DiscoverySection replaces Keep Exploring with 2 stable links + 2 rotating feat highlights from updates feed
- CompactStandingsPreview shows top 4 teams with W/XP and points
- CompactLeaderboardPreview shows top 3 men's and women's scratch avg leaders
- All condensed sections wrapped in TrackVisibility for PostHog section_viewed analytics

## Task Commits

Each task was committed atomically:

1. **Task 1: Create compact preview components and RecapCallout** - `786926d` (feat)
2. **Task 2: Refactor WeekRecap to condensed-headline format with ExitRamps** - `98fcf62` (feat)

## Files Created/Modified
- `src/components/blog/CompactStandingsPreview.tsx` - Top 4 teams condensed standings preview using StandingsRow type
- `src/components/blog/CompactLeaderboardPreview.tsx` - Top 3 men's/women's scratch avg leaders preview
- `src/components/blog/RecapCallout.tsx` - New-feature announcement banner with NEW badge, renders null when no callout
- `src/components/blog/DiscoverySection.tsx` - Stable links (Find Your Profile, All-Time Records) + rotating feat highlights from updates feed
- `src/components/blog/WeekRecap.tsx` - Condensed-headline format: removed full Standings/WeekMatchSummary/LeaderboardSnapshot, added ExitRamp links, RecapCallout, DiscoverySection, TrackVisibility wrappers

## Decisions Made
- Used actual `StandingsRow` type from `@/lib/queries` instead of plan-specified interface (plan had `totalPoints`, real type has `totalPts`; plan had `losses`/`ties`, real type has `wins`/`xp`)
- CompactStandingsPreview displays "W / XP" format instead of "W-L-T" since the StandingsRow type doesn't carry losses or ties
- Sweep detection computed from `team1GamePts + team1BonusPts === 4` to identify 4-0 results

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CompactStandingsPreview interface to match actual StandingsRow type**
- **Found during:** Task 2 (WeekRecap refactor)
- **Issue:** Plan specified `totalPoints`, `losses`, `ties` fields but actual StandingsRow has `totalPts`, `wins`, `xp` (no losses/ties)
- **Fix:** Changed CompactStandingsPreview to import StandingsRow from `@/lib/queries` and display W/XP format
- **Files modified:** src/components/blog/CompactStandingsPreview.tsx
- **Verification:** Type-safe import, correct field references
- **Committed in:** 98fcf62 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary to match real data types. No scope creep.

## Issues Encountered
- Pre-existing test failures in Phase 11 game tests (SlingshotInput.test.ts) unrelated to this plan. Not addressed per scope boundary rules.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components are fully wired to real data sources.

## Next Phase Readiness
- WeekRecap condensed format complete, ready for Plan 03 (destination page NextStopNudge components)
- ExitRamp links on recap point to existing destination pages
- DiscoverySection wired to live updates feed data

## Self-Check: PASSED

- All 5 created/modified files verified on disk
- Both task commits (786926d, 98fcf62) verified in git log

---
*Phase: 12-navigation-and-discoverability-overhaul*
*Completed: 2026-03-24*
