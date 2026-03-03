# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Bowlers can look themselves up and explore their stats -- career averages, personal records, season-by-season history. The bowler profile page must be amazing.
**Current focus:** Phase 2: Bowler Profiles

## Current Position

Phase: 2 of 7 (Bowler Profiles)
Plan: 2 of 3 in current phase (plan 1 complete)
Status: 02-01 data layer complete -- ready for 02-02 (hero header, records panel)
Last activity: 2026-03-02 -- 02-01 query layer and score utility complete

Progress: [████░░░░░░] 40%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: ~3 min
- Total execution time: ~11 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 3 | ~9 min | ~3 min |
| 2. Bowler Profiles | 1 | ~2 min | ~2 min |

**Recent Trend:**
- Last 5 plans: 02-01, 01-03, 01-02, 01-01
- Trend: Consistent ~2-3 min per plan

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 7 phases derived from 47 v1 requirements. Bowler profiles (Phase 2) are the centerpiece.
- [Roadmap]: XCUT requirements distributed across phases (XCUT-02/03 in Phase 1, XCUT-01 in Phase 2) rather than a separate phase.
- [Roadmap]: Champions/playoffs features (Phase 6) designed for graceful empty states since seasonChampions/playoffResults/matchResults tables are empty.
- [01-02]: connectTimeout (not connectionTimeout) is the correct mssql v9 config property for the 120s Azure SQL cold start timeout.
- [01-02]: Slug format is LOWER(REPLACE(firstName,' ','-'))+'-'+LOWER(REPLACE(lastName,' ','-')) -- consistent across generateStaticParams and query lookups.
- [01-02]: dynamicParams=false on bowler route -- unknown slugs get immediate 404, DB never queried at runtime.
- [01-02]: Force-commit .env.local.example despite .env* gitignore -- example template files must be tracked.
- [01-01]: DM_Serif_Display requires weight: '400' -- it is NOT a variable font (Inter is, needs no weight).
- [01-01]: @theme inline (not @theme) -- Tailwind utilities resolve to values, not CSS variable references.
- [01-01]: Server/client split in layout -- Header/Footer are server components, MobileNav/SearchBar are 'use client'.
- [01-03]: Used bowlers.slug column directly for search index instead of generating from firstName/lastName -- ensures consistency with pre-rendered bowler pages.
- [01-03]: Static route handler with force-static generates search JSON at build time -- pattern for any future build-time data endpoints.
- [02-01]: Installed vitest as test runner -- no prior test infrastructure existed in the project.
- [02-01]: getBowlerSeasonStats queries scores table directly (not view) to include teamSlug for cross-links.
- [02-01]: getBowlerCareerSummary wrapped in React.cache for metadata+page deduplication.

### Pending Todos

None yet.

### Blockers/Concerns

- matchResults, playoffResults, seasonChampions tables are empty. Phase 4 (TEAM-03 head-to-head) and Phase 6 (CHMP-01/02/03) must handle empty states. Data population plan needed before those phases.
- Recharts + React 19 compatibility unverified. Must check before Phase 2 (bowler profile charts).
- Vercel function region should be set to minimize latency to Azure SQL in North Central US.

## Session Continuity

Last session: 2026-03-02
Stopped at: Completed 02-01-PLAN.md (data layer) -- ready for 02-02
Resume file: .planning/phases/02-bowler-profiles/02-01-SUMMARY.md
