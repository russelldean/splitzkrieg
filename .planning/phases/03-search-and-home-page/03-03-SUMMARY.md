---
phase: 03-search-and-home-page
plan: 03
subsystem: ui
tags: [next.js, server-components, directory, placeholder-pages, footer]

requires:
  - phase: 03-search-and-home-page
    provides: "getAllBowlersDirectory() query and DirectoryBowler interface from Plan 01"
provides:
  - "/bowlers alphabetical directory page with letter quick-nav"
  - "/teams, /seasons, /leaderboards league-voice placeholder pages"
  - "/resources categorized quick links page"
  - "Footer with Instagram link and Resources nav"
affects: []

tech-stack:
  added: []
  patterns:
    - "League-voice placeholder pages with personality text and navigation back to home/bowlers"
    - "Categorized resource links with placeholder URL detection and 'coming soon' indicator"

key-files:
  created:
    - src/app/bowlers/page.tsx
    - src/app/teams/page.tsx
    - src/app/seasons/page.tsx
    - src/app/leaderboards/page.tsx
    - src/app/resources/page.tsx
  modified:
    - src/components/layout/Footer.tsx

key-decisions:
  - "Bowler directory uses multi-column grid (1/2/3/4 cols responsive) with letter anchor quick-nav"
  - "Placeholder pages use league-voice personality text rather than generic 'Coming Soon' messages"
  - "Resource links with href='#' render as disabled cards with 'Link coming soon' text instead of dead links"

patterns-established:
  - "Placeholder page pattern: centered max-w-2xl layout with personality text and nav links back to home/bowlers"

requirements-completed: [SRCH-01, HOME-01, HOME-03]

duration: 6min
completed: 2026-03-03
---

# Phase 3 Plan 3: Secondary Routes and Footer Summary

**Bowler directory with alphabetical grouping and letter quick-nav, four league-voice placeholder pages, resources quick links, and footer Instagram link**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-03T13:59:40Z
- **Completed:** 2026-03-03T14:02:34Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 6

## Accomplishments
- Created /bowlers directory page grouping all bowlers alphabetically with anchor-based letter quick-nav, active indicators, and season counts
- Created /teams, /seasons, /leaderboards with league-voice placeholder text that matches Splitzkrieg personality
- Created /resources with categorized quick links (League Documents, Forms, Bowling Alley, Social) with placeholder URL detection
- Updated Footer with Resources secondary nav link and Instagram SVG icon

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bowler directory page and placeholder pages** - `9b79959` (feat)
2. **Task 2: Create resources page and update Footer with Instagram link** - `e0aa0f1` (feat)
3. **Task 3: Verify all new pages and navigation** - checkpoint approved

## Files Created/Modified
- `src/app/bowlers/page.tsx` - Alphabetical bowler directory with letter quick-nav, active dots, season counts
- `src/app/teams/page.tsx` - League-voice placeholder ("Yes, we have teams...")
- `src/app/seasons/page.tsx` - League-voice placeholder ("35+ seasons...")
- `src/app/leaderboards/page.tsx` - League-voice placeholder ("guaranteed to start arguments")
- `src/app/resources/page.tsx` - Categorized quick links with placeholder URL handling
- `src/components/layout/Footer.tsx` - Added Resources nav link and Instagram icon

## Decisions Made
- Used multi-column responsive grid for bowler directory (scales from 1 to 4 columns) for space efficiency
- Placeholder pages include nav links back to home and bowlers as alternative navigation
- Resource cards with `href="#"` render as disabled/muted cards with "Link coming soon" text rather than dead links
- Instagram icon placed next to "Village Lanes" branding text, not as a featured element

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing CSS issue (`@utility cannot be nested` in globals.css) prevents dev server from rendering pages. TypeScript compilation passes clean. This is unrelated to plan changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All secondary routes now have destinations for home page and navigation links
- Placeholder pages ready to be replaced with real content in future phases
- Resource URLs need to be filled in when actual links are provided

---
*Phase: 03-search-and-home-page*
*Completed: 2026-03-03*
