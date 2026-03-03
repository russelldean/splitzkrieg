# Splitzkrieg Bowling League

## What This Is

A stats-driven website for the Splitzkrieg Bowling League (splitzkrieg.org) — a social bowling league in Durham, NC running since 2007. The site makes 18 years of league history searchable and fun for 130+ members, with bowler profile pages as the centerpiece. Think Baseball Reference meets a league that names its teams "Gutter Sluts" and "Bowl'd Peanuts." Also serves as a full-stack portfolio piece demonstrating database design, data visualization, and modern web development.

## Core Value

Bowlers can look themselves up and explore their stats — career averages, personal records, season-by-season history, and how they stack up. If nothing else works, the bowler profile page must be amazing.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Bowler profile pages with career stats, season-by-season table, personal records, average progression chart
- [ ] Bowler search (prominent, front and center)
- [ ] Home page with league branding, current season snapshot, search bar
- [ ] Team profile pages with roster, history, head-to-head records
- [ ] Season pages with standings, division alignment, weekly results
- [ ] All-time leaderboards with filters (gender, active, season range)
- [ ] Champions and awards page (all 5 championship categories)
- [ ] Playoff bracket display and race tracker
- [ ] Schedule display (current + historical)
- [ ] Blog system for weekly recaps (new content going forward)
- [ ] Photo gallery
- [ ] About / Join the League page with interest form
- [ ] League rules and documents page
- [ ] Admin: lineup submission system (replaces Google Form)
- [ ] Admin: score entry interface (replaces spreadsheet workflow)
- [ ] Admin: auto-calculation engine (averages, handicaps, standings, achievements)
- [ ] Admin: season management (create seasons, divisions, schedules, rosters)
- [ ] Mobile-responsive layout
- [ ] Metrograph-inspired design (bold typography, cream/navy/red palette)

### Out of Scope

- Real-time chat — not core to a stats site
- Video content — storage/bandwidth overkill for a bowling league
- Mobile native app — web-first, responsive handles it
- OAuth / social login — email/password sufficient if accounts are needed
- Backfilling old weekly email content into blog — new content going forward only
- LeaguePals API integration — defer investigation until admin tools phase
- Historical schedule data for Seasons I–XXV — only XXVI–XXXV loaded, not blocking

## Context

**Database (Phase 0 complete):**
- Azure SQL Database (free serverless tier) at splitzkrieg-sql.database.windows.net
- 14 tables, 2 views, 1 function, 6 computed columns on scores table
- 22,817 scores, 619 bowlers, 42 teams, 35 seasons, 4,322 roster entries, 846 schedule rows
- Handicap calculations standardized via computed columns (225 base / 95% / FLOOR)
- Penalty rows and first-nighter logic handled in schema
- 17 team franchise lineages mapped with alternate name history
- Auto-pauses when idle; cold starts accepted (30-60s wake time)

**Data sync:**
- Current season data synced manually from Google Sheets every ~2 weeks
- Google Sheets continues as operational system until admin tools are built
- Admin tools (Phase 6) retire Sheets as the operational system

**Known data gaps:**
- 7 missing nights out of 309 (mostly playoff weeks, low recovery potential)
- 21 bowlers missing gender assignment
- fn_RollingAverage function broken (references old table/column names)
- matchResults, playoffResults, seasonChampions tables empty (data not yet loaded)
- COVID interim season data not yet imported
- Zero-score game rows need confirmation (4 rows)

**Existing code:**
- Next.js + Tailwind scaffolding in place
- GitHub repo initialized

**Design reference docs in `docs/`:**
- `splitzkrieg-site-plan.md` — full site plan with phased roadmap
- `splitzkrieg-data-model.md` — complete data model reference
- `splitzkrieg-schema.sql` — production database schema
- `splitzkrieg-infra-reference.md` — Azure and infrastructure details
- `splitzkrieg-data-quality-report.md` — data quality audit and known issues
- `splitzkrieg-franchise-map.md` — team name history and franchise lineages

## Constraints

- **Database**: Azure SQL Database (free serverless tier) — already deployed, schema locked in. Connection via `mssql` npm package.
- **Hosting**: Vercel free tier for Next.js app. Must stay within free tier limits for now.
- **Tech stack**: Next.js (App Router) + React + Tailwind CSS + Recharts. Decisions made, not negotiable.
- **Data**: Historical data is migrated but some tables (matchResults, playoffResults, seasonChampions) are empty. Website must handle missing data gracefully.
- **Domain**: splitzkrieg.org registered, ready to point to Vercel.
- **Static hybrid**: Public site is fully static (SSG + on-demand revalidation). Azure SQL only wakes during builds and admin work. Visitors never hit the database — instant loads, $0 hosting. Easy to switch to always-on ($15/month) later if needed.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Azure SQL over Postgres/Supabase | Russ already knows SQL Server, same T-SQL syntax, portfolio signal | — Pending |
| Next.js monolith (no separate backend) | Static generation + API routes for revalidation = one codebase, one deployment | — Pending |
| Vercel hosting | Made for Next.js, free tier generous, push-to-deploy | — Pending |
| Computed columns for handicaps | Standardizes 225/95%/FLOOR across all 35 seasons, eliminates stored value drift | — Pending |
| Static hybrid architecture | Data changes biweekly — pre-render everything, DB only wakes for builds/admin. $0 hosting, instant loads. | — Pending |
| Achievement badges on profiles | Celebrate real milestones (100 games, 200+ game) — recognition, not gamification | — Pending |
| Progressive leaderboards | Baseball Reference-style "who held the record at each point in time" | — Pending |
| Manual Google Sheets sync | Every ~2 weeks until admin tools replace Sheets in Phase 6 | — Pending |
| No unique constraint on scores | Legitimate duplicates exist (subs bowling for two teams, double-headers) | — Pending |
| Metrograph-inspired design | Bold typography, cream/navy/red palette — achievable with Tailwind | — Pending |

---
*Last updated: 2026-03-02 after initialization*
