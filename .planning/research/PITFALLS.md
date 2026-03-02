# Pitfalls Research

**Domain:** Bowling league stats website (Next.js + Azure SQL Serverless on Vercel)
**Researched:** 2026-03-02
**Confidence:** MEDIUM (training data only -- no web verification available; however these are well-established patterns across multiple documented sources in training data)

## Critical Pitfalls

### Pitfall 1: Azure SQL Serverless Auto-Pause Destroys First-Visit Experience

**What goes wrong:**
Azure SQL free-tier serverless auto-pauses after ~1 hour of inactivity. The first query after pause takes 30-60 seconds to wake the database. Combined with Vercel serverless function cold starts (1-3 seconds), the first visitor after an idle period waits 30-60+ seconds for any page with database content. For a bowling league site where someone clicks a link from a group chat, this is a terrible first impression -- they assume the site is broken and leave.

**Why it happens:**
The free tier auto-pause is non-negotiable (you are not paying for always-on). The mssql package's connection pool opens a new TCP connection to Azure SQL, which triggers the wake-up. There is no way to "pre-warm" the database from Vercel's serverless functions because they are stateless.

**How to avoid:**
1. Build a loading/skeleton UI that renders instantly via Server Components while the database wakes. Show the page shell (header, nav, empty card layouts) immediately.
2. Add a visible "Waking up the database..." indicator (not a spinner -- a message). League members will learn to expect this. Make it on-brand and fun ("Polishing the lanes...").
3. Use Next.js `loading.tsx` files in every route segment that hits the database. This is the App Router's built-in Suspense boundary mechanism.
4. Consider a lightweight cron/keep-alive ping (a simple scheduled fetch to a health endpoint every 50 minutes) ONLY if the cold start UX is truly intolerable after launch. This burns vCore seconds from your 100,000/month budget -- roughly 1,440 pings/day * ~0.5s each = ~720 vCore-seconds/day = ~21,600/month, leaving you ~78,400 for actual traffic. Viable but cuts your budget by ~22%.
5. For the most critical pages (bowler profiles, home page), consider static generation with ISR (Incremental Static Regeneration) so the page serves from cache and does not need the database at all for repeat visits.

**Warning signs:**
- Users complaining about "the site being down" when it is actually just waking
- Bounce rate spikes during low-traffic periods (mornings, mid-week)
- Vercel function timeout errors (default 10s on Hobby plan -- Azure wake can exceed this)

**Phase to address:**
Phase 1 (Foundation/Infrastructure). The database utility layer must handle this from day one. Every database call needs timeout handling and the UI needs skeleton states before any feature pages are built.

---

### Pitfall 2: mssql Connection Pool Leaks in Serverless Functions

**What goes wrong:**
The `mssql` npm package uses a connection pool (`ConnectionPool`). In a traditional Node.js server, you create one pool at startup and reuse it. In Vercel serverless functions, each invocation may or may not reuse the same execution context. If you create a new `ConnectionPool` on every function invocation, you leak connections until Azure SQL hits its connection limit (on the free tier, this is very low -- around 30 concurrent connections). The database starts rejecting connections and every request fails.

**Why it happens:**
Developers copy `mssql` examples from the docs (designed for long-running servers) into serverless functions without adapting the pattern. The serverless execution model is fundamentally different -- functions are ephemeral but sometimes reuse warm containers.

**How to avoid:**
Use the singleton pool pattern. Cache the pool promise in module scope so warm function invocations reuse the existing pool:

```typescript
// lib/db.ts
import sql from 'mssql';

const config: sql.config = {
  server: process.env.AZURE_SQL_SERVER!,
  database: process.env.AZURE_SQL_DATABASE!,
  user: process.env.AZURE_SQL_USER!,
  password: process.env.AZURE_SQL_PASSWORD!,
  options: {
    encrypt: true, // Required for Azure SQL
    trustServerCertificate: false,
  },
  pool: {
    max: 5,        // LOW -- serverless should not hog connections
    min: 0,        // Allow pool to drain completely
    idleTimeoutMillis: 10000, // Release idle connections fast
  },
  requestTimeout: 30000,     // 30s to handle Azure wake-up
  connectionTimeout: 30000,  // 30s for initial connection (Azure wake)
};

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .catch((err) => {
        poolPromise = null; // Reset on failure so next call retries
        throw err;
      });
  }
  return poolPromise;
}
```

Key settings: `pool.max: 5` (not the default 10), `pool.min: 0`, short `idleTimeoutMillis`. The `connectionTimeout` and `requestTimeout` must be at least 30s to survive Azure auto-pause wake-ups.

**Warning signs:**
- Intermittent "connection pool exhausted" errors in Vercel function logs
- Azure SQL portal showing connection count climbing over time
- Errors that appear under load but not during development

**Phase to address:**
Phase 1 (Foundation). This must be the very first thing built -- a `lib/db.ts` utility that every database-touching feature imports. Get this wrong early and every feature inherits the problem.

---

### Pitfall 3: Vercel Hobby Plan Function Timeout vs Azure Wake Time

**What goes wrong:**
Vercel Hobby plan serverless functions have a 10-second execution timeout (as of training data -- verify current limits). Azure SQL serverless wake-up takes 30-60 seconds. 10 < 30. Every cold database query will timeout on Vercel Hobby plan if you use standard serverless functions.

**Why it happens:**
The timeout limit is per-function-execution, and Azure SQL wake-up is a blocking operation that happens during the connection phase.

**How to avoid:**
1. **Use Next.js Server Components (not API routes) for data fetching.** Server Components in Next.js on Vercel have a longer execution timeout than standalone serverless functions (60 seconds for streaming responses on Hobby plan, vs 10s for API routes). This is the primary mitigation.
2. **ISR/Static Generation for key pages.** Pages that can tolerate stale data (bowler profiles, historical seasons, leaderboards) should use `revalidate` so they serve from cache and only rebuild in the background. The rebuild can take 30-60s without the user waiting.
3. **Streaming with Suspense.** Wrap database-dependent content in Suspense boundaries so the page shell streams immediately and the data fills in when the database responds.
4. **For API routes that must exist** (search, admin operations), implement retry logic with exponential backoff and ensure the client-side handles loading states gracefully.

**Warning signs:**
- `FUNCTION_INVOCATION_TIMEOUT` errors in Vercel deployment logs
- Pages that work in local dev (where the database is already warm) but fail in production
- Intermittent failures that correlate with time-of-day (low traffic = cold database)

**Phase to address:**
Phase 1 (Foundation). Architecture decision: prefer Server Components with Suspense over API routes for all read operations.

---

### Pitfall 4: Rendering 22,000+ Score Rows on the Client

**What goes wrong:**
A bowler who has been in the league since Season I could have 800+ individual score rows. An "all-time leaderboard" page could attempt to render thousands of rows. Recharts (the chosen charting library) can struggle with 500+ data points. If you fetch all data and render it client-side, you get: slow initial page load, janky scrolling, high memory usage on mobile, and Recharts SVG rendering that takes seconds.

**Why it happens:**
During development, you test with a few bowlers or one season. In production, the full dataset is 10-100x larger. The difference between "works in dev" and "works in prod" is dramatic for data-heavy sites.

**How to avoid:**
1. **Server-side pagination and aggregation.** Never send raw score rows to the client for display. SQL Server is excellent at aggregation -- compute averages, totals, and rankings in SQL, not JavaScript.
2. **For charts (Recharts), limit data points.** A bowler's average-over-time chart should show season averages (max 35 points), not weekly averages (potentially 800+ points). If weekly granularity is needed, paginate by season and let the user select which season to zoom into.
3. **For tables, use server-side pagination.** Leaderboards should fetch 25-50 rows at a time with offset/limit. Use `ROW_NUMBER() OVER(...)` in SQL Server for efficient pagination.
4. **Virtualized tables only as a last resort.** Libraries like TanStack Virtual add complexity. For a bowling stats site with reasonable pagination, standard HTML tables with server pagination are simpler and more accessible.
5. **For Recharts specifically:** Use `isAnimationActive={false}` for charts with more than ~100 data points. Animation on large datasets is the primary performance killer.

**Warning signs:**
- Page load times exceeding 3 seconds on mobile
- Browser DevTools showing 5MB+ JavaScript bundles
- Recharts charts taking visible time to render/animate
- Lighthouse performance score below 50

**Phase to address:**
Phase 2 (Bowler Profiles) and Phase 3 (Leaderboards/Stats). Establish the pagination pattern in Phase 2 with the bowler profile (season-by-season table), then reuse it for leaderboards.

---

### Pitfall 5: Server Components vs Client Components Boundary Confusion

**What goes wrong:**
With Next.js App Router, the default is Server Components. Developers add `"use client"` too aggressively (making entire pages client components) or not aggressively enough (trying to use hooks or event handlers in server components and getting cryptic errors). The worst pattern: making a page-level `"use client"` component that fetches data via `useEffect` -- this throws away all the benefits of Server Components and creates a loading waterfall.

**Why it happens:**
The mental model is genuinely new. Most React tutorials and patterns from pre-App Router are client-component-first. Developers default to what they know.

**How to avoid:**
1. **Rule: Data fetching happens in Server Components. Interactivity happens in Client Components.** The page-level component (`page.tsx`) should almost always be a Server Component that fetches data and passes it as props to Client Components.
2. **Push `"use client"` as far down the tree as possible.** A sortable table: the page fetches data (Server Component), passes it to `<SortableTable data={data} />` (Client Component). Not the whole page.
3. **Pattern for this project:**
   - `page.tsx` (Server Component): fetches bowler data from database
   - `<BowlerStatsChart data={chartData} />` (Client Component): renders Recharts chart
   - `<StatsTable data={tableData} />` (Client Component): renders sortable/filterable table
4. **Never import a Server Component into a Client Component.** This is a common mistake. If a Client Component needs to render Server Component content, use the `children` prop pattern.

**Warning signs:**
- Every `page.tsx` has `"use client"` at the top
- `useEffect` calls that fetch data on mount (client-side waterfall)
- Hydration mismatch errors in console
- Unexpectedly large JavaScript bundles (server data-fetching code leaking to client)

**Phase to address:**
Phase 1 (Foundation). Establish the pattern with the first page built. Create example components that demonstrate the correct boundary.

---

### Pitfall 6: Exposing Database Credentials in Client Bundle

**What goes wrong:**
Environment variables in Next.js are only available server-side unless prefixed with `NEXT_PUBLIC_`. However, if you accidentally import `lib/db.ts` (which contains `process.env.AZURE_SQL_PASSWORD`) into a Client Component, the bundler may attempt to include it in the client bundle. With the `mssql` package, this also fails at build time because `mssql` depends on Node.js-only modules (`net`, `tls`, `crypto`). But the error messages are confusing -- you get "Module not found: Can't resolve 'net'" rather than "you imported a server module into a client component."

**Why it happens:**
Import chains. You import a utility that imports another utility that imports `lib/db.ts`. The dependency is indirect and easy to miss.

**How to avoid:**
1. **Add `import 'server-only'` at the top of `lib/db.ts` and any server-only utility file.** This package causes a build-time error with a clear message if the file is ever imported into a client component.
2. **Organize files clearly:** `lib/db.ts` (server-only), `lib/queries/` (server-only), `components/` (can be either). Never put database imports in files under `components/`.
3. **Use `server-only` package:** `npm install server-only` and add the import to every file that touches the database or uses server-only APIs.

**Warning signs:**
- Build errors mentioning `net`, `tls`, `dns`, or `crypto` modules
- Client bundle size unexpectedly large
- Environment variables appearing in browser DevTools network tab

**Phase to address:**
Phase 1 (Foundation). Install `server-only` package and establish the file organization convention immediately.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inline SQL strings in page components | Fast to prototype | Unmaintainable, SQL injection risk if interpolating, impossible to test queries independently | Never -- create a `lib/queries/` layer from the start |
| Skipping loading.tsx files | Pages render faster in dev (DB is warm) | Broken UX in production when DB is cold | Never -- every route with DB access needs a loading state |
| Fetching all data and filtering in JS | Avoids writing complex SQL | Performance cliff at scale, wastes bandwidth, slow on mobile | Only for datasets under ~50 rows that are already fetched |
| Using `any` types for SQL query results | Faster development | Runtime type errors, no autocomplete, maintenance nightmare | MVP only, with a TODO to add proper types within same phase |
| Storing computed stats in state instead of SQL | Simpler component logic | Drift between displayed values and database truth, recalculation bugs | Never -- SQL Server computed columns already handle this |
| Hardcoding season/bowler IDs in queries | Quick prototyping | Breaks when new data arrives, impossible to maintain | Never -- always parameterize |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Azure SQL + mssql | Using `sql.connect()` global connection (deprecated pattern) | Use `ConnectionPool` with singleton promise pattern (see Pitfall 2) |
| Azure SQL + mssql | Not setting `encrypt: true` in connection options | Azure SQL requires encrypted connections. Always set `options: { encrypt: true }` |
| Azure SQL + mssql | Using string interpolation in queries (`SELECT * FROM bowlers WHERE id = ${id}`) | Always use parameterized queries: `request.input('id', sql.Int, id)` then `request.query('SELECT * FROM bowlers WHERE bowlerID = @id')` |
| Azure SQL free tier | Assuming always-on availability | Build every data path to handle 30-60s cold start gracefully |
| Vercel + Azure SQL | Assuming same-region latency | Azure is in North Central US. Vercel deploys to multiple regions by default. Set Vercel's function region to `cle1` (Cleveland) or `iad1` (Washington DC) -- the closest to North Central US -- to minimize latency. Do NOT leave it as default (San Francisco) |
| Vercel + environment variables | Setting env vars only in `.env.local` | Must also set them in Vercel dashboard for production. `.env.local` is gitignored and not deployed |
| Recharts + Next.js | Importing Recharts in a Server Component | Recharts requires `"use client"`. Always create a wrapper Client Component for charts |
| Tailwind v4 + Next.js | Using `tailwind.config.js` (v3 pattern) | Tailwind v4 uses CSS-based configuration. Config is in the CSS file, not JavaScript |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 queries for bowler profiles | Each bowler profile page makes 5+ separate SQL queries (bio, scores, records, teams, chart data) | Write a single stored procedure or CTE-based query that returns all profile data in one round-trip | Noticeable at any scale due to Azure SQL latency per query (~50-100ms each) |
| Unindexed queries on scores table | Leaderboard pages take 5+ seconds | Ensure indexes exist on `(seasonID, bowlerID)`, `(bowlerID)`, `(seasonID, weekNum)` on the scores table. Verify with `SET STATISTICS IO ON` | With 22,817 rows, even now. Will be worse as data grows |
| Full table scans for "all-time" stats | "All-time high game" query scans entire scores table | Create indexed views or materialized aggregations for common all-time queries. SQL Server indexed views are powerful for this | Already at 22K rows -- will grow ~2K/year |
| Large JSON payloads from Server Components | Browser receives 500KB+ of serialized props | Return only the data needed for display. Select specific columns, not `SELECT *`. Aggregate in SQL, not JS | Over 100KB of props passed to client components |
| Recharts re-rendering on every state change | Charts flicker or lag when filters change | Memoize chart data with `useMemo`. Use `React.memo` on chart wrapper components. Disable animation for large datasets | Any chart with >50 data points and interactive filters |
| Missing `key` props on dynamic lists | React re-renders entire lists instead of diffing | Always use stable keys (bowlerID, seasonID) -- never array index | Any list over ~20 items |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| SQL injection via string concatenation | Full database access -- attacker can read/modify/delete all data | Use parameterized queries exclusively. The `mssql` package's `request.input()` method handles escaping. Never use template literals for SQL |
| Database credentials in client-accessible code | Credentials leaked, database compromised | Use `server-only` package, keep all DB code in server-only files, never prefix DB env vars with `NEXT_PUBLIC_` |
| Admin routes without authentication | Anyone can submit scores, modify data | Even though admin tools are Phase 6, plan the auth boundary now. Use Next.js middleware to protect `/admin/*` routes |
| Exposing internal IDs in URLs without validation | Enumeration attacks, accessing other users' data | Validate all URL parameters are integers, check they reference existing records. Use slugs (bowler name slugs) for public URLs instead of raw database IDs |
| No rate limiting on search/API endpoints | Denial of service, database overload (especially bad with Azure SQL free tier vCore budget) | Implement basic rate limiting via Vercel's Edge Middleware or headers. Even simple IP-based throttling helps |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw NULL/missing data as blank cells | Bowlers see empty spots and think the site is broken | Display "N/A", "--", or "No data" with tooltips explaining why (e.g., "Playoff data not yet loaded") |
| Presenting all 35 seasons equally on bowler profiles | Information overload, most bowlers only care about recent seasons | Default to last 5 seasons, with "Show all seasons" expand. Most recent season at top |
| Using Roman numerals everywhere (Season XXXIV) | Casual bowlers cannot parse Roman numerals quickly | Display as "Fall 2025 (XXXIV)" -- calendar date primary, Roman numeral secondary for tradition |
| Tiny, dense stat tables on mobile | Unreadable on phones, which is how most league members will access the site from the bowling alley | Card-based layout on mobile, table on desktop. Priority: show the 3-4 most important stats prominently, details in expandable sections |
| No empty state for unpopulated tables | Pages for matchResults, playoffResults, seasonChampions show blank/error | Design empty states: "Championship data coming soon" with relevant context |
| Showing zero-score games without context | Bowlers see "0, 0, 0" and are confused | Flag potential data quality issues visually (different color, footnote). The 4 known zero-score rows need either confirmation or removal |
| Average progression chart without context | A line going up or down means nothing without reference points | Add league average line for comparison. Show season boundaries. Label notable events (COVID season, expansion to 20 teams) |
| Search returning too many results for common names | "Mike" returns 15 results with no way to distinguish | Show team name and most recent season alongside bowler name in search results |

## "Looks Done But Isn't" Checklist

- [ ] **Database connection:** Often missing retry logic for Azure wake-up -- verify connection works after 2+ hours of inactivity
- [ ] **Bowler profiles:** Often missing handling for bowlers with very few games (1-2 games total) -- verify chart and averages display sensibly
- [ ] **Leaderboards:** Often missing the "minimum games" filter -- verify you require 9+ games for ranking (per league rules)
- [ ] **Season pages:** Often missing handling for Season XXV (COVID DNF) -- verify it displays appropriately, not as a broken/empty season
- [ ] **Search:** Often missing handling for alternate names -- verify searching "Leo Deluca" finds "Leo DeLuca" (BowlerID 407)
- [ ] **Mobile layout:** Often missing testing on actual phones -- verify tables scroll horizontally, not break layout
- [ ] **Handicap display:** Often missing the floor operation -- verify handicap values match computed columns exactly (225 base / 95% / FLOOR, not ROUND)
- [ ] **Penalty rows:** Often missing filtering in aggregates -- verify penalty rows (isPenalty=1) do not pollute scratch averages
- [ ] **Gender filter on leaderboards:** Often missing handling for the 21 bowlers with NULL gender -- verify they appear in "All" filter but not in "M" or "F"
- [ ] **Franchise history:** Often missing team name continuity -- verify "Bowl Derek" shows history from its "Gutter Despair" era

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Connection pool leaks | LOW | Fix singleton pattern in `lib/db.ts`, redeploy. No data loss |
| SQL injection vulnerability | HIGH | Audit all queries, fix to parameterized, assess if data was compromised, potentially restore from backup |
| Wrong Server/Client Component boundary | MEDIUM | Refactor affected pages. Mostly mechanical but tedious if many pages are wrong |
| Missing loading states | LOW | Add `loading.tsx` files to route segments. Can be done incrementally |
| Client-side data overload | MEDIUM | Add server-side pagination. Requires query changes + UI pagination component. Each page is independent work |
| Vercel function region mismatch | LOW | Change region in `vercel.json` or dashboard, redeploy. Instant latency improvement |
| Exposed credentials | HIGH | Rotate credentials immediately, audit access logs, fix code, redeploy |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Azure SQL cold start UX | Phase 1 (Foundation) | Load site after 2h idle -- skeleton UI shows within 1s, data fills within 60s |
| Connection pool singleton | Phase 1 (Foundation) | Load test with 10 concurrent requests -- no pool exhaustion errors |
| Vercel timeout vs Azure wake | Phase 1 (Foundation) | Verify Server Components stream successfully during cold DB start |
| Vercel function region | Phase 1 (Foundation) | Check Vercel dashboard shows function region near North Central US |
| Server/Client boundary | Phase 1 (Foundation) | No `"use client"` on page.tsx files. All data fetching in Server Components |
| server-only guard | Phase 1 (Foundation) | Intentionally import db.ts in a client component -- build should fail with clear error |
| SQL injection prevention | Phase 1 (Foundation) | Code review: zero string interpolation in SQL queries |
| Data rendering performance | Phase 2 (Bowler Profiles) | Bowler with 800+ scores loads profile in under 3s on 3G throttled connection |
| Missing data display | Phase 2 (Bowler Profiles) | Check profiles with: few games, NULL gender, penalty rows, alternate names |
| Table pagination | Phase 3 (Leaderboards) | All-time leaderboard paginates, does not dump 619 bowlers at once |
| Mobile responsiveness | Phase 2 (Bowler Profiles) | Test on 375px width -- all content readable, no horizontal page scroll |
| Search with alternate names | Phase 2 (Search) | Search "Leo Deluca" returns Leo DeLuca. Search "Katie" returns Katie O'Brien |
| Empty table states | Phase 3 (Season/Team Pages) | Navigate to playoff bracket -- shows "coming soon", not blank/error |
| Auth boundary for admin | Phase 1 (Foundation) | `/admin` routes return 401 without auth, even if admin features are not built yet |
| Free tier budget monitoring | Phase 1 (Foundation) | Set up Azure cost alert at 80% of vCore budget. Monitor in first month of production |

## Sources

- Training data knowledge of mssql npm package connection pooling patterns (MEDIUM confidence -- well-documented across npm docs, GitHub issues, blog posts)
- Training data knowledge of Next.js App Router Server/Client Component patterns (MEDIUM confidence -- extensively documented in Next.js official docs)
- Training data knowledge of Azure SQL serverless auto-pause behavior (MEDIUM confidence -- documented in Microsoft Azure docs)
- Training data knowledge of Vercel Hobby plan limits (LOW confidence -- limits change frequently, verify current values at vercel.com/pricing)
- Project-specific data from `splitzkrieg-data-quality-report.md` and `splitzkrieg-infra-reference.md` (HIGH confidence -- first-party project documentation)
- Training data knowledge of Recharts performance characteristics (MEDIUM confidence -- common community knowledge)

**Note:** Web search and web fetch tools were unavailable during this research. All technical claims are from training data and should be verified against current documentation, particularly:
- Vercel Hobby plan function timeout (claimed 10s for API routes, 60s for streaming -- verify)
- Azure SQL free tier connection limits (claimed ~30 concurrent -- verify in Azure portal)
- Tailwind v4 configuration approach (claimed CSS-based, not JS-based -- verify)
- Next.js 16 specific behaviors (project uses Next.js 16.1.6 which is very recent -- verify any App Router specifics have not changed)

---
*Pitfalls research for: Splitzkrieg Bowling League Stats Website*
*Researched: 2026-03-02*
