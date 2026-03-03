# Project Research Summary

**Project:** Splitzkrieg Bowling League Stats Website
**Domain:** Sports statistics reference site (bowling league, read-heavy, data-visualization-forward)
**Researched:** 2026-03-02
**Confidence:** MEDIUM-HIGH

> **ARCHITECTURAL OVERRIDE (2026-03-02):** This research was written before the **static hybrid** decision. The architecture has fundamentally changed:
> - **All public pages are statically generated (SSG) at build time.** Azure SQL is only accessed during builds and admin operations — visitors never hit the database.
> - **No visitor-facing cold starts.** The 30-60s Azure SQL wake-up is a build-time concern handled with retry logic, not a visitor UX problem.
> - **No loading skeletons for DB waits.** Pages are pre-rendered HTML. Loading states are only needed for client-side page transitions.
> - **Search is a pre-built JSON index** (fuse.js on a static file), not a live API route hitting the DB.
> - **On-demand revalidation** triggers a static rebuild after data syncs, deploying new pre-rendered pages.
> - References to "Server Components fetching data at runtime," "cold-start UX," "loading.tsx for DB waits," and "ISR caching" below reflect the OLD architecture. Read them with this context.

## Executive Summary

Splitzkrieg is a sports reference site in the mold of Baseball Reference and Baseball Savant, applied to an 18-year-old recreational bowling league with 619 bowlers and 22,817+ score rows. The target experience is not "another league management site" — it is the first place bowlers go to look up their stats, argue about career averages, and share profiles in the group chat. The product already has a deployed Next.js 16 + Tailwind v4 + Azure SQL stack, which is well-suited to the domain.

**Static hybrid architecture:** The entire public site is statically generated at build time. Data changes biweekly — there is no need for runtime database access. Build scripts fetch from Azure SQL, pre-render every page as static HTML, and generate a client-side search index. Visitors get instant page loads with zero database round-trips. On-demand revalidation (triggered after data syncs) rebuilds affected pages and deploys fresh static content. Azure SQL only wakes during builds and admin work — $0 hosting, instant loads, no cold-start UX concerns.

The recommended approach is to build in layers that mirror the Baseball Reference model: establish the infrastructure (build-time data pipeline, design system, static generation) first, then build the bowler profile page as the centerpiece the entire site is organized around, then expand the browsable universe with team and season pages, then add the "get lost in data" layer of leaderboards, game logs, and percentile rankings. The profile page is the product — when a bowler sees their career stats laid out by season with an average-progression chart for the first time, that is the moment the site proves its value.

The primary risks are build-pipeline-level, not feature-level. Azure SQL's serverless auto-pause creates 30-60 second cold starts that must be handled during the build process (retry logic, generous timeouts) so builds complete reliably. The build-time data fetching pattern and the static/client component boundary are foundational: get them right from the start or every subsequent phase inherits the debt.

## Key Findings

### Recommended Stack

The core stack is already installed and well-matched to the domain. Next.js 16 App Router with Server Components is ideal for a read-heavy stats site: data fetches on the server, pages serve from Vercel's edge CDN via ISR, and no separate backend is needed for 90% of the site. The critical additions are `mssql` (the only real option for Azure SQL from Node.js), `recharts` (declarative React charting for average progression and season comparison charts), `@tanstack/react-table` (headless sortable/filterable tables for leaderboards), and `fuse.js` (client-side fuzzy search for 619 bowlers — faster than a server round-trip at this scale).

Raw SQL via `mssql` is the right database access pattern. The schema is already deployed, the queries involve window functions and CTEs, and ORM abstraction (Prisma, Drizzle) adds overhead without benefit for a read-only stats site. The Metrograph-inspired design system is handled entirely in Tailwind v4's CSS-first `@theme` block — no CSS-in-JS, no styled-components.

**Core technologies:**
- Next.js 16.1.6: Full-stack framework — App Router, Server Components, ISR, and API routes in one codebase (already installed)
- React 19.2.3: UI library with Server Components as first-class feature (already installed)
- Tailwind CSS v4: Utility-first CSS with `@theme`-based design tokens for Metrograph aesthetic (already installed)
- TypeScript 5.x: Type safety for database result sets — prevents runtime column-mapping errors (already installed)
- mssql ^11: Azure SQL connector — singleton connection pool, parameterized queries, 60s timeout for cold starts
- Recharts ^2.15: Declarative React charting — line charts for average progression, bar charts for season comparison
- @tanstack/react-table ^8: Headless table logic — sorting, filtering, and pagination without opinionated UI
- fuse.js ^7: Client-side fuzzy search — handles name variants, instant for 619 bowlers, no server round-trip
- clsx + tailwind-merge: `cn()` utility for conditional Tailwind class composition

**Verify before installing:** Recharts 2.x + React 19 compatibility is the highest-risk item. Check for a v3 or pin to a known-good version if peer dependency errors appear.

### Expected Features

The feature landscape is well-understood. Baseball Reference and Basketball Reference provide battle-tested patterns for information architecture, and the Splitzkrieg data model supports nearly all of them directly.

**Must have (table stakes):**
- Bowler profile page — career summary, season-by-season stats table, personal records panel, average progression chart (the centerpiece; the site lives or dies on this)
- Bowler search — prominent autocomplete with fuzzy matching for name variants
- Home page — search bar front and center, league snapshot, quick stats
- Team profile pages — roster, season records, bowler links
- Season pages — standings, weekly results, division alignment
- All-time leaderboards — sortable, filterable by gender/active status, scratch/handicap toggle
- Mobile-responsive layout — bowlers share links in group texts; if it breaks on phones, it fails
- Shareable slug-based URLs — `/bowler/russ-smith`, `/team/gutter-sluts`, `/season/xxxv`
- Cross-linking everywhere — every name and season is a link (makes the site feel like a real reference)

**Should have (differentiators):**
- Percentile rankings on bowler profiles — "78th percentile in career average" with color-coded bars (Baseball Savant-style)
- Game log — week-by-week scores expandable per season on the profile page
- Milestone tracker — "3 games away from 100 career games"
- Color-coded performance in tables — 200+ games green, 250+ gold, sub-100 dimmed
- Leaderboard context in profiles — "Ranked 5th in career average (active bowlers)"
- Champions and awards page — seasonal champions history, the record book
- Career timeline — teams, seasons, a "transaction log" for the bowler's league history
- Similar bowlers — simple query for bowlers within ±5 pins of career average
- OG social cards — rich link previews when sharing in group chats

**Defer (v2+):**
- Bowler comparison tool (fun, not essential before core browsing is complete)
- Playoff race tracker (only relevant during active seasons; needs admin tools first)
- Head-to-head team records (blocked on `matchResults` table population)
- Blog system (no data dependency; can be built whenever content creation is ready)
- Admin tools / score entry (large scope, separate phase)
- User authentication for bowlers (only needed when personalization features exist)

**Data gaps requiring attention:** Three tables are currently empty — `matchResults`, `playoffResults`, and `seasonChampions`. Features depending on them (head-to-head records, playoff brackets, champions page) should be designed to show graceful empty states and progressively fill in as data is added.

### Architecture Approach

The architecture is **static hybrid**: all public pages are pre-rendered at build time using Next.js static generation. Azure SQL is accessed only during builds (via `generateStaticParams` and page-level data fetching at build time). Visitors receive pure static HTML from Vercel's CDN — no database round-trips, no serverless functions, no cold starts. Client Components are reserved for genuinely interactive elements: Recharts charts (require browser APIs), the bowler search (fuse.js on a pre-built JSON index), sortable/filterable tables, and the scratch/handicap toggle.

The critical architectural boundary is `lib/db/queries/` — all SQL lives here. No SQL in page components, ever. The `server-only` package enforces this at build time. On-demand revalidation via API route triggers static regeneration after biweekly data syncs — new pre-rendered pages deploy automatically.

**Major components:**
1. `lib/db/pool.ts` — singleton mssql connection pool with 60s timeout for Azure cold starts (used at build time only)
2. `lib/db/queries/` — entity-specific query modules (bowlers, teams, seasons, scores, leaderboards)
3. Static pages (`app/bowlers/[slug]/page.tsx`, etc.) — fetch data at build time via `generateStaticParams`, render as static HTML
4. `components/charts/` — Recharts wrappers as Client Components, receiving pre-fetched data as props
5. `components/ui/` — design system atoms (stat cards, data tables, page headers) in the Metrograph aesthetic
6. `app/api/revalidate/` — on-demand revalidation endpoint to trigger rebuilds after data syncs
7. `public/search-index.json` (or similar) — pre-built bowler search index generated at build time for client-side fuse.js search

### Critical Pitfalls

1. **Azure SQL cold start during builds (30-60s)** — The DB auto-pauses after idle. Builds must handle the wake-up with `connectionTimeout: 60000` and retry logic. This is a build reliability concern, not a visitor UX concern — visitors get static HTML and never touch the DB.

2. **mssql connection pool management during builds** — Use the singleton pool pattern with `globalThis` for HMR safety during dev. Set `pool.max: 5` (free tier has ~30 concurrent connection limit), `pool.min: 0`. Ensure the pool closes cleanly after build completes.

3. **Static vs Client Component boundary** — Data fetching happens at build time in page components. Client Components are only for interactive elements (charts, search, sortable tables) that receive pre-built data as props. Never add `"use client"` to a page component. Push it to leaf components. Install `server-only` in `lib/db.ts` to catch accidental client imports.

4. **Pre-aggregating data for static pages** — 619 bowlers, 22K+ score rows. All aggregation (averages, ranks, totals) must happen in SQL at build time. Static pages receive pre-computed data. For charts, use season averages (max 35 points) not weekly averages. The search index should be a pre-built JSON file, not a live query.

5. **Vercel function region vs Azure SQL region (build time)** — Azure SQL is in North Central US. Set Vercel function region to `cle1` (Cleveland) or `iad1` (Washington DC) to minimize build-time DB latency.

## Implications for Roadmap

Based on combined research, the architecture has clear dependency layers that dictate phase order. Foundation must precede all features. The bowler profile page is the centerpiece that should be built before team pages, season pages, or leaderboards — it establishes the data access patterns, component patterns, and design system that everything else inherits.

### Phase 1: Foundation and Infrastructure

**Rationale:** Every subsequent feature uses the build-time data pipeline, design system, and static generation pattern. Building this wrong once means fixing it everywhere.

**Delivers:** Build-time data fetching pipeline, static generation setup, design system tokens, pre-built search index infrastructure, revalidation endpoint, project structure

**Addresses:** Infrastructure prerequisites for all features

**Avoids:** Build failures from DB cold starts, connection pool issues, credential exposure, function region mismatch

**Includes:**
- `lib/db/pool.ts` singleton with cold-start retry handling (build-time only)
- `lib/db/types.ts` TypeScript types matching schema
- `server-only` guard on all database modules
- Tailwind `@theme` design tokens (cream, navy, red, gold palette; DM Serif Display + Inter fonts)
- `cn()` utility (clsx + tailwind-merge)
- Root layout (nav shell, footer)
- `/api/revalidate` endpoint for on-demand static regeneration after data syncs
- Vercel function region configuration
- Build-time search index generation infrastructure

**Research flag:** Standard patterns — no deep research needed. mssql pool singleton and Tailwind v4 `@theme` configuration are well-documented.

### Phase 2: Bowler Profile Page (The Centerpiece)

**Rationale:** The bowler profile is the entire value proposition. When a bowler sees their career laid out by season with an average-progression chart for the first time, the site proves itself. Everything else is built around this page. Getting it right establishes the component and query patterns all other entity pages will follow.

**Delivers:** The "holy crap" moment. Career summary header, season-by-season stats table with career totals, personal records panel, average progression chart, shareable URL, OG meta tags

**Features from FEATURES.md:** Bowler profile page, season-by-season stats table, personal records panel, average progression chart, shareable URLs, social OG cards

**Architecture from ARCHITECTURE.md:** First use of static page generation with `generateStaticParams`, build-time query pattern, Client Component chart integration

**Avoids:** Client-side data overload (aggregate in SQL at build time, not JS at runtime), missing mobile layout (verify at 375px), penalty row pollution in averages, missing data for low-game-count bowlers

**Research flag:** Standard patterns — static generation + Recharts + TanStack Table are well-documented.

### Phase 3: Bowler Search and Directory

**Rationale:** Search is how people enter the site. Without it, the only way to reach a profile is a direct URL. Search is also the highest-traffic feature after profiles — bowlers type a name before they do anything else.

**Delivers:** Autocomplete search bar (fuse.js client-side), bowler directory page, home page with search prominence

**Features from FEATURES.md:** Bowler search, home page with league snapshot

**Avoids:** Missing alternate name handling (search "Leo Deluca" must return "Leo DeLuca"), returning too many results without context (show team + season in results)

**Research flag:** Standard patterns.

### Phase 4: Team Pages and Season Pages

**Rationale:** Cross-linking is what makes a reference site feel like a complete universe rather than a collection of pages. Team pages and season pages complete the three-entity browsable graph (bowlers → teams → seasons). Every bowler profile links to a team; every team links to its bowlers and its seasons.

**Delivers:** Team profile pages (roster, season records, bowler links), season pages (standings, weekly results), cross-linking across all entities

**Features from FEATURES.md:** Team profile pages, season standing pages, cross-linking everywhere

**Avoids:** Empty state for matchResults-dependent features (head-to-head records gracefully shows "coming soon"), broken Season XXV (COVID DNF) display

**Research flag:** Standard patterns, but season page standings logic (points computation from matchResults) needs the data population plan confirmed before deep implementation.

### Phase 5: Leaderboards and Stats Depth

**Rationale:** Once the three-entity universe is browsable, leaderboards complete the "who's the best" question that drives casual browsing. This phase also adds the "get lost in data" enrichments to bowler profiles that turn it from good to great.

**Delivers:** All-time leaderboards with gender/active/scratch/handicap filters, percentile rankings on bowler profiles, game log (expandable week-by-week), milestone tracker, color-coded performance, leaderboard context in profiles

**Features from FEATURES.md:** All-time leaderboards, percentile rankings, game log, milestone tracker, color-coded performance, leaderboard context

**Avoids:** Dumping 619 bowlers without pagination (server-side OFFSET/FETCH), missing minimum games filter (9+ games for ranking), NULL gender handling in filters (21 bowlers)

**Research flag:** Leaderboard query performance on 22K+ rows warrants research. Indexed views or pre-computed aggregations may be needed. Recommend `/gsd:research-phase` before implementation.

### Phase 6: History, Recognition, and Discovery

**Rationale:** These features depend on data not yet in the system (`seasonChampions`, full `matchResults`) and require lower technical complexity once the infrastructure is in place. They add depth and a sense of institutional history that bowlers who have been in the league since Season I will appreciate.

**Delivers:** Champions and awards page, career timeline on bowler profiles, similar bowlers suggestions, aggregate league stats dashboard

**Features from FEATURES.md:** Champions/awards page, career timeline, similar bowlers, aggregate stats

**Avoids:** Empty champions page (design for graceful empty state; populate data first), team franchise history continuity (Bowl Derek / Gutter Despair name tracking)

**Research flag:** Data population strategy for `seasonChampions` and `matchResults` is non-technical but blocks this phase. Needs a plan before building the UI.

### Phase 7: Admin Tools and Data Entry

**Rationale:** Score entry and data management are a separate product from the public reference site. They require authentication, authorization, and a different user mental model. Deferring to Phase 7 means the public site delivers value immediately without the complexity of auth infrastructure.

**Delivers:** Commissioner score entry workflow, manual sync + revalidation trigger, `/admin` route protection

**Features from FEATURES.md:** Admin tools (explicitly deferred from earlier phases)

**Avoids:** Premature auth complexity, adding authentication infrastructure before concrete need

**Research flag:** Needs research. Authentication approach (Next.js middleware, Auth.js, Clerk, or simple shared secret) needs evaluation based on the commissioner's technical comfort level. Recommend `/gsd:research-phase` before planning this phase.

### Phase Ordering Rationale

- Foundation before all features: 6 of the critical pitfalls are infrastructure-level and affect every feature if not addressed first
- Bowler profile before team/season pages: establishes data access patterns, component patterns, and design system; team and season pages reuse these patterns
- Search before expanding the entity graph: search is the entry point; building team pages without bowler search creates a browsable universe with no front door
- Leaderboards after the three-entity graph: leaderboards reference and link to bowler profiles; profiles must exist first
- History/recognition last among user-facing features: depends on data not yet populated; designing empty states first would be premature
- Admin last: auth complexity and separate user model; defer until the public site is fully realized

### Research Flags

Phases needing deeper research during planning:
- **Phase 5 (Leaderboards):** SQL Server performance on 22K+ rows with complex aggregations; indexed views vs. pre-computed tables; verify query plans with `SET STATISTICS IO ON`
- **Phase 7 (Admin Tools):** Authentication approach selection; commissioner workflow UX; authorization model for score entry

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** mssql singleton, Tailwind v4 `@theme`, Next.js loading.tsx — extensively documented
- **Phase 2 (Bowler Profile):** Server Component + Recharts + TanStack Table combination — well-documented
- **Phase 3 (Search):** fuse.js client-side search — simple, well-documented, no framework coupling
- **Phase 4 (Team/Season Pages):** Same patterns as Phase 2; no new technology introduced

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core stack (Next.js, React, Tailwind) is installed and verified. Addition libraries (mssql, Recharts, TanStack) are well-documented but not yet installed. Recharts + React 19 compatibility is the one unverified risk. |
| Features | HIGH | Baseball Reference / Basketball Reference patterns are stable and well-understood. Project docs provide specific bowling stats and data model. Feature list is grounded in existing schema columns. |
| Architecture | HIGH | Next.js 16 official docs verified for Server Components, caching, and data fetching patterns. Schema and infrastructure constraints known from first-party project docs. mssql singleton pattern is MEDIUM (training data, not verified against current mssql docs). |
| Pitfalls | MEDIUM | Azure SQL auto-pause behavior and mssql connection pooling are well-established community knowledge. Vercel Hobby plan timeout limits (10s API routes, 60s streaming) should be verified against current pricing page — limits change. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Recharts + React 19 compatibility:** Verify peer dependency before committing to Recharts. If incompatible, evaluate Nivo or wait for Recharts v3. Do not skip — charts are on the critical path for the bowler profile.
- **Vercel Hobby plan function timeout:** Verify current limits (claimed 10s for API routes, 60s for streaming Server Components). This affects the cold-start mitigation strategy.
- **Azure SQL free tier connection limit:** Verify the ~30 concurrent connection limit in the Azure portal. Sets the `pool.max` ceiling.
- **matchResults / playoffResults / seasonChampions data population:** These tables are empty. Phase 4 (season pages) and Phase 6 (champions) depend on them. The data population plan (manual entry, historical research, going-forward only) needs a decision before those phases begin.
- **Vercel function region:** Confirm the correct region code for closest proximity to Azure SQL in North Central US. Current recommendation is `cle1` or `iad1` — verify against current Vercel region list.
- **Season XXV (COVID DNF):** This season exists in the database but was not completed. Every phase that renders season data needs explicit handling for this edge case.

## Sources

### Primary (HIGH confidence)
- Next.js 16.1.6 official documentation — Server Components, caching, data fetching, ISR patterns
- `docs/splitzkrieg-schema.sql` — 14 tables, 2 views, computed columns; first-party source
- `docs/splitzkrieg-infra-reference.md` — Azure SQL serverless config, mssql requirement; first-party
- `docs/splitzkrieg-site-plan.md` — feature descriptions, phased roadmap; first-party
- `.planning/PROJECT.md` — constraints, decisions, data status; first-party
- `package.json` — installed versions confirmed (Next.js 16.1.6, React 19.2.3, Tailwind 4.x)
- Baseball Reference, Basketball Reference, Baseball Savant — pattern reference (training data, stable long-running sites)

### Secondary (MEDIUM confidence)
- Training data: mssql npm package connection pooling patterns — well-documented across npm, GitHub issues, community posts
- Training data: Azure SQL serverless auto-pause behavior — documented Microsoft Azure behavior
- Training data: Recharts API, TanStack Table features, fuse.js API
- Training data: Vercel Hobby plan limits — verify current values at vercel.com/pricing

### Tertiary (LOW confidence)
- Specific version numbers for packages not yet installed — verify with `npm info` before installation
- Recharts 2.x + React 19 compatibility — check before committing to this library

---
*Research completed: 2026-03-02*
*Ready for roadmap: yes*
