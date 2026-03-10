---
phase: 01-foundation
plan: 02
subsystem: database
tags: [azure-sql, mssql, isr, next.js, static-generation]

# Dependency graph
requires: []
provides:
  - Azure SQL connection pool with exponential retry (src/lib/db.ts)
  - Named SQL query functions for bowler data (src/lib/queries.ts)
  - Static bowler page scaffold with generateStaticParams and dynamicParams=false
  - On-demand ISR revalidation endpoint protected by REVALIDATION_SECRET
affects: [phase-02-bowler-profiles, phase-03-teams, phase-04-seasons, phase-05-leaderboards]

# Tech tracking
tech-stack:
  added: [mssql, "@types/mssql"]
  patterns:
    - Singleton connection pool with exponential backoff for Azure SQL cold starts
    - Server-only query layer (never imported by client components)
    - generateStaticParams + dynamicParams=false for zero-runtime DB access
    - ISR revalidation via POST /api/revalidate?secret=... protected endpoint

key-files:
  created:
    - src/lib/db.ts
    - src/lib/queries.ts
    - src/app/bowler/[slug]/page.tsx
    - src/app/api/revalidate/route.ts
    - .env.local.example
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Use connectTimeout (not connectionTimeout) for mssql config — linter auto-corrected the property name"
  - "Slug format: lowercase firstName-lastName with hyphens — consistent across getAllBowlerSlugs and getBowlerBySlug"
  - "Revalidation endpoint accepts secret from query param OR JSON body — supports both curl patterns"
  - "Force-committed .env.local.example despite .env* gitignore — example file has no secrets and must be tracked"

patterns-established:
  - "Pattern 1: All SQL lives in src/lib/queries.ts — page components never write raw SQL"
  - "Pattern 2: db.ts is server-only — never import from client components or shared utilities"
  - "Pattern 3: Next.js 15+ params is a Promise — always await params before destructuring slug"
  - "Pattern 4: dynamicParams = false on all static route segments — unknown paths return 404, never hit DB at runtime"

requirements-completed: [INFRA-01, INFRA-02, INFRA-04]

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 1 Plan 02: Data Pipeline Summary

**Azure SQL connection pool with 3-retry exponential backoff, build-time bowler slug generation via generateStaticParams, and REVALIDATION_SECRET-protected ISR trigger endpoint**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-02T21:59:03Z
- **Completed:** 2026-03-02T22:00:56Z
- **Tasks:** 2 of 3 (awaiting human verification at checkpoint)
- **Files modified:** 7

## Accomplishments

- mssql package installed with TypeScript types; connection pool handles Azure SQL cold starts with 120s timeout and 3-retry exponential backoff (5s, 10s, 20s delays)
- Query layer in src/lib/queries.ts exports getAllBowlerSlugs and getBowlerBySlug — all SQL centralized, no raw queries in page components
- Bowler route uses generateStaticParams + dynamicParams=false — all slugs pre-rendered at build time, unknown slugs get immediate 404
- Revalidation endpoint validates REVALIDATION_SECRET from query param or JSON body, calls revalidatePath('/', 'layout') to mark entire site stale

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, create DB connection and query layer** - `c19d4c7` (feat)
2. **Task 2: Static bowler page and revalidation endpoint** - `2f2298c` (feat)

## Files Created/Modified

- `src/lib/db.ts` - Singleton connection pool with exponential retry, exports getDb/closeDb
- `src/lib/queries.ts` - getAllBowlerSlugs and getBowlerBySlug query functions
- `src/app/bowler/[slug]/page.tsx` - Static bowler scaffold with generateStaticParams, dynamicParams=false
- `src/app/api/revalidate/route.ts` - POST endpoint protected by REVALIDATION_SECRET, calls revalidatePath
- `.env.local.example` - Documents required AZURE_SQL_* and REVALIDATION_SECRET env vars
- `package.json` / `package-lock.json` - mssql and @types/mssql added

## Decisions Made

- Used `connectTimeout` (not `connectionTimeout`) for mssql config — linter auto-corrected the property name to the correct mssql v9 API
- Slug generation uses `LOWER(REPLACE(firstName, ' ', '-')) + '-' + LOWER(REPLACE(lastName, ' ', '-'))` pattern consistently in both query functions
- Revalidation endpoint accepts secret from both query param and JSON body to support multiple calling patterns
- Force-committed `.env.local.example` with `git add -f` since it's an example template file that must be tracked, not a secrets file

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect mssql config property name**
- **Found during:** Task 1 (DB connection setup)
- **Issue:** Plan specified `connectionTimeout` but correct mssql property is `connectTimeout`
- **Fix:** Linter auto-corrected to `connectTimeout: 120000`; committed in Task 2 commit
- **Files modified:** src/lib/db.ts
- **Verification:** Property name matches mssql TypeScript type definitions
- **Committed in:** 2f2298c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — incorrect config property name)
**Impact on plan:** Auto-fix necessary for correct timeout behavior. No scope creep.

## Issues Encountered

- `.env.local.example` was blocked by `.env*` gitignore pattern. Resolved with `git add -f` since example files with no secrets must be tracked.

## User Setup Required

Before running `npm run build`, create `.env.local` with real Azure SQL credentials:

```bash
cp .env.local.example .env.local
# Fill in AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USER, AZURE_SQL_PASSWORD
# Generate REVALIDATION_SECRET with: openssl rand -hex 32
```

Environment variables needed:
- `AZURE_SQL_SERVER` — Azure Portal -> SQL databases -> splitzkrieg -> Overview -> Server name
- `AZURE_SQL_DATABASE` — Azure Portal -> SQL databases -> splitzkrieg -> Overview -> Database name
- `AZURE_SQL_USER` — Azure Portal -> SQL databases -> splitzkrieg -> Connection strings
- `AZURE_SQL_PASSWORD` — Azure Portal -> SQL databases -> splitzkrieg -> Connection strings
- `REVALIDATION_SECRET` — Generate with `openssl rand -hex 32`

## Next Phase Readiness

- Data pipeline complete — db.ts and queries.ts are ready for Phase 2 to build on
- Bowler page scaffold in place at `/bowler/[slug]` — Phase 2 expands with full stats
- Revalidation endpoint ready for post-sync triggers
- Awaiting checkpoint verification: user must confirm `npm run build` succeeds with real Azure SQL credentials

---
*Phase: 01-foundation*
*Completed: 2026-03-02*

## Self-Check: PASSED

All created files verified on disk. All task commits verified in git log.

| Item | Status |
|------|--------|
| src/lib/db.ts | FOUND |
| src/lib/queries.ts | FOUND |
| src/app/bowler/[slug]/page.tsx | FOUND |
| src/app/api/revalidate/route.ts | FOUND |
| .env.local.example | FOUND |
| .planning/phases/01-foundation/01-02-SUMMARY.md | FOUND |
| Commit c19d4c7 (Task 1) | FOUND |
| Commit 2f2298c (Task 2) | FOUND |
| Commit 65c7fd8 (Rule 2 fix) | FOUND |
