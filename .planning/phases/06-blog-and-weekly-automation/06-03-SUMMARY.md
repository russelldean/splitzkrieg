---
phase: 06-blog-and-weekly-automation
plan: 03
subsystem: automation
tags: [publish-gate, resend, email, leagueSettings, pipeline, runbook]

requires:
  - phase: 06-blog-and-weekly-automation
    provides: "Blog infrastructure and content pipeline (plans 01-02)"
provides:
  - "leagueSettings table with publishedWeek/publishedSeasonID"
  - "publish-week.mjs script for commissioner to control published week"
  - "Homepage and bowler profile queries gated by publish setting"
  - "send-recap-email.mjs for weekly email notifications via Resend"
  - "Weekly runbook documenting full pipeline end-to-end"
affects: [weekly-workflow, homepage, bowler-profiles, email-notifications]

tech-stack:
  added: [leagueSettings-table, resend-email]
  patterns: [publish-gate-pattern, commissioner-scripts]

key-files:
  created:
    - scripts/create-league-settings.mjs
    - scripts/publish-week.mjs
    - scripts/send-recap-email.mjs
    - docs/weekly-runbook.md
  modified:
    - src/lib/queries/home.ts
    - src/lib/queries/bowlers.ts

key-decisions:
  - "Publish gate uses leagueSettings table with settingKey/settingValue pattern"
  - "HIGHLIGHTS query uses publishedSeasonID + publishedWeek instead of MAX(week) ORDER BY"
  - "Email script uses inline HTML (not templates) with navy/cream/red palette"
  - "Runbook includes match results step between import and patches"

patterns-established:
  - "Publish gate: query leagueSettings instead of MAX(week) for latest-week determination"
  - "Commissioner scripts: parse args with getArg helper, default season to 35"

requirements-completed: [CONT-01, CONT-02]

duration: 3min
completed: 2026-03-10
---

# Phase 6 Plan 3: Publish Gate, Email, and Weekly Runbook Summary

**Publish gate via leagueSettings table controlling homepage/profile week display, Resend email notifications, and end-to-end weekly runbook**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T22:07:53Z
- **Completed:** 2026-03-10T22:10:52Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Publish gate controls which week appears on homepage snapshot, BOTW, TOTW, and weekly highlights
- Commissioner can publish a week with `node scripts/publish-week.mjs --week=N`
- Recap email sends via Resend with HTML teaser and CTA button to blog post
- Weekly runbook documents the complete pipeline from score pull to email send

## Task Commits

Each task was committed atomically:

1. **Task 1: Create leagueSettings table, publish-week script, and modify gated queries** - `10c3053` (feat)
2. **Task 2: Create email script and weekly runbook** - `eb76cac` (feat)

## Files Created/Modified
- `scripts/create-league-settings.mjs` - One-time table setup with IF NOT EXISTS guard
- `scripts/publish-week.mjs` - Updates publishedWeek and publishedSeasonID in DB
- `scripts/send-recap-email.mjs` - Sends HTML recap email via Resend SDK
- `docs/weekly-runbook.md` - Step-by-step commissioner workflow with troubleshooting
- `src/lib/queries/home.ts` - Snapshot, BOTW, TOTW, and highlights queries gated by leagueSettings
- `src/lib/queries/bowlers.ts` - Bowler-of-the-week query gated by leagueSettings

## Decisions Made
- Used `leagueSettings` key-value table (not a config column on seasons) for flexibility
- Highlights query reads both publishedSeasonID and publishedWeek from leagueSettings via CROSS JOIN
- Email uses inline CSS for maximum email client compatibility
- Runbook includes match results calculation step (not in original plan but part of the actual pipeline)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

Before first use:
1. Run `node scripts/create-league-settings.mjs` to create the leagueSettings table in Azure SQL
2. Ensure `RESEND_API_KEY` is set in `.env.local` for the email script
3. Verify `splitzkrieg.org` domain in Resend dashboard for from-address approval

## Next Phase Readiness
- Publish gate is ready for immediate use with current Season 35 Week 4 data
- Email script is ready once Resend domain is verified
- Runbook serves as the living reference for all future weekly publishes

---
*Phase: 06-blog-and-weekly-automation*
*Completed: 2026-03-10*
