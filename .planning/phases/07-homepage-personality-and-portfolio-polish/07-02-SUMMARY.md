---
phase: 07-homepage-personality-and-portfolio-polish
plan: 02
subsystem: ui
tags: [parallax, hero-headers, directory-pages, village-lanes-photos]

requires:
  - phase: 07-homepage-personality-and-portfolio-polish
    plan: 01
    provides: "Shared SVG icons, homepage personality baseline"
provides:
  - "Parallax photo hero headers on bowlers, teams, and seasons directory pages"
  - "SeasonDirectory hideHeading prop for conditional heading suppression"
affects: [07-03, 07-04, 07-05]

tech-stack:
  added: []
  patterns:
    - "Directory pages use ParallaxBg hero with gradient overlay and contextual subtitle"
    - "SeasonDirectory supports hideHeading prop for pages that provide their own hero heading"

key-files:
  created: []
  modified:
    - src/app/bowlers/page.tsx
    - src/app/teams/page.tsx
    - src/app/seasons/page.tsx
    - src/components/season/SeasonDirectory.tsx

key-decisions:
  - "User rejected homepage pill nav and tagline rewrite from Plan 01 -- homepage reverted to original layout"
  - "User approved parallax heroes on all three directory pages"
  - "Photo assignments: panorama for bowlers, group photo for teams, bowl sign for seasons"

patterns-established:
  - "Directory hero pattern: ParallaxBg + gradient overlay + h1 + contextual count subtitle"

requirements-completed: [DIR-HEROES, AI-AUDIT]

duration: 5min
completed: 2026-03-12
---

# Phase 07 Plan 02: Directory Heroes and Visual Checkpoint Summary

**Parallax photo hero headers added to bowlers, teams, and seasons directory pages using Village Lanes photos; homepage changes from Plan 01 reverted per user feedback**

## Performance

- **Duration:** 5 min (Task 1 execution) + checkpoint review cycle
- **Started:** 2026-03-12T03:16:00Z
- **Completed:** 2026-03-12T04:10:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added parallax photo hero headers to all three directory pages (bowlers, teams, seasons) with Village Lanes photos
- Each hero shows page title and contextual count subtitle (e.g., "140 bowlers across 19 years of Splitzkrieg history")
- Added hideHeading prop to SeasonDirectory to avoid duplicate h1 when hero provides the heading
- User visual review completed: directory heroes approved, homepage changes rejected and reverted

## Task Commits

Each task was committed atomically:

1. **Task 1: Add parallax hero headers to all three directory pages** - `c345847` (feat)
2. **Task 2: Visual review checkpoint** - No commit (checkpoint resolved: homepage reverted in `f40dd63`, directory heroes approved)

**Homepage revert:** `f40dd63` (revert) - Restored original homepage layout after user rejected pill nav and tagline changes from Plan 01

## Files Created/Modified
- `src/app/bowlers/page.tsx` - Parallax hero with panorama photo, bowler count subtitle
- `src/app/teams/page.tsx` - Parallax hero with group photo, franchise count subtitle
- `src/app/seasons/page.tsx` - Parallax hero with bowl sign photo, season count subtitle
- `src/components/season/SeasonDirectory.tsx` - Added hideHeading prop to suppress heading when page provides its own hero

## Decisions Made
- User rejected homepage personality changes (pill-style quick links, new tagline) -- "this looks like a site Claude made" feedback persisted with the new design
- Homepage reverted to its original layout (commit f40dd63) -- the original card grid + tagline felt more human-authored
- Directory parallax heroes approved -- they add visual warmth and community feeling without triggering AI-pattern recognition
- Photo assignments worked well: panorama (bowlers), group photo (teams), bowl sign (seasons)

## Deviations from Plan

### User Feedback Deviation

**Homepage revert (not in original plan scope)**
- **Found during:** Task 2 (visual checkpoint)
- **Issue:** User rejected Plan 01's homepage changes (pill nav, tagline rewrite) as still looking AI-generated
- **Resolution:** Homepage reverted to original layout in separate commit f40dd63
- **Impact:** Plan 01's homepage changes (Tasks 2-3) effectively rolled back. Shared icon extraction (Task 1) remains useful.

---

**Total deviations:** 1 user-directed revert
**Impact on plan:** Directory heroes shipped as planned. Homepage personality work will need a different approach in future work.

## Issues Encountered
None during directory hero implementation. The checkpoint feedback cycle was the primary interaction.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Directory pages now have visual anchoring with parallax heroes
- Homepage personality remains an open item -- user wants to upload more photos for future visual work
- Remaining Phase 7 plans can proceed with portfolio polish focus

## Self-Check: PASSED

- All 4 modified files verified present on disk
- Commit c345847 (directory heroes) verified in git log
- Commit f40dd63 (homepage revert) verified in git log

---
*Phase: 07-homepage-personality-and-portfolio-polish*
*Completed: 2026-03-12*
