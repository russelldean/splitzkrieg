---
phase: 08-admin-tools
plan: 05
subsystem: admin
tags: [jspdf, pdf, resend, email, dashboard, admin-ui, scoresheet]

requires:
  - phase: 08-01
    provides: "JWT auth, admin layout, AdminShell, proxy"
  - phase: 08-02
    provides: "Score pipeline (pull, validate, confirm), bumpCacheAndPublish"
  - phase: 08-03
    provides: "Lineup submissions, getLineups, team roster"
provides:
  - "PDF scoresheet generation from lineup/roster data"
  - "Publish API for leagueSettings update + ISR revalidation"
  - "Email API for recap email via Resend"
  - "Admin dashboard with lineup status, pipeline indicator, quick actions"
affects: []

tech-stack:
  added: [jspdf, jspdf-autotable]
  patterns: [PDF generation from DB data, pipeline step visualization]

key-files:
  created:
    - src/lib/admin/scoresheets.ts
    - src/app/api/admin/scoresheets/route.ts
    - src/app/api/admin/scoresheets/preview/route.ts
    - src/app/api/admin/publish/route.ts
    - src/app/api/admin/email/route.ts
    - src/app/api/admin/dashboard/route.ts
    - src/app/admin/(dashboard)/scoresheets/page.tsx
  modified:
    - src/app/admin/(dashboard)/page.tsx
    - package.json

key-decisions:
  - "Scoresheet preview endpoint separate from PDF generation for fast UI feedback"
  - "Scoresheet source toggle (lineups vs last week) gives flexibility before lineups are submitted"
  - "Dashboard API aggregates DB queries server-side; client is a single fetch"
  - "Pipeline step indicator is read-only on dashboard; actions link to dedicated pages"

patterns-established:
  - "PDF generation: server-side jspdf with autoTable, returned as binary response"
  - "Dashboard data: single GET endpoint returning aggregated status object"

requirements-completed: [ADMN-01]

duration: 12min
completed: 2026-03-15
---

# Phase 08 Plan 05: Scoresheets, Publish, Email & Dashboard Summary

**PDF scoresheet generation with jspdf, publish/email API routes, and admin dashboard with lineup status and pipeline indicator**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-15T02:03:30Z
- **Completed:** 2026-03-15T02:15:30Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Scoresheet PDF generates landscape pages per matchup with bowler names, averages, handicaps, and blank score columns
- Publish API updates leagueSettings, bumps .data-versions.json, writes .published-week, triggers ISR revalidation
- Email API sends recap via Resend with navy/cream/red HTML template matching existing script
- Admin dashboard shows lineup submission progress, score pipeline step indicator, and quick action buttons

## Task Commits

Each task was committed atomically:

1. **Task 1: Scoresheet PDF generation and publish + email API routes** - `9136ba7` (feat)
2. **Task 2: Scoresheet UI and admin dashboard overview** - `a25f5f4` (feat)

## Files Created/Modified
- `src/lib/admin/scoresheets.ts` - PDF generation library with getMatchupsForWeek and generateScoresheet
- `src/app/api/admin/scoresheets/route.ts` - POST endpoint returning PDF binary
- `src/app/api/admin/scoresheets/preview/route.ts` - POST endpoint returning matchup summary
- `src/app/api/admin/publish/route.ts` - POST endpoint for publish workflow
- `src/app/api/admin/email/route.ts` - POST endpoint for recap email via Resend
- `src/app/api/admin/dashboard/route.ts` - GET endpoint for dashboard data aggregation
- `src/app/admin/(dashboard)/scoresheets/page.tsx` - Scoresheet generation UI with preview and download
- `src/app/admin/(dashboard)/page.tsx` - Dashboard with lineup status, pipeline steps, quick actions

## Decisions Made
- Scoresheet preview endpoint is separate from PDF generation so the UI can show matchup counts quickly without generating the full PDF
- Source toggle ("From Lineups" vs "From Last Week") lets admin generate scoresheets before lineups are submitted
- Dashboard aggregates all status via a single API call rather than multiple client-side fetches
- Pipeline step indicator is visual-only on dashboard; actual actions happen on their dedicated pages

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added preview API endpoint**
- **Found during:** Task 2 (Scoresheet UI)
- **Issue:** Plan specified preview section showing matchups, but no preview API endpoint was in the plan
- **Fix:** Created /api/admin/scoresheets/preview endpoint returning team names and bowler counts
- **Files modified:** src/app/api/admin/scoresheets/preview/route.ts
- **Verification:** TypeScript compiles clean
- **Committed in:** a25f5f4 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added dashboard data API endpoint**
- **Found during:** Task 2 (Dashboard overview)
- **Issue:** Plan specified dashboard fetching data on load but no API endpoint defined
- **Fix:** Created /api/admin/dashboard endpoint returning season, lineup status, pipeline step
- **Files modified:** src/app/api/admin/dashboard/route.ts
- **Verification:** TypeScript compiles clean
- **Committed in:** a25f5f4 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both API endpoints were necessary for the UI to function. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. (Resend API key and revalidation secret assumed already configured from Phase 6.)

## Next Phase Readiness
- All admin tools complete: auth, scores, lineups, blog editor, scoresheets, publish, email, dashboard
- Full weekly pipeline is operational from the admin UI

---
*Phase: 08-admin-tools*
*Completed: 2026-03-15*
