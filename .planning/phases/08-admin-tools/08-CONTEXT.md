# Phase 8: Admin Tools - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Commissioner gets a web-based admin dashboard to manage the full weekly pipeline: pull scores from LeaguePals, review/adjust, confirm, process match results and patches, write a blog post, publish the week, and send the recap email. Team captains get a dedicated lineup submission page. The admin also generates printable scoresheets from submitted lineups and pushes lineup data to LeaguePals. Blog content moves from MDX files in the repo to a DB-backed markdown editor.

Season management (creating seasons, divisions, schedules, rosters) is NOT in scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### Scope and Pipeline
- Two features: score entry pipeline (admin) and lineup submission (captains)
- Full pipeline in admin UI: LP pull -> review/adjust scores -> confirm -> auto-run match results + patches -> write blog post -> publish week -> send recap email
- Publish step is deliberately separate from score confirmation (blog post happens in between)
- Manual score entry fallback for when LP is unavailable
- Can edit scores for any previous week, not just current
- LP pull returns all scores for the whole night at once

### Authentication
- Admin: password login at `/admin`
- Captains: magic links sent by commissioner, long-lived sessions (persist across weeks), at `/lineup`
- Captain sees lineup form only (no stats/dashboard)
- Admin sends magic links to captains (no self-service)

### Admin Dashboard
- Landing page shows overview: lineup submission status for current week, score pipeline status, recent activity
- Drill into actions from the dashboard

### Score Review UI
- Display pulled scores organized by match (Team A vs Team B cards)
- Four types of adjustments inline: fix wrong scores, add turkey counts, resolve unmatched bowlers, handle penalties/absences
- Unmatched bowler resolution: fuzzy search against existing bowlers + one-click create new bowler
- Turkey count field appears during review (not a separate step)
- Soft validation warnings (unusual scores, duplicates) - displayed but non-blocking
- Post-confirm summary screen: personal bests hit, patches awarded, standings impact

### Lineup Submission
- Captains pick bowlers from full bowler list, pre-sorted by their team's recent roster
- Set bowling order (position matters)
- Can free-enter a brand new bowler not yet in the system
- Auto-accepted on submit, commissioner can override/edit
- Default to last week's lineup if no submission received

### Scoresheet Generation
- Generate printable PDF scoresheets from submitted lineups
- One page per match (Team A vs Team B)
- Pre-filled with bowler names, incoming averages, and handicaps
- Blank spaces for 3 game scores and turkey counts
- One button: "Generate scoresheets for this week" (uses schedule for matchups)

### LeaguePals Integration
- LP pull: admin UI button to pull scores (replaces running script from terminal)
- LP push: auto-push finalized lineups to LP per week so scoring system is ready
- Existing LP API patterns in scripts/leaguepals/ and memory/leaguepals-automation.md

### Blog Editor
- Move blog from MDX files in repo to DB-backed storage
- Markdown editor with side-by-side preview in admin UI
- Auto-draft with stat block tables pre-populated from confirmed scores (existing weekly recap components)
- Narrative text left blank for commissioner to write
- Migrate existing MDX blog posts to DB (only a couple posts)

### Deploy and Cache
- Publishing triggers auto-rebuild (Vercel deploy hook or ISR revalidation)
- Success banner in admin UI after publish (no email notification)
- Recap email sent from admin UI; ideally from commissioner's own email address (Resend domain verification)

### Claude's Discretion
- Auth library/approach (NextAuth, custom JWT, etc.)
- PDF generation library
- Markdown editor component
- Admin UI component library or custom build
- DB schema for blog posts and lineup submissions
- Exact Vercel rebuild trigger mechanism
- Mobile responsiveness of admin (commissioner may use on phone)

</decisions>

<specifics>
## Specific Ideas

- "We only just figured out pulling the scores from LP" - LP integration is new and should be treated as potentially fragile. Manual fallback is important.
- "I still have step of creating scoresheets from the lineups info, we should automate" - scoresheet generation is a key pain point
- "There is not a formal 'roster'" - the league has fluid rosters, captains should see all bowlers not just their team
- "Draft with all the data tables we have planned out already, no text draft though" - stat blocks auto-populated, narrative text is commissioner's voice
- Recap email should come from commissioner's email address if possible
- Commissioner currently emails Google Form link to captains for lineups, then uses responses to mark bowlers in scoresheets file

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/db.ts`: getDb() singleton pool, cachedQuery() with disk cache, withRetry() for Azure SQL throttling
- `src/app/api/revalidate/route.ts`: Secret-based API auth pattern (REVALIDATION_SECRET env var)
- `src/app/api/feedback/route.ts`: POST endpoint pattern with Resend email integration
- `scripts/import-week-scores.mjs`: Full score import logic - staging JSON review, bowler matching, incoming avg calculation, DB inserts
- `scripts/leaguepals/lp-pull-scores.mjs`: LP API score pull with connect.sid cookie auth
- `scripts/leaguepals/lp-push-roster.mjs`: LP API roster push
- `scripts/populate-match-results.mjs`: Match result generation from schedule + scores
- `scripts/populate-patches.mjs`: Patch/milestone calculation
- `scripts/publish-week.mjs`: Publish gate (leagueSettings table update)
- `scripts/send-recap-email.mjs`: Resend email with inline HTML
- Existing blog MDX infrastructure in `content/posts/` and `src/app/blog/`
- Weekly recap stat block components already built for blog posts

### Established Patterns
- DB writes: direct mssql pool, parameterized queries, no ORM
- Cache busting: bump `.data-versions.json` + clear disk cache files
- API auth: env var secret check on request
- Error handling: retry with exponential backoff for Azure SQL

### Integration Points
- `/admin` route tree: new, needs auth middleware
- `/lineup` route: new, needs magic link auth
- `leagueSettings` table: already has publishedSeasonID/publishedWeek for publish gate
- `.data-versions.json`: must be bumped after score writes
- Vercel deploy hooks: available via Vercel API
- Blog rendering: currently reads MDX from filesystem, needs to switch to DB reads

</code_context>

<deferred>
## Deferred Ideas

- Season management (create seasons, divisions, schedules, rosters) - future phase
- Captain self-service magic link request - keep commissioner-controlled for now
- Captain team stats/standing view alongside lineup form - public site covers this

</deferred>

---

*Phase: 08-admin-tools*
*Context gathered: 2026-03-14*
