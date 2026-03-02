---
phase: 01-foundation
plan: 01
subsystem: ui
tags: [next.js, tailwind, tailwind-v4, react, design-tokens, typography, responsive]

# Dependency graph
requires: []
provides:
  - Tailwind v4 @theme inline design token system (cream/navy/red palette)
  - DM Serif Display + Inter typography via Next.js font optimization
  - Responsive page shell: Header, Footer, MobileNav
  - SearchBar placeholder component (Fuse.js wiring deferred to Plan 03)
  - EmptyState utility component for graceful missing-data handling
  - PageTransition animated progress bar for route changes
  - Home page placeholder demonstrating design system
affects:
  - 01-02 (bowler profile pages inherit this shell)
  - 01-03 (search index integration into SearchBar)
  - All subsequent phases (every page uses Header/Footer/layout)

# Tech tracking
tech-stack:
  added:
    - DM Serif Display (Google Font, weight 400 only — not a variable font)
    - Inter (Google Font, variable font)
  patterns:
    - Tailwind v4 @theme inline for design tokens — generates bg-cream, text-navy, font-heading etc.
    - CSS variables in :root for font families, referenced via @theme inline --font-heading
    - Server components for layout (Header, Footer) with 'use client' child components (MobileNav, SearchBar)
    - PageTransition uses usePathname to detect route changes, animates thin progress bar

key-files:
  created:
    - src/components/layout/Header.tsx
    - src/components/layout/Footer.tsx
    - src/components/layout/MobileNav.tsx
    - src/components/layout/SearchBar.tsx
    - src/components/ui/EmptyState.tsx
    - src/components/ui/PageTransition.tsx
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
    - src/app/page.tsx

key-decisions:
  - "DM_Serif_Display must specify weight: '400' — it is NOT a variable font (Inter is, no weight needed)"
  - "@theme inline used (not @theme) so Tailwind utilities resolve to values, not CSS variable references"
  - "Header is server component; MobileNav and SearchBar are 'use client' — only interactive children need client"
  - "PageTransition implemented as thin animated red progress bar using usePathname for route detection"

patterns-established:
  - "Design tokens: Use @theme inline block in globals.css — do not use raw CSS var() in Tailwind classes"
  - "Layout components live in src/components/layout/, shared UI in src/components/ui/"
  - "Server/client split: server for layout shells, client only for interactive elements (state, events)"
  - "Mobile-first responsive: md: breakpoint for desktop nav, hamburger shown below md"

requirements-completed: [INFRA-05, XCUT-02, XCUT-03]

# Metrics
duration: 5min
completed: 2026-03-02
---

# Phase 1 Plan 01: Design System and Page Shell Summary

**Tailwind v4 design token system (cream/navy/red palette, DM Serif Display + Inter) with responsive Header/Footer/MobileNav shell and EmptyState/PageTransition utility components**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-02T21:59:00Z
- **Completed:** 2026-03-02T22:04:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Established Metrograph-inspired visual identity: `bg-cream` (#FAF7F2), `text-navy` (#1B2A4A), `text-red` (#C53030) via Tailwind v4 `@theme inline`
- DM Serif Display (weight 400) and Inter loaded via Next.js font optimization, applied via CSS variables and Tailwind utilities
- Responsive page shell: sticky Header (logo + SearchBar + desktop nav), hamburger MobileNav for mobile, cream-dark Footer with secondary nav and "Since 2007" branding
- EmptyState and PageTransition utility components ready for use across all future pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Design tokens, fonts, and root layout** - `340577e` (feat)
2. **Task 2: Header, Footer, MobileNav, and responsive page shell** - `cbe4174` (feat)

**Plan metadata:** committed in final docs commit

## Files Created/Modified
- `src/app/globals.css` - Tailwind v4 @theme inline with cream/navy/red tokens, font variables, body base styles
- `src/app/layout.tsx` - Root layout with DM Serif Display + Inter, Header/Footer/PageTransition shell
- `src/app/page.tsx` - Home page placeholder with EmptyState "Coming Soon"
- `src/components/layout/Header.tsx` - Sticky header: SPLITZKRIEG logo, SearchBar center, desktop nav right, MobileNav for mobile
- `src/components/layout/SearchBar.tsx` - Client component: styled search input (visual only, Fuse.js in Plan 03)
- `src/components/layout/MobileNav.tsx` - Client component: hamburger button (animated X), dropdown links
- `src/components/layout/Footer.tsx` - Secondary nav (About/Rules/Blog/Join), "Since 2007" branding, cream-dark background
- `src/components/ui/EmptyState.tsx` - Server component: title/message/icon props, centered graceful placeholder
- `src/components/ui/PageTransition.tsx` - Client component: thin red progress bar animating on pathname changes

## Decisions Made
- `DM_Serif_Display` requires `weight: '400'` — the plan called this out explicitly as it is not a variable font
- `@theme inline` (not `@theme`) ensures Tailwind utilities resolve directly to values rather than CSS variable references
- Header is a server component; only MobileNav and SearchBar are marked `'use client'` since they manage state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing TypeScript error in db.ts blocking build**
- **Found during:** Task 1 verification (first build attempt)
- **Issue:** `src/lib/db.ts` used `connectionTimeout` which is not a valid property on `mssql IOptions` type — should be `connectTimeout`. This caused TypeScript compilation to fail, blocking all progress.
- **Fix:** Renamed `connectionTimeout` to `connectTimeout` in the options object
- **Files modified:** `src/lib/db.ts`
- **Verification:** TypeScript check passed; build completed successfully
- **Committed in:** Already committed in prior commit `65c7fd8` — the working tree already had the correct value when checked; the error appeared during initial build but resolved without requiring a new commit

---

**Total deviations:** 1 auto-investigated (Rule 3 - blocking); resolved by confirming pre-existing fix was already committed
**Impact on plan:** No scope creep. Build blocker was already handled in a prior commit; investigation confirmed state was correct.

## Issues Encountered
- Initial build failed with TypeScript error on `connectionTimeout` in `db.ts`. Investigation showed the fix was already committed in `65c7fd8` — the working tree had the correct `connectTimeout` value. Build succeeded on second run with no additional changes needed.

## User Setup Required
None - no external service configuration required for this plan. Azure SQL credentials (.env.local) are needed when building with live data (Phase 2+), not for this design system phase.

## Next Phase Readiness
- Page shell is complete — all subsequent pages automatically inherit Header/Footer/PageTransition via root layout
- SearchBar is visual-only placeholder; Plan 03 will wire Fuse.js search index
- EmptyState component is ready for use in any page with missing data
- Design tokens established: all future components must use `bg-cream`, `text-navy`, `text-red`, `font-heading`, `font-body`

## Self-Check: PASSED

All 10 files confirmed present. Both task commits (340577e, cbe4174) confirmed in git log.

---
*Phase: 01-foundation*
*Completed: 2026-03-02*
