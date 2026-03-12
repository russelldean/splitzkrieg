---
phase: 07-homepage-personality-and-portfolio-polish
plan: 01
subsystem: ui
tags: [svg-icons, homepage, tailwind, flex-layout]

requires:
  - phase: 05-team-depth-and-matchup-history
    provides: "Nav structure with 5 sections + blog"
provides:
  - "Shared SVG icon exports for nav and homepage"
  - "Redesigned homepage with pill-style quick links"
  - "League-specific tagline replacing generic stats language"
affects: [07-02, 07-03]

tech-stack:
  added: []
  patterns:
    - "Shared icon exports as JSX elements in components/ui/icons.tsx"

key-files:
  created:
    - src/components/ui/icons.tsx
  modified:
    - src/components/layout/Header.tsx
    - src/app/page.tsx

key-decisions:
  - "Tagline: 'Since 2007. 100+ bowlers. One very specific website.' -- dry/understated per Baseball Reference with a wink tone"
  - "Pill layout uses flex-wrap gap-2 instead of grid -- breaks uniform pattern"

patterns-established:
  - "SVG icons: export as JSX elements from icons.tsx, import by name"

requirements-completed: [HOME-PERSONALITY]

duration: 2min
completed: 2026-03-12
---

# Phase 07 Plan 01: Homepage Personality Summary

**Shared SVG icon file extracted from Header, homepage quick links redesigned as flex-wrap pills with SVG icons and no descriptions, generic tagline replaced with league-specific voice**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T03:13:57Z
- **Completed:** 2026-03-12T03:15:24Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extracted 6 SVG icons from Header.tsx into shared icons.tsx for reuse across components
- Replaced uniform 2x3/6-col card grid with flex-wrap pill/chip row (icon + label only, no descriptions)
- Swapped emoji icons for custom SVG icons on homepage
- Replaced generic "Stats, records, and X years of league history" with "Since 2007. 100+ bowlers. One very specific website."
- Removed template-pattern gradient divider between hero and content grid

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract SVG icons to shared file and update Header imports** - `bc29b20` (refactor)
2. **Task 2: Redesign homepage card grid and tagline** - `7b92bb7` (feat)

## Files Created/Modified
- `src/components/ui/icons.tsx` - Shared SVG icon exports (bowlersIcon, teamsIcon, seasonsIcon, leagueNightsIcon, blogIcon, statsIcon)
- `src/components/layout/Header.tsx` - Imports icons from shared file instead of defining inline
- `src/app/page.tsx` - Pill-style quick links, new tagline, gradient divider removed

## Decisions Made
- Chose "Since 2007. 100+ bowlers. One very specific website." tagline -- driest of the three options, fits "Baseball Reference with a wink" tone without trying too hard
- Pill layout uses flex-wrap with gap-2 for organic flow instead of rigid grid columns

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Shared icons ready for use in any future component
- Homepage personality established; remaining plans can focus on other portfolio polish areas

---
*Phase: 07-homepage-personality-and-portfolio-polish*
*Completed: 2026-03-12*
