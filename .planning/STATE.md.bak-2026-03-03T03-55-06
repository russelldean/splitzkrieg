# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Bowlers can look themselves up and explore their stats -- career averages, personal records, season-by-season history. The bowler profile page must be amazing.
**Current focus:** Phase 2 approved, ready for Phase 3

## Current Position

Phase: 2 of 7 (Bowler Profiles) — COMPLETE, approved by user
Plan: 3 of 3 in current phase (all plans complete + extensive checkpoint feedback)
Status: Phase 2 done — user approved, ready to move to Phase 3
Last activity: 2026-03-02 — Final checkpoint round, committed and pushed

Progress: [██████░░░░] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: ~3 min
- Total execution time: ~16 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 3 | ~9 min | ~3 min |
| 2. Bowler Profiles | 3 | ~7 min | ~2 min |

**Recent Trend:**
- Last 5 plans: 02-03, 02-02, 02-01, 01-03, 01-02
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
- [02-02]: ShareButton is the only client component -- all other bowler profile components are server components for static rendering.
- [02-02]: StatPill shows em-dash for null/zero values to avoid displaying misleading data.
- [02-02]: SeasonStatsTable computes career totals from seasons array rather than a separate query.
- [02-03]: Recharts 3.7.0 installed -- confirmed React 19 compatible, no ResizeObserver issues.
- [02-03]: metadataBase uses NEXT_PUBLIC_SITE_URL env var with fallback to splitzkrieg.org.
- [02-03]: GameLog uses arbitrary Tailwind opacity (bg-navy/[0.02]) for subtle hover effects.
- [Checkpoint]: Current Avg = rolling 27-game average (handicap basis), falls back to establishedAvg for bowlers without games.
- [Checkpoint]: prevRollingAvg computed via OFFSET 3 ROWS FETCH NEXT 27 to show rolling avg delta.
- [Checkpoint]: Season stats and game logs both reverse chronological (newest first). Chart gets reversed copy.
- [Checkpoint]: Score color formatting removed from personal records — kept only in game logs.
- [Checkpoint]: Bowler of the Week = highest handSeries in most recent week, shown as SVG rosette ribbon.
- [Checkpoint]: Nav icons added (person, group, calendar, bar chart) — Metrograph-inspired.
- [Checkpoint]: Splitzkrieg logo in footer with mix-blend-multiply on cream background.

### Pending Todos

- Data backfill: historic team names per season (teamNameOverride on teamRosters)
- Data backfill: schedule/matchDate data for older seasons
- Data backfill: high game/series dates on personal records (once matchDate data exists)
- Remove reference photo IMG_2527.jpg from public/ (was used for ribbon design reference)

### Blockers/Concerns

- matchResults, playoffResults, seasonChampions tables are empty. Phase 4 (TEAM-03 head-to-head) and Phase 6 (CHMP-01/02/03) must handle empty states. Data population plan needed before those phases.
- Recharts 3.7.0 + React 19 compatibility VERIFIED. Works in Phase 2 bowler profile charts.
- Vercel function region should be set to minimize latency to Azure SQL in North Central US.
- Vercel deployment not yet connected — needs setup before Phase 3 or soon after.

## Session Continuity

Last session: 2026-03-02
Stopped at: Phase 2 approved, all work committed and pushed. Ready for Phase 3 (Search and Home Page).
Resume file: None — clean handoff to Phase 3
