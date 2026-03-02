# Architecture Research

**Domain:** Stats-driven bowling league website (read-heavy, multi-entity, data visualization)
**Researched:** 2026-03-02
**Confidence:** HIGH (Next.js 16 official docs verified, schema analyzed, infrastructure constraints known)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Server Comps │  │ Client Comps │  │  Layouts &   │             │
│  │ (pages,      │  │ (charts,     │  │  Navigation  │             │
│  │  stat cards, │  │  search,     │  │  (shared     │             │
│  │  tables)     │  │  filters)    │  │   shell)     │             │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘             │
│         │                 │                                        │
├─────────┴─────────────────┴────────────────────────────────────────┤
│                         DATA ACCESS LAYER                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  lib/db/queries/  — cached query functions (React.cache)     │  │
│  │  lib/db/pool.ts   — singleton connection pool                │  │
│  └──────────────────────────────┬───────────────────────────────┘  │
│                                 │                                  │
├─────────────────────────────────┴──────────────────────────────────┤
│                         DATA STORE                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Azure SQL Database (serverless, auto-pause)                 │  │
│  │  14 tables, 2 views, computed columns on scores              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Route Pages (Server) | Fetch data, render HTML, pass serializable props to client | Async Server Components in `app/` directory |
| Interactive Widgets (Client) | Charts, search input, filter controls, tab switching | `'use client'` components in `src/components/` |
| Layouts | Shared navigation, footer, theme provider | Server Components with client interactivity slots |
| Data Access Layer | SQL queries, connection management, request memoization | `lib/db/` module with `React.cache` wrappers |
| Connection Pool | Singleton mssql pool, cold-start handling | `lib/db/pool.ts` with global variable pattern |
| API Routes | On-demand revalidation webhook, search endpoint | `app/api/` Route Handlers |

## Recommended Project Structure

```
src/
├── app/                           # Next.js App Router
│   ├── layout.tsx                 # Root layout (nav, footer, theme)
│   ├── page.tsx                   # Home page
│   ├── loading.tsx                # Root loading skeleton
│   ├── error.tsx                  # Root error boundary
│   ├── not-found.tsx              # 404 page
│   │
│   ├── bowlers/
│   │   ├── page.tsx               # Bowler directory / search results
│   │   ├── loading.tsx            # Bowler list skeleton
│   │   └── [slug]/
│   │       ├── page.tsx           # Bowler profile (the centerpiece)
│   │       └── loading.tsx        # Profile skeleton
│   │
│   ├── teams/
│   │   ├── page.tsx               # Team directory
│   │   └── [slug]/
│   │       ├── page.tsx           # Team profile
│   │       └── loading.tsx
│   │
│   ├── seasons/
│   │   ├── page.tsx               # Season list
│   │   └── [romanNumeral]/
│   │       ├── page.tsx           # Season detail (standings, results)
│   │       └── loading.tsx
│   │
│   ├── leaderboards/
│   │   └── page.tsx               # All-time leaderboards (with filters)
│   │
│   ├── champions/
│   │   └── page.tsx               # Championships and awards
│   │
│   ├── blog/
│   │   ├── page.tsx               # Blog index
│   │   └── [slug]/
│   │       └── page.tsx           # Blog post
│   │
│   ├── about/
│   │   └── page.tsx               # About / Join page
│   │
│   └── api/
│       ├── revalidate/
│       │   └── route.ts           # On-demand revalidation endpoint
│       └── search/
│           └── route.ts           # Search API (bowler name typeahead)
│
├── components/                    # Shared UI components
│   ├── ui/                        # Generic design system atoms
│   │   ├── stat-card.tsx          # Single stat display (server-safe)
│   │   ├── data-table.tsx         # Sortable/filterable table (client)
│   │   ├── skeleton.tsx           # Loading skeleton primitives
│   │   └── page-header.tsx        # Page title + breadcrumb
│   │
│   ├── charts/                    # Recharts wrappers (all client)
│   │   ├── average-progression.tsx
│   │   ├── season-comparison.tsx
│   │   └── chart-wrapper.tsx      # Shared Recharts config + responsive
│   │
│   ├── bowler/                    # Bowler-specific composites
│   │   ├── career-stats.tsx       # Career stat cards (server)
│   │   ├── season-table.tsx       # Season-by-season table (server)
│   │   └── profile-header.tsx     # Name, active status, years (server)
│   │
│   ├── team/                      # Team-specific composites
│   │   ├── roster.tsx
│   │   └── team-header.tsx
│   │
│   ├── search/                    # Search components
│   │   └── bowler-search.tsx      # Typeahead search (client)
│   │
│   └── layout/                    # Shell components
│       ├── nav.tsx                # Main navigation
│       ├── footer.tsx
│       └── cold-start-banner.tsx  # "Waking up database..." indicator
│
├── lib/                           # Non-React utilities
│   ├── db/
│   │   ├── pool.ts               # mssql connection pool singleton
│   │   ├── queries/
│   │   │   ├── bowlers.ts         # Bowler queries (cached)
│   │   │   ├── teams.ts           # Team queries (cached)
│   │   │   ├── seasons.ts        # Season queries (cached)
│   │   │   ├── scores.ts         # Score/stats queries (cached)
│   │   │   ├── leaderboards.ts   # Leaderboard aggregations (cached)
│   │   │   └── search.ts         # Search queries
│   │   └── types.ts              # TypeScript types matching DB schema
│   │
│   ├── utils/
│   │   ├── format.ts             # Number formatting, Roman numerals
│   │   └── constants.ts          # League constants (225 base, etc.)
│   │
│   └── config.ts                 # Environment variable validation
│
└── styles/
    └── globals.css                # Tailwind directives + custom vars
```

### Structure Rationale

- **`app/` routes mirror entity hierarchy:** Bowlers, teams, and seasons are the three core entities. Each gets a top-level route with slug-based detail pages. This maps directly to the database structure (bowlers.slug, teams.slug, seasons.romanNumeral).
- **`components/` organized by domain then function:** Bowler-specific composites live under `components/bowler/`, reusable atoms under `components/ui/`. Charts are isolated because they all require `'use client'` and Recharts.
- **`lib/db/queries/` as the single data access layer:** Every database query lives here, wrapped in `React.cache()` for request-level deduplication. No SQL in page components. This is the most critical architectural boundary.
- **`loading.tsx` at every data-fetching route:** Azure SQL cold starts (30-60s) make loading states mandatory, not optional. Every route with DB access needs a skeleton.

## Architectural Patterns

### Pattern 1: Server Component Data Fetching with React.cache

**What:** All database queries are defined as cached async functions in `lib/db/queries/`. Page components import and `await` these functions directly. React.cache ensures the same query called multiple times in one render pass only executes once.

**When to use:** Every page that reads from the database (which is all of them).

**Trade-offs:** Simple, no API layer needed. Queries are co-located with their types. The tradeoff is that these functions are server-only and cannot be called from client components.

**Example:**
```typescript
// lib/db/queries/bowlers.ts
import 'server-only'
import { cache } from 'react'
import { getPool } from '../pool'

export const getBowlerBySlug = cache(async (slug: string) => {
  const pool = await getPool()
  const result = await pool.request()
    .input('slug', slug)
    .query(`
      SELECT * FROM vw_BowlerCareerSummary
      WHERE slug = @slug AND isPublic = 1
    `)
  return result.recordset[0] ?? null
})

export const getBowlerSeasons = cache(async (bowlerID: number) => {
  const pool = await getPool()
  const result = await pool.request()
    .input('bowlerID', bowlerID)
    .query(`
      SELECT * FROM vw_BowlerSeasonStats
      WHERE bowlerID = @bowlerID
      ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
    `)
  return result.recordset
})
```

### Pattern 2: Singleton Connection Pool with Cold-Start Handling

**What:** A single mssql connection pool instance is stored in a module-level variable (with a `globalThis` fallback for dev hot-reload). The pool creation is lazy -- it connects on first use. A wrapper handles the Azure SQL auto-pause wake-up by retrying on initial connection failure.

**When to use:** Always. This is the only way to connect to the database.

**Trade-offs:** Module-level singletons work well in serverless (Vercel) because each function instance gets its own pool. The pool is small (2-5 connections) since Azure SQL free tier has limited resources. Cold starts are handled gracefully with retry logic.

**Example:**
```typescript
// lib/db/pool.ts
import 'server-only'
import sql from 'mssql'

const config: sql.config = {
  server: process.env.DB_SERVER!,
  database: process.env.DB_NAME!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  options: {
    encrypt: true,              // Required for Azure SQL
    trustServerCertificate: false,
  },
  pool: {
    max: 5,                     // Small pool for serverless
    min: 0,                     // Allow pool to drain
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 60000,     // 60s for Azure SQL cold start
  requestTimeout: 30000,
}

// Singleton pattern that survives HMR in development
const globalPool = globalThis as typeof globalThis & {
  __mssqlPool?: Promise<sql.ConnectionPool>
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!globalPool.__mssqlPool) {
    globalPool.__mssqlPool = new sql.ConnectionPool(config).connect()
  }
  return globalPool.__mssqlPool
}
```

### Pattern 3: Server Components for Data, Client Components for Interaction

**What:** Pages and stat displays are Server Components that fetch data and render HTML. Charts, search inputs, filter controls, and sortable tables are Client Components that receive pre-fetched data as serializable props.

**When to use:** The decision boundary is simple: if the component needs `useState`, `useEffect`, event handlers, or browser APIs, it is a Client Component. Everything else is a Server Component.

**Trade-offs:** Minimizes client-side JavaScript bundle. Most of this site is read-only stats display -- Server Components are ideal. The only Client Components are Recharts charts, the search typeahead, leaderboard filters, and sortable tables.

**Example:**
```typescript
// app/bowlers/[slug]/page.tsx — Server Component
import { getBowlerBySlug, getBowlerSeasons } from '@/lib/db/queries/bowlers'
import { getBowlerScores } from '@/lib/db/queries/scores'
import { ProfileHeader } from '@/components/bowler/profile-header'
import { CareerStats } from '@/components/bowler/career-stats'
import { SeasonTable } from '@/components/bowler/season-table'
import { AverageProgression } from '@/components/charts/average-progression'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

export default async function BowlerPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const bowler = await getBowlerBySlug(slug)
  if (!bowler) notFound()

  const seasons = await getBowlerSeasons(bowler.bowlerID)

  return (
    <div>
      <ProfileHeader bowler={bowler} />
      <CareerStats bowler={bowler} />
      <SeasonTable seasons={seasons} />
      <Suspense fallback={<div>Loading chart...</div>}>
        <AverageProgressionLoader bowlerID={bowler.bowlerID} />
      </Suspense>
    </div>
  )
}

// Separate async component for chart data, streamed in
async function AverageProgressionLoader({ bowlerID }: { bowlerID: number }) {
  const scores = await getBowlerScores(bowlerID)
  // AverageProgression is 'use client' — receives plain data as props
  return <AverageProgression data={scores} />
}
```

### Pattern 4: Static Generation with ISR for Entity Pages

**What:** Bowler and team profile pages use `generateStaticParams` to pre-render the most active bowlers/teams at build time. Remaining pages are generated on-demand and cached. A revalidation period of 3600s (1 hour) keeps data reasonably fresh without overwhelming the free-tier database.

**When to use:** All entity detail pages (bowlers, teams, seasons). These pages change infrequently (scores updated every ~2 weeks).

**Trade-offs:** Static pages serve instantly from Vercel's edge CDN. The 1-hour revalidation window means data is at most 1 hour stale after a manual sync -- perfectly acceptable for a league that updates biweekly. On-demand revalidation via API route handles immediate freshness after data syncs.

**Example:**
```typescript
// app/bowlers/[slug]/page.tsx additions
export const revalidate = 3600  // Revalidate every hour

export async function generateStaticParams() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT slug FROM bowlers WHERE isActive = 1 AND isPublic = 1
  `)
  return result.recordset.map((b) => ({ slug: b.slug }))
}
```

### Pattern 5: Graceful Cold-Start UX

**What:** Azure SQL's serverless auto-pause means the first request after idle takes 30-60 seconds. The architecture handles this at three levels: (1) connection timeout set to 60s, (2) loading.tsx skeletons at every route, (3) optional client-side "waking up" indicator.

**When to use:** This is not optional. Every user-facing data path must handle the cold start scenario.

**Trade-offs:** Users see a skeleton for 30-60s on cold starts vs. an error page. The alternative (keeping DB warm with a cron) burns vCore seconds on the free tier. Since this is a low-traffic league site, cold starts are acceptable with good UX.

## Data Flow

### Read Flow (95% of traffic)

```
Browser navigates to /bowlers/russ-smith
    |
    v
Vercel Edge: Check Full Route Cache
    |
    ├── HIT: Return cached HTML + RSC payload instantly
    |
    └── MISS: Forward to serverless function
              |
              v
         Server Component renders:
           1. getBowlerBySlug('russ-smith')  ─── React.cache dedup
           2. getBowlerSeasons(42)           ─── React.cache dedup
              |
              v
         lib/db/pool.ts: getPool()
           ├── Pool exists: reuse connection
           └── Pool empty: connect to Azure SQL
               ├── DB awake: ~100ms
               └── DB paused: 30-60s (cold start)
              |
              v
         SQL query via parameterized mssql request
              |
              v
         Server Component renders HTML
         Client Components hydrate (charts only)
              |
              v
         Response cached in Full Route Cache (revalidate: 3600)
         RSC Payload cached in Router Cache (client)
```

### Search Flow

```
User types in search bar (Client Component)
    |
    v
Debounced fetch to /api/search?q=russ  (300ms debounce)
    |
    v
Route Handler queries:
  SELECT bowlerName, slug FROM bowlers
  WHERE bowlerName LIKE @q + '%' OR slug LIKE @q + '%'
  ORDER BY isActive DESC, bowlerName
  OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
    |
    v
JSON response (not cached — dynamic, user-specific input)
    |
    v
Client renders dropdown results
```

### Revalidation Flow (after manual data sync)

```
Admin triggers revalidation (POST /api/revalidate with secret)
    |
    v
Route Handler calls:
  revalidatePath('/bowlers/[slug]', 'page')   // All bowler pages
  revalidatePath('/teams/[slug]', 'page')     // All team pages
  revalidatePath('/seasons/[romanNumeral]')   // All season pages
  revalidatePath('/leaderboards')             // Leaderboards
    |
    v
Next request for any of these paths triggers fresh render
```

### Key Data Flows

1. **Bowler Profile (the centerpiece):** Page fetches from vw_BowlerCareerSummary (header stats) and vw_BowlerSeasonStats (season table) as parallel queries. Chart data loads in a separate Suspense boundary so the page shell renders immediately.

2. **Leaderboards:** Page fetches aggregated stats from scores table with GROUP BY and ORDER BY. Filter parameters (gender, active status, season range) come from searchParams, making this a dynamic route. Consider caching the most common filter combinations.

3. **Season Detail:** Fetches standings (team points aggregated from matchResults), weekly schedule, and division alignment. Multiple related queries can run in parallel with Promise.all.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-200 users (current) | ISR with 1-hour revalidation. Azure SQL free tier. Single connection pool. Cold starts accepted. |
| 200-2K users | Same architecture. Cold starts become rare due to consistent traffic keeping DB awake. May need to increase pool.max to 10. |
| 2K+ users | Upgrade Azure SQL to provisioned tier (always-on). Add Redis or Vercel KV for search caching. Pre-render all bowler pages at build time. |

### Scaling Priorities

1. **First bottleneck: Azure SQL cold starts.** At higher traffic this solves itself (DB stays warm). If it becomes a problem before traffic grows, add a Vercel Cron to ping the DB every 5 minutes.
2. **Second bottleneck: Leaderboard queries.** Complex aggregations on 22K+ scores rows. If slow, pre-compute into a materialized view or dedicated leaderboard table, refreshed on data sync.

## Anti-Patterns

### Anti-Pattern 1: Fetching Data in Client Components

**What people do:** Use `useEffect` + `fetch` to load data in client components, or create API routes for every data need.
**Why it's wrong:** Adds unnecessary client-side JavaScript, creates loading waterfalls, exposes data shaping to the client, and loses the benefit of server-side rendering and caching.
**Do this instead:** Fetch in Server Components, pass serializable data as props to Client Components. Only use API routes for truly interactive operations (search typeahead, on-demand revalidation).

### Anti-Pattern 2: SQL in Page Components

**What people do:** Write SQL queries directly inside `page.tsx` files.
**Why it's wrong:** Scatters data access logic across dozens of files. Makes queries impossible to test, reuse, or optimize independently. Changes to table structure require touching every page.
**Do this instead:** All SQL lives in `lib/db/queries/`. Page components import and call query functions. The data access layer is the single boundary between UI and database.

### Anti-Pattern 3: Creating a New Connection Pool Per Request

**What people do:** Call `new sql.ConnectionPool(config).connect()` inside each query function.
**Why it's wrong:** On Azure SQL serverless, each new connection triggers authentication. In serverless functions, the module scope persists between invocations but function scope does not -- so pools created inside functions are lost.
**Do this instead:** Use the singleton pattern with `globalThis` for HMR safety. One pool per serverless function instance.

### Anti-Pattern 4: Making Everything Dynamic

**What people do:** Use `searchParams`, `cookies()`, or `headers()` on pages that don't need them, accidentally opting out of static generation.
**Why it's wrong:** Every page becomes dynamically rendered, meaning every request hits Azure SQL. For a low-traffic site on a free-tier database, this wastes vCore seconds and creates poor TTFB.
**Do this instead:** Default to static/ISR. Only the leaderboards page (which has filter searchParams) and search API truly need to be dynamic. Profile pages are static with ISR revalidation.

### Anti-Pattern 5: Giant Client Components

**What people do:** Mark an entire page or large section as `'use client'` because one small part needs interactivity.
**Why it's wrong:** The entire component tree below that boundary ships to the client as JavaScript, even parts that could have been server-rendered.
**Do this instead:** Push `'use client'` to the leaf components. The bowler profile page is a Server Component. Only the `<AverageProgression>` chart inside it is a Client Component.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Azure SQL Database | mssql npm package via connection pool singleton | Parameterized queries only. 60s connection timeout for cold starts. Encrypt required. |
| Vercel Hosting | Next.js App Router on Vercel | Push-to-deploy from GitHub. Free tier. Edge caching via ISR. |
| Vercel Cron (future) | Optional keep-alive ping or scheduled revalidation | If cold starts become a UX problem. Not needed at launch. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Pages <-> Data Access Layer | Direct function import | Server-only. `lib/db/queries/` exports cached async functions. |
| Server Components <-> Client Components | Serializable props (no functions, no classes) | Data flows down only. Client components never fetch from DB. |
| Client Components <-> API Routes | HTTP fetch (search, revalidation) | Only for truly interactive needs. Minimal API surface. |
| Data Access Layer <-> Connection Pool | `getPool()` returns Promise<ConnectionPool> | Single pool instance per serverless function lifetime. |

## Build Order (Dependencies)

The architecture has clear dependency layers that dictate build order:

1. **Foundation (build first):** `lib/db/pool.ts`, `lib/db/types.ts`, `lib/config.ts` -- the connection pool and type definitions. Everything depends on this.

2. **Data Access Layer:** `lib/db/queries/*` -- query functions for each entity. Depends on pool and types. Can be built and tested independently of UI.

3. **Design System / UI Atoms:** `components/ui/*` -- stat cards, skeletons, tables, page headers. Pure presentation, no data dependencies. Can be built in parallel with data layer.

4. **Entity Pages (in priority order):**
   - Bowler profile (`/bowlers/[slug]`) -- the centerpiece, depends on bowler queries + UI atoms + chart components
   - Home page -- depends on season queries + search component
   - Team profile (`/teams/[slug]`) -- depends on team queries + UI atoms
   - Season detail (`/seasons/[romanNumeral]`) -- depends on season/score queries
   - Leaderboards -- depends on leaderboard queries + filter UI (client)
   - Champions page -- depends on champion queries (data not yet loaded)

5. **Interactive Features:** Search typeahead, chart components, sortable tables. These are Client Components that can be built in parallel with pages, then integrated.

6. **Operational:** Revalidation API route, error boundaries, 404 pages.

## Sources

- Next.js 16.1.6 official documentation: Server and Client Components (https://nextjs.org/docs/app/getting-started/server-and-client-components) -- verified 2026-02-27
- Next.js 16.1.6 official documentation: Caching (https://nextjs.org/docs/app/guides/caching) -- verified 2026-02-27
- Next.js 16.1.6 official documentation: Fetching Data (https://nextjs.org/docs/app/getting-started/fetching-data) -- verified 2026-02-27
- Splitzkrieg database schema: `docs/splitzkrieg-schema.sql` -- 14 tables, 2 views, computed columns
- Splitzkrieg infrastructure reference: `docs/splitzkrieg-infra-reference.md` -- Azure SQL serverless config
- mssql npm package connection pooling: Based on training data (MEDIUM confidence). Pool singleton pattern is well-established for Node.js SQL Server connections. Verify `pool.max`, `connectionTimeout`, and `globalThis` pattern against current mssql docs during implementation.

---
*Architecture research for: Splitzkrieg Bowling League stats site*
*Researched: 2026-03-02*
