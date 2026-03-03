# Stack Research

**Domain:** Bowling league statistics website (data-heavy, read-focused, sports stats)
**Researched:** 2026-03-02
**Confidence:** MEDIUM (web search/doc verification unavailable; versions verified from package.json and training data)

> **ARCHITECTURAL OVERRIDE (2026-03-02):** This research was written before the **static hybrid** decision. The stack is the same but the usage pattern has changed:
> - **mssql connection pool** is used at build time only, not during visitor requests
> - **Server Components** render at build time (static generation), not at request time
> - **Search** uses a pre-built JSON index with fuse.js client-side, not a live `/api/search` endpoint
> - References to "Server Component data fetching at request time" and "connection pool per serverless function" reflect the OLD architecture

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Next.js | 16.1.6 (installed) | Full-stack React framework | Already installed. App Router with Server Components is ideal for a read-heavy stats site -- data fetching happens on the server, pages can be statically generated or ISR'd, and API routes live in the same codebase. No separate backend needed. | HIGH |
| React | 19.2.3 (installed) | UI library | Already installed. React 19 brings Server Components as a first-class feature, `use()` hook for promises, and improved streaming -- all directly useful for rendering stat-heavy pages quickly. | HIGH |
| Tailwind CSS | 4.x (installed) | Utility-first CSS | Already installed. v4 uses a CSS-first config model (`@theme` blocks in CSS instead of `tailwind.config.js`). Ideal for the bold Metrograph-inspired typography system -- custom fonts, colors, and spacing defined directly in globals.css. | HIGH |
| TypeScript | 5.x (installed) | Type safety | Already installed. Essential for a data-heavy app -- typed database result sets prevent runtime errors when mapping SQL columns to UI components. | HIGH |
| mssql | ^11 | Azure SQL Database connector | The standard Node.js package for SQL Server/Azure SQL. Uses tedious driver underneath. Built-in connection pooling. The only serious option for connecting Next.js to Azure SQL. | MEDIUM |
| Recharts | ^2.15 | Data visualization (charts) | React-native charting library built on D3. Declarative API matches React paradigms. Supports line charts (average progression), bar charts (season comparison), area charts, and responsive containers out of the box. Simpler than raw D3, more React-idiomatic than Chart.js. | MEDIUM |

### Database Layer

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| mssql | ^11 | SQL Server / Azure SQL client | Only real option for Azure SQL from Node.js. Handles connection pooling via `ConnectionPool`. Supports prepared statements, transactions, and streaming. Critical pattern: create ONE global pool, reuse across all requests. | MEDIUM |
| @types/mssql | ^9 | TypeScript types for mssql | Required for type safety when writing database queries. Type your result sets for autocomplete and compile-time checks. | LOW |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-table | ^8 | Headless table logic | Every stats page. Provides sorting, filtering, pagination, and column visibility without opinionated UI. You bring the Tailwind markup, it handles the data logic. Essential for leaderboards, season-by-season tables, game logs. | MEDIUM |
| fuse.js | ^7 | Client-side fuzzy search | Bowler search bar. Lightweight (no server dependency), handles misspellings and partial matches. Load bowler name list on the client, search instantly. For 619 bowlers, client-side is faster than a server round trip. | MEDIUM |
| clsx | ^2 | Conditional class names | Everywhere in the component layer. Tiny utility for combining Tailwind classes conditionally. Cleaner than template literal gymnastics. | HIGH |
| tailwind-merge | ^2 | Merge conflicting Tailwind classes | Component library building. Resolves class conflicts when composing components (e.g., a default `text-sm` that gets overridden with `text-lg`). Pair with clsx via a `cn()` utility function. | HIGH |
| next/font | built-in | Font optimization | Font loading for the Metrograph-inspired design. Use `next/font/google` for display fonts or `next/font/local` for custom font files. Automatically self-hosts fonts, eliminates layout shift. | HIGH |
| recharts | ^2.15 | Charts and visualizations | Bowler profile average progression (LineChart), season comparisons (BarChart), stat distributions (AreaChart). Wraps D3 with a declarative React API. | MEDIUM |
| date-fns | ^4 | Date formatting | Season dates, schedule display, blog post timestamps. Tree-shakeable (only import what you use), unlike Moment.js. | MEDIUM |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint | Linting | Already configured via eslint-config-next. Add strict TypeScript rules. |
| Prettier | Code formatting | Add with Tailwind plugin (`prettier-plugin-tailwindcss`) to auto-sort utility classes. |
| prettier-plugin-tailwindcss | Sort Tailwind classes | Consistent class ordering across all files. Reduces merge conflicts. |

## Installation

```bash
# Database
npm install mssql

# Data visualization
npm install recharts

# Tables (headless)
npm install @tanstack/react-table

# Search
npm install fuse.js

# Utilities
npm install clsx tailwind-merge date-fns

# Dev dependencies
npm install -D @types/mssql prettier prettier-plugin-tailwindcss
```

## Key Architecture Patterns

### 1. mssql Connection Pooling (CRITICAL)

The single most important pattern for the entire project. Get this wrong and you will have connection leaks, cold start failures, and intermittent 500 errors on Vercel.

```typescript
// src/lib/db.ts
import sql from 'mssql';

const config: sql.config = {
  server: process.env.AZURE_SQL_SERVER!,
  database: process.env.AZURE_SQL_DATABASE!,
  user: process.env.AZURE_SQL_USER!,
  password: process.env.AZURE_SQL_PASSWORD!,
  options: {
    encrypt: true,               // Required for Azure SQL
    trustServerCertificate: false,
    connectTimeout: 60000,       // 60s for cold start wake-up
    requestTimeout: 30000,
  },
  pool: {
    max: 10,      // Vercel serverless: keep low
    min: 0,       // Allow pool to fully drain
    idleTimeoutMillis: 30000,
  },
};

// Singleton pool pattern -- critical for serverless
let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = new sql.ConnectionPool(config);
    pool.on('error', (err) => {
      console.error('SQL Pool Error:', err);
      pool = null; // Force reconnection on next call
    });
    await pool.connect();
  }
  return pool;
}

// Convenience helper for queries
export async function query<T>(
  queryString: string,
  params?: Record<string, unknown>
): Promise<sql.IResult<T>> {
  const p = await getPool();
  const request = p.request();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }
  return request.query(queryString);
}
```

**Why this pattern matters:**
- Vercel serverless functions can be warm or cold. The singleton ensures you reuse connections across warm invocations.
- `pool.max: 10` prevents overwhelming Azure SQL free tier (which has limited concurrent connections).
- `connectTimeout: 60000` accommodates Azure SQL auto-pause wake-up (documented 30-60s).
- Error handler nulls the pool so the next request creates a fresh one rather than using a broken connection.

### 2. Server Components for Data Fetching

Next.js App Router Server Components should be the default for every stats page. Data fetches at the component level, no client-side loading spinners for initial page load.

```typescript
// src/app/bowler/[slug]/page.tsx
import { query } from '@/lib/db';
import { BowlerProfile } from '@/components/bowler/BowlerProfile';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BowlerPage({ params }: PageProps) {
  const { slug } = await params;

  const result = await query<BowlerRow>(
    'SELECT * FROM bowlers WHERE slug = @slug',
    { slug }
  );

  if (result.recordset.length === 0) {
    notFound();
  }

  const bowler = result.recordset[0];

  // Fetch stats in parallel
  const [seasons, records] = await Promise.all([
    query<SeasonRow>('SELECT ... FROM scores WHERE bowlerId = @id', { id: bowler.bowlerId }),
    query<RecordRow>('SELECT ... personal records query ...', { id: bowler.bowlerId }),
  ]);

  return (
    <BowlerProfile
      bowler={bowler}
      seasons={seasons.recordset}
      records={records.recordset}
    />
  );
}
```

**Key principles:**
- Server Components fetch data directly -- no API routes needed for read operations.
- Use `Promise.all()` for parallel queries (bowler stats, season data, records all at once).
- Reserve API routes for client-side interactions (search autocomplete, dynamic filtering).
- Use `loading.tsx` for streaming/Suspense boundaries on slow queries.

### 3. Tailwind Design System for Metrograph Aesthetic

Define the design tokens in `globals.css` using Tailwind v4's `@theme` block:

```css
@import "tailwindcss";

@theme {
  /* Splitzkrieg Palette */
  --color-cream: #F5F0E8;
  --color-navy: #1B2A4A;
  --color-red: #C23B22;
  --color-gold: #D4A843;
  --color-slate: #64748B;

  /* Typography Scale - Bold & Dramatic */
  --font-display: 'DM Serif Display', serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Spacing for data-dense layouts */
  --spacing-table-cell: 0.625rem;
}
```

**Font choices rationale:**
- **DM Serif Display** -- Free Google Font, high contrast serif with dramatic weight. Perfect for the Metrograph bold-headline aesthetic. Use for page titles, bowler names, big stat numbers.
- **Inter** -- The standard body font for data-heavy interfaces. Excellent tabular number support (`font-variant-numeric: tabular-nums`), highly legible at small sizes in stat tables.
- **JetBrains Mono** -- For score displays and numeric data where monospace alignment matters.

### 4. Recharts Configuration for Stats Visualization

```typescript
// Average progression chart (the key bowler profile visualization)
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Use ResponsiveContainer wrapper always -- never hardcode width
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={seasonAverages}>
    <XAxis dataKey="season" />
    <YAxis domain={['auto', 'auto']} />
    <Tooltip />
    <Line
      type="monotone"
      dataKey="average"
      stroke="#1B2A4A"  // navy
      strokeWidth={2}
      dot={{ fill: '#C23B22' }}  // red dots
    />
  </LineChart>
</ResponsiveContainer>
```

**Recharts is the right choice because:**
- Declarative React API -- components, not imperative D3 code.
- `ResponsiveContainer` handles mobile/desktop automatically.
- Built-in tooltip, legend, and animation.
- For this project's charts (line charts, bar charts, maybe area charts), Recharts covers everything needed without the complexity of D3 or Nivo.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Recharts | D3.js | Only if you need highly custom visualizations not achievable with Recharts (e.g., radial stat charts, custom animated transitions). D3 is much more code for standard chart types. |
| Recharts | Nivo | If you want more chart types out of the box (waffle, radar, sankey). Heavier bundle, but richer variety. Not needed for bowling stats. |
| Recharts | Victory | Similar level of abstraction. Recharts has a larger community and better docs. |
| @tanstack/react-table | AG Grid | If you needed editable grids (admin score entry). For read-only stats tables, TanStack Table is lighter and more flexible with Tailwind. |
| @tanstack/react-table | Native HTML tables | For simple tables with < 10 rows and no sorting/filtering. Use native tables for the bowler personal records panel. Use TanStack for leaderboards and game logs. |
| fuse.js | Algolia / Meilisearch | If search needs to scale beyond ~5000 items or needs typo tolerance + faceting. Overkill for 619 bowlers. Fuse.js works entirely client-side with zero infrastructure. |
| fuse.js | Server-side SQL LIKE | Falls back gracefully but no fuzzy matching. Consider as a fallback for very slow connections. |
| date-fns | dayjs | Similar size, similar API. date-fns is more tree-shakeable and has better TypeScript support. Either works fine. |
| mssql | Prisma + SQL Server | Prisma adds an ORM layer. For a read-heavy stats site with complex SQL (rolling averages, window functions, CTEs), writing raw SQL with mssql is faster to develop and gives better query control. Prisma's SQL Server support is also less mature than its PostgreSQL support. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Prisma (for this project) | Azure SQL free tier has limited connections; Prisma's connection management adds overhead. Complex stats queries (CTEs, window functions, CROSS APPLY) are painful in Prisma's query builder. You already know T-SQL. | Raw mssql with typed result sets |
| Drizzle ORM | Same issues as Prisma but less mature SQL Server support. The schema is already designed and deployed -- an ORM adds a migration layer you do not need. | Raw mssql |
| Moment.js | Deprecated, massive bundle size (300KB+). | date-fns (~20KB tree-shaken) |
| Chart.js / react-chartjs-2 | Canvas-based (not SVG), harder to style with Tailwind, less React-idiomatic. Requires a wrapper library. | Recharts (SVG, native React components) |
| styled-components / Emotion | CSS-in-JS runtime adds bundle weight and complexity. Tailwind v4 handles everything needed for this design system. | Tailwind CSS v4 |
| next-auth / Auth.js | No user authentication needed for the public stats site (Phases 1-5). When Phase 6 admin tools arrive, evaluate then. Do not add auth infrastructure before it is needed. | Nothing for now |
| SWR / React Query (TanStack Query) | Server Components handle data fetching for initial page loads. Client-side fetching libraries are only needed for interactive features like search-as-you-type. Do not add until you have a concrete client-side fetching need. | Server Components + native fetch for most pages |
| Zustand / Redux / Jotai | This is primarily a read-only stats display site. There is almost no client-side state to manage. URL params + Server Components handle everything. | URL search params + Server Components |

## Stack Patterns

**For read-only stats pages (90% of the site):**
- Server Components fetch data directly from Azure SQL
- No API routes, no client-side state, no loading spinners
- Use `generateStaticParams` + ISR (revalidate every hour) for bowler profiles

**For interactive features (search, filters, sort):**
- Client Component with `"use client"` directive
- Fuse.js for search, TanStack Table for sortable/filterable tables
- API route only if the interaction needs server-side data (e.g., `/api/search` for typeahead with large datasets)

**For data visualization:**
- Recharts in a Client Component (charts require browser APIs)
- Pass data from Server Component parent to Client Component chart child
- Always wrap in `ResponsiveContainer` for mobile

**For the Metrograph design system:**
- Tailwind v4 `@theme` in globals.css for all design tokens
- `next/font/google` for DM Serif Display + Inter
- `cn()` utility combining clsx + tailwind-merge for component styling
- Cream background (`bg-cream`), navy text (`text-navy`), red accents (`text-red`)

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 16.1.6 | React 19.2.3 | Already installed together, confirmed compatible |
| Tailwind CSS 4.x | Next.js 16.x | Already working together via @tailwindcss/postcss |
| mssql ^11 | Node.js 18+ | Verify mssql 11 supports the Node.js version Vercel uses (should be 18 or 20) |
| Recharts ^2.15 | React 19 | LOW confidence -- verify Recharts 2.x works with React 19. If not, check for a v3 beta or use a different charting library. This is the highest-risk compatibility item. |
| @tanstack/react-table ^8 | React 19 | TanStack libraries generally support React 19 early. MEDIUM confidence. |
| fuse.js ^7 | Any (no React dependency) | Pure JS library, no framework compatibility concerns |

## Environment Variables

```env
# .env.local (never commit)
AZURE_SQL_SERVER=splitzkrieg-sql.database.windows.net
AZURE_SQL_DATABASE=SplitzkriegDB
AZURE_SQL_USER=<admin_username>
AZURE_SQL_PASSWORD=<admin_password>
```

These must also be set in Vercel project settings for production deployment.

## Sources

- package.json (installed) -- Next.js 16.1.6, React 19.2.3, Tailwind 4.x versions confirmed
- splitzkrieg-infra-reference.md -- Azure SQL connection details, mssql package requirement
- splitzkrieg-site-plan.md -- Architecture diagram, tech stack decisions
- PROJECT.md -- Constraints, database schema details, design requirements
- Training data (May 2025 cutoff) -- mssql patterns, Recharts API, TanStack Table features, Tailwind v4 config model. LOW-MEDIUM confidence on specific version numbers for packages not yet installed.

## Verification Needed Before Installation

The following should be verified with `npm info` or official docs before installing:

1. **Recharts + React 19 compatibility** -- Most critical. If Recharts 2.x does not support React 19, check for a newer version or consider Nivo as fallback.
2. **mssql latest version** -- Confirm ^11 is current and supports Node.js 20 (Vercel's default runtime).
3. **@types/mssql alignment** -- Ensure types package matches the mssql major version.
4. **@tanstack/react-table + React 19** -- Likely fine but worth confirming.

---
*Stack research for: Splitzkrieg Bowling League Stats Website*
*Researched: 2026-03-02*
