---
phase: 02-bowler-profiles
plan: 03
subsystem: ui
tags: [recharts, react-19, client-components, accordion, line-chart, opengraph]

# Dependency graph
requires:
  - phase: 02-bowler-profiles
    plan: 01
    provides: "getBowlerSeasonStats, getBowlerGameLog, GameLogWeek interface, scoreColorClass"
  - phase: 02-bowler-profiles
    plan: 02
    provides: "page.tsx with Promise.all fetching, commented-out chart and game log placeholders"
provides:
  - "AverageProgressionChart client component with Recharts 3 line chart"
  - "GameLog client component with accordion expand/collapse per season"
  - "Fully assembled bowler profile page with all five sections active"
  - "metadataBase in layout.tsx for absolute OG URL resolution"
affects: [03-team-profiles, 04-season-pages]

# Tech tracking
tech-stack:
  added: [recharts]
  patterns: [use-client-boundary-for-interactivity, recharts-reference-dot-highlight, accordion-state-with-set]

key-files:
  created:
    - src/components/bowler/AverageProgressionChart.tsx
    - src/components/bowler/GameLog.tsx
  modified:
    - src/app/bowler/[slug]/page.tsx
    - src/app/layout.tsx
    - package.json

key-decisions:
  - "Recharts 3.7.0 installed -- confirmed React 19 compatible, no ResizeObserver issues"
  - "metadataBase uses NEXT_PUBLIC_SITE_URL env var with fallback to splitzkrieg.org"
  - "GameLog uses bg-navy/[0.02] arbitrary opacity syntax instead of bg-navy/2 for Tailwind v4 compatibility"

patterns-established:
  - "ReferenceDot for highlighting specific data points in Recharts 3 charts"
  - "Accordion state pattern: Set<number> for open section IDs, toggleAll/toggleSeason handlers"
  - "Client components ('use client') only for interactive UI -- server components handle data fetching"

requirements-completed: [BWLR-04, BWLR-05, BWLR-11]

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 2 Plan 3: Chart and Game Log Summary

**Recharts 3 average progression chart with career-high ReferenceDot, accordion game log with per-season expand/collapse, and full five-section bowler profile assembly**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T00:18:27Z
- **Completed:** 2026-03-03T00:21:29Z
- **Tasks:** 2 (of 3 -- Task 3 is human-verify checkpoint)
- **Files modified:** 5

## Accomplishments
- AverageProgressionChart with navy line, red ReferenceDot at career-high season, hidden when fewer than 3 seasons
- GameLog accordion with seasons grouped from flat query data, most recent season open by default, Expand All / Collapse All toggle
- scoreColorClass applied to all individual game scores (G1, G2, G3) and series total in game log
- All five profile sections active: Hero, Personal Records, Average Chart, Season Stats Table, Game Log
- metadataBase added to layout.tsx for absolute OG URL resolution
- 625 bowler profile pages build successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Recharts + AverageProgressionChart + GameLog** - `ff80088` (feat)
2. **Task 2: Wire all five sections in page.tsx + metadataBase** - `05f4050` (feat)

## Files Created/Modified
- `src/components/bowler/AverageProgressionChart.tsx` - Client component: Recharts 3 line chart for average progression
- `src/components/bowler/GameLog.tsx` - Client component: accordion game log with expand/collapse, scoreColorClass
- `src/app/bowler/[slug]/page.tsx` - All five sections active, gameLog destructured from Promise.all
- `src/app/layout.tsx` - metadataBase and title template added to metadata export
- `package.json` - recharts 3.7.0 added as dependency

## Decisions Made
- Recharts 3.7.0 installed and confirmed React 19 compatible -- no build errors or ResizeObserver issues
- metadataBase uses NEXT_PUBLIC_SITE_URL env var with fallback to https://splitzkrieg.org
- GameLog uses arbitrary Tailwind opacity values (bg-navy/[0.02]) for subtle hover/background effects
- Tooltip formatter typed with `number | undefined` to match Recharts 3 generic types

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Recharts 3 Tooltip formatter type**
- **Found during:** Task 1 (AverageProgressionChart)
- **Issue:** Recharts 3 Tooltip formatter parameter is `number | undefined`, not `number` -- TypeScript error
- **Fix:** Updated formatter parameter type to `number | undefined` with null check
- **Files modified:** src/components/bowler/AverageProgressionChart.tsx
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** ff80088 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type adjustment for Recharts 3 generics. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 2 (Bowler Profiles) is complete -- all five sections rendering
- Recharts 3 pattern established for any future chart components
- Team and season cross-links in place (will resolve when Phase 3/4 pages are built)
- OG metadata with absolute URLs ready for social sharing

---
*Phase: 02-bowler-profiles*
*Completed: 2026-03-02*
