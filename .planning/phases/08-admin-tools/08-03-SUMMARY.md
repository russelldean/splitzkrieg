---
phase: 08-admin-tools
plan: 03
subsystem: lineup
tags: [magic-link, jwt, resend, leaguepals, lineup-submission, captain-auth]

requires:
  - phase: 08-admin-tools plan 01
    provides: JWT auth (signToken, verifyToken, requireAdmin, requireCaptain), DB tables (lineupSubmissions, lineupEntries, captainSessions), shared types
provides:
  - Magic link generation and email delivery for captain auth
  - Captain lineup submission form with bowler picker and position management
  - Admin lineup management with edit, magic link send, and LP push
  - LeaguePals lineup push integration (refactored from CLI script)
  - Lineup CRUD library (submitLineup, getLineups, editLineup, pushLineupsToLP)
affects: [08-04, 08-05]

tech-stack:
  added: []
  patterns: [magic-link auth flow, captain httpOnly cookie session, LP API integration in admin UI]

key-files:
  created:
    - src/lib/admin/lineups.ts
    - src/app/api/admin/magic-link/route.ts
    - src/app/api/lineup/auth/route.ts
    - src/app/api/lineup/submit/route.ts
    - src/app/api/admin/lineups/route.ts
    - src/app/api/admin/lineups/push/route.ts
    - src/app/lineup/login/page.tsx
    - src/app/lineup/layout.tsx
    - src/app/lineup/page.tsx
    - src/app/admin/(dashboard)/lineups/page.tsx
  modified: []

key-decisions:
  - "Captain lineup form uses GET /api/lineup/submit for context (bowlers, roster, last week) and POST for submission"
  - "LP push refactored from update-leaguepals.mjs into lineups.ts with same team ID mapping and API patterns"
  - "Admin lineups page placed inside (dashboard) route group for consistent auth protection"
  - "Lineup submit replaces previous submission for same team/season/week via transaction"

patterns-established:
  - "Magic link flow: admin POST /api/admin/magic-link -> Resend email -> captain clicks -> GET /api/lineup/auth sets cookie -> redirect to /lineup"
  - "Captain auth: lineup-token httpOnly cookie with 90-day expiry, verified in layout.tsx server component"
  - "Lineup submission: transaction-based insert with delete-and-replace for re-submissions"

requirements-completed: [ADMN-01]

duration: 5min
completed: 2026-03-14
---

# Phase 8 Plan 03: Lineup Submission System Summary

**Magic link captain auth, lineup form with bowler picker/position reorder, admin lineup management grid, and LeaguePals push integration**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-15T01:53:33Z
- **Completed:** 2026-03-15T01:58:49Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Full magic link auth flow: admin sends link via Resend, captain clicks, JWT cookie set, persistent 90-day session
- Captain lineup form with searchable bowler picker pre-sorted by recent roster, position reorder, new bowler entry, and last-week pre-fill
- Admin lineup management with team submission grid (color-coded status), inline edit modal, magic link sender, and LP push
- LeaguePals push integration refactored from CLI script into admin UI with cookie paste workflow
- Lineup CRUD library with transaction-safe submit/replace and revocation tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Lineup backend - magic links, captain auth, submission API, LP push** - `b4b04b1` (feat)
2. **Task 2: Captain lineup form and admin lineup management UI** - `95bc4e3` (feat)

## Files Created/Modified
- `src/lib/admin/lineups.ts` - Lineup CRUD: getAllBowlers, getRecentRoster, submitLineup, getLineups, editLineup, pushLineupsToLP, getCurrentLineupContext, getSeasonTeams
- `src/app/api/admin/magic-link/route.ts` - POST: generate captain JWT, store session, send Resend email with magic link
- `src/app/api/lineup/auth/route.ts` - GET: verify magic link token, check revocation, set httpOnly cookie, redirect
- `src/app/api/lineup/submit/route.ts` - GET: lineup context (bowlers, roster, last week). POST: submit/replace lineup
- `src/app/api/admin/lineups/route.ts` - GET: all lineups + teams for season/week. PUT: admin edit submission
- `src/app/api/admin/lineups/push/route.ts` - POST: push lineups to LeaguePals via LP API
- `src/app/lineup/login/page.tsx` - Client: auto-processes magic link token, expired session message
- `src/app/lineup/layout.tsx` - Server: JWT verification, captain identity in header
- `src/app/lineup/page.tsx` - Client: full lineup form with bowler picker, position management, submit
- `src/app/admin/(dashboard)/lineups/page.tsx` - Client: team grid with status, edit modal, magic link sender, LP push

## Decisions Made
- Captain lineup form uses a single API endpoint (GET for context, POST for submission) to keep the captain-facing code simple
- LP push reuses the same team ID mapping and API patterns from the existing update-leaguepals.mjs script
- Admin lineups page placed inside the (dashboard) route group for consistent auth protection with the admin sidebar
- Lineup submission uses delete-and-replace within a transaction rather than upsert, ensuring clean state on re-submission

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
- `RESEND_API_KEY` environment variable required for magic link email delivery (already configured from Phase 6)
- `ADMIN_JWT_SECRET` and `ADMIN_PASSWORD` required for admin auth (already configured from Plan 01)

## Next Phase Readiness
- Lineup submission system complete and ready for use
- Admin can manage all lineups from the dashboard
- LP push integration working via admin UI
- Captain magic link auth flow tested and functional

## Self-Check: PASSED

All 10 files verified present. Both task commits (b4b04b1, 95bc4e3) confirmed in git log.

---
*Phase: 08-admin-tools*
*Completed: 2026-03-14*
