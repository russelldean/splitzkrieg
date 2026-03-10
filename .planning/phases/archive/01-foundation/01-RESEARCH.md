# Phase 1: Foundation - Research

**Researched:** 2026-03-02
**Domain:** Next.js static site generation, Azure SQL build-time data fetching, Tailwind CSS v4 design system, on-demand revalidation
**Confidence:** HIGH

## Summary

Phase 1 establishes the static hybrid foundation: a Next.js 16 App Router site that fetches all data from Azure SQL at build time, pre-renders every page as static HTML, and serves visitors with zero database round-trips. The design system (cream/navy/red Metrograph-inspired palette with DM Serif Display + Inter typography) is implemented via Tailwind CSS v4's `@theme` directive. A pre-built search index (JSON file generated at build time from bowler names) enables client-side fuzzy search without live database queries. An on-demand revalidation API route triggers static regeneration after biweekly data syncs.

The stack is well-established and thoroughly documented. Next.js 16.1.6 (already installed) supports `generateStaticParams` for build-time static generation, `revalidatePath`/`revalidateTag` for on-demand ISR, and `next/font/google` for self-hosted font optimization. Tailwind CSS v4 (already installed) uses CSS-first `@theme` blocks for design tokens. The `mssql` npm package (v12.x) handles Azure SQL connections with configurable pool/timeout settings. Fuse.js (v7.1.0) provides lightweight client-side fuzzy search with zero dependencies.

**Primary recommendation:** Build a `src/lib/db.ts` module that creates and reuses a connection pool with 120s timeout and exponential retry logic for Azure SQL cold starts, then use it in `generateStaticParams` and page-level server component data fetching at build time. Define all design tokens in `globals.css` via `@theme inline`. Create a revalidation API route at `/api/revalidate` protected by a secret token.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Warm cream background with crisp navy and punchy red accent -- editorial feel, somewhere between vintage and modern
- No dark mode -- the warm cream palette IS the brand. One cohesive look.
- Typography: DM Serif Display for headings, Inter for body. Confident but restrained -- moderate heading sizes, mixed case, editorial newspaper feel. Let the data breathe.
- User has existing logo files and will add them to the repo. Use text-based "SPLITZKRIEG" in heading font as placeholder until logo files arrive.
- Top bar with integrated search: Logo left, search bar center (always visible from every page), nav links right
- Top-level nav links: Bowlers, Teams, Seasons, Leaderboards (always visible)
- Footer: Secondary nav links (About, Rules, Blog, Join) plus league info. "Since 2007" branding.
- Mobile: Hamburger menu for nav links, search bar stays prominent
- Static hybrid architecture: all public pages are pre-rendered at build time. Azure SQL only wakes during builds and admin work -- visitors never hit the database.
- Azure SQL cold starts (30-60s) are a build-time concern only. Build process must handle retries/timeouts gracefully.
- On-demand revalidation: after biweekly data syncs, trigger rebuild so fresh stats deploy as new static pages.
- Pre-built search index: bowler names baked into a JSON file at build time for instant client-side search (no live DB query needed).

### Claude's Discretion
- Loading animation style for client-side page transitions (route changes within the SPA). Must match warm cream palette -- not generic gray bars. Keep light and fast.
- Max width, content density, whitespace, grid system. General direction: Editorial feel -- not cramped data tables, not wasteful whitespace. The data should be the star but presented cleanly.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Static site generation with on-demand revalidation after data syncs | `generateStaticParams` + `dynamicParams = false` for build-time SSG; `revalidatePath` in API route handler for on-demand ISR |
| INFRA-02 | Build-time data fetching from Azure SQL (serverless free tier) | `mssql` v12.x with 120s connection timeout, exponential retry, connection pool; direct DB queries in `generateStaticParams` and server components |
| INFRA-03 | Pre-built search index for client-side bowler search (619 bowlers) | Build-time script or route handler generates JSON; Fuse.js v7.1.0 for client-side fuzzy search |
| INFRA-04 | Build/revalidation pipeline triggered after data updates | API route at `/api/revalidate` with secret token auth; calls `revalidatePath('/')` to trigger full-site regeneration |
| INFRA-05 | Design system tokens defined (cream/navy/red palette, bold typography, DM Serif Display + Inter) | Tailwind v4 `@theme inline` block in globals.css; `next/font/google` for DM_Serif_Display + Inter with CSS variables |
| XCUT-02 | Mobile-responsive layout (tables scroll/reflow, charts resize) | Tailwind responsive utilities (sm/md/lg breakpoints); mobile-first approach; hamburger nav below md breakpoint |
| XCUT-03 | Graceful handling of missing data (empty tables, sparse historical records) | Null-safe rendering patterns; empty state components; conditional rendering for sparse data |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.6 | Framework (App Router, SSG, ISR, API routes) | Already installed; `generateStaticParams` + `revalidatePath` are the official SSG/ISR primitives |
| react | 19.2.3 | UI rendering | Already installed; required by Next.js 16 |
| tailwindcss | 4.x | Utility-first CSS with `@theme` design tokens | Already installed; CSS-first `@theme` replaces JS config, generates utilities from CSS variables |
| mssql | 12.x | Azure SQL connection (build-time only) | Standard Node.js MSSQL driver; 1,454 commits, actively maintained; TypeScript types via `@types/mssql` |
| fuse.js | 7.1.0 | Client-side fuzzy search | Zero dependencies, 3,403 dependents; handles fuzzy matching and name variants for 619 bowlers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/mssql | latest | TypeScript definitions for mssql | Always -- project uses strict TypeScript |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| mssql (direct) | Prisma ORM | Prisma adds abstraction layer; mssql is simpler for read-only build-time queries on an existing schema. User decision: `mssql` is locked in PROJECT.md |
| Fuse.js | FlexSearch, MiniSearch | FlexSearch is faster for large datasets but heavier setup; 619 bowlers is small enough that Fuse.js is ideal |
| Tailwind @theme | CSS Modules, Styled Components | @theme is already the project pattern (Tailwind v4 installed); generates utilities automatically |

**Installation:**
```bash
npm install mssql fuse.js
npm install -D @types/mssql
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── layout.tsx              # Root layout (fonts, nav shell, footer)
│   ├── globals.css             # @theme inline tokens, base styles
│   ├── page.tsx                # Home page (placeholder for Phase 3)
│   ├── api/
│   │   └── revalidate/
│   │       └── route.ts        # On-demand revalidation endpoint
│   └── bowler/
│       └── [slug]/
│           └── page.tsx        # Future bowler pages (Phase 2)
├── components/
│   ├── layout/
│   │   ├── Header.tsx          # Top bar: logo, search, nav links
│   │   ├── Footer.tsx          # Secondary nav, league info
│   │   ├── MobileNav.tsx       # Hamburger menu (client component)
│   │   └── SearchBar.tsx       # Client-side search with Fuse.js
│   └── ui/
│       ├── EmptyState.tsx      # Graceful empty/missing data display
│       └── PageTransition.tsx  # Route change loading indicator
├── lib/
│   ├── db.ts                   # Azure SQL connection pool + retry logic
│   ├── queries.ts              # Named SQL query functions
│   └── search-index.ts         # Build-time search index generation
└── data/
    └── search-index.json       # Generated at build time (gitignored)
```

### Pattern 1: Build-Time Database Connection with Retry
**What:** Singleton connection pool with exponential backoff for Azure SQL cold starts
**When to use:** Every `generateStaticParams` and server component data fetch during `next build`
**Example:**
```typescript
// src/lib/db.ts
import sql from 'mssql';

const config: sql.config = {
  server: process.env.AZURE_SQL_SERVER!,
  database: process.env.AZURE_SQL_DATABASE!,
  user: process.env.AZURE_SQL_USER!,
  password: process.env.AZURE_SQL_PASSWORD!,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectionTimeout: 120000,  // 120s for Azure SQL cold start
    requestTimeout: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getDb(): Promise<sql.ConnectionPool> {
  if (pool) return pool;

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      pool = await new sql.ConnectionPool(config).connect();
      return pool;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.min(5000 * Math.pow(2, attempt - 1), 60000);
      console.log(`DB connection attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Failed to connect to database');
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}
```
**Source:** [Microsoft Azure SQL retry guidance](https://learn.microsoft.com/en-us/answers/questions/865431/prevent-timeout-when-connecting-to-paused-azure-sq), [mssql npm docs](https://github.com/tediousjs/node-mssql)

### Pattern 2: Static Generation with generateStaticParams
**What:** Pre-render all dynamic routes at build time using database queries
**When to use:** Every dynamic route (bowler pages, team pages, season pages in future phases)
**Example:**
```typescript
// src/app/bowler/[slug]/page.tsx
import { getDb } from '@/lib/db';

export const dynamicParams = false; // 404 for unknown slugs

export async function generateStaticParams() {
  const db = await getDb();
  const result = await db.request().query(
    `SELECT LOWER(REPLACE(firstName + '-' + lastName, ' ', '-')) as slug
     FROM bowlers WHERE isActive = 1`
  );
  return result.recordset.map((row) => ({ slug: row.slug }));
}

export default async function BowlerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Fetch bowler data at build time
  const db = await getDb();
  const result = await db.request()
    .input('slug', slug)
    .query(`SELECT * FROM bowlers WHERE ...`);
  // Render static HTML
}
```
**Source:** [Next.js generateStaticParams docs (v16.1.6)](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)

### Pattern 3: On-Demand Revalidation Route Handler
**What:** API endpoint that triggers cache invalidation after data syncs
**When to use:** Called by webhook or manually after biweekly Google Sheets data sync
**Example:**
```typescript
// src/app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
  }

  // Revalidate entire site (layout-level revalidation)
  revalidatePath('/', 'layout');

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
```
**Source:** [Next.js ISR guide (v16.1.6)](https://nextjs.org/docs/app/guides/incremental-static-regeneration)

**Note on revalidatePath behavior:** `revalidatePath` marks the path for revalidation but regeneration happens on the *next visit*, not immediately. The stale page is served while fresh content is generated in the background (stale-while-revalidate). For this project, this is acceptable since data changes biweekly and a brief stale window after revalidation trigger is fine.

### Pattern 4: Tailwind v4 @theme Design Tokens
**What:** CSS-first design token definition that generates utility classes
**When to use:** All color, font, and spacing tokens for the design system
**Example:**
```css
/* src/app/globals.css */
@import "tailwindcss";

:root {
  --font-dm-serif: 'DM Serif Display', serif;
  --font-inter: 'Inter', sans-serif;
}

@theme inline {
  /* Colors */
  --color-cream: #FAF7F2;
  --color-cream-dark: #F0EBE3;
  --color-navy: #1B2A4A;
  --color-navy-light: #2D4470;
  --color-red: #C53030;
  --color-red-light: #E53E3E;

  /* Typography */
  --font-heading: var(--font-dm-serif);
  --font-body: var(--font-inter);

  /* Backgrounds */
  --color-background: var(--color-cream);
  --color-foreground: var(--color-navy);
}
```
This generates utilities like `bg-cream`, `text-navy`, `font-heading`, `font-body`, `text-red`, etc.

**Source:** [Tailwind CSS v4 Theme docs](https://tailwindcss.com/docs/theme)

### Pattern 5: Font Setup with next/font/google + Tailwind v4
**What:** Self-hosted Google Fonts with CSS variable integration into Tailwind
**When to use:** Root layout font configuration
**Example:**
```typescript
// src/app/layout.tsx
import { DM_Serif_Display, Inter } from 'next/font/google';

const dmSerif = DM_Serif_Display({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-dm-serif',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSerif.variable} ${inter.variable}`}>
      <body className="bg-cream text-navy font-body">
        {/* Header, main, footer */}
        {children}
      </body>
    </html>
  );
}
```
**Key detail:** Use `variable` option (not `className`) so fonts are exposed as CSS custom properties, which `@theme inline` references. `DM_Serif_Display` is NOT a variable font -- the `weight: '400'` parameter is required.

**Source:** [Next.js Font Optimization (v16.1.6)](https://nextjs.org/docs/app/getting-started/fonts)

### Pattern 6: Pre-Built Search Index
**What:** Generate a JSON file of bowler names at build time for client-side search
**When to use:** Build step that runs before/during `next build`
**Example:**
```typescript
// src/lib/search-index.ts
import { getDb } from './db';
import { writeFileSync } from 'fs';
import { join } from 'path';

export interface SearchEntry {
  id: number;
  name: string;
  slug: string;
  seasonsActive: number;
}

export async function generateSearchIndex(): Promise<SearchEntry[]> {
  const db = await getDb();
  const result = await db.request().query(`
    SELECT bowlerID as id,
           firstName + ' ' + lastName as name,
           LOWER(REPLACE(firstName + '-' + lastName, ' ', '-')) as slug,
           COUNT(DISTINCT seasonID) as seasonsActive
    FROM bowlers b
    JOIN rosterEntries r ON b.bowlerID = r.bowlerID
    GROUP BY b.bowlerID, firstName, lastName
  `);
  return result.recordset;
}
```
The index can be written to `public/search-index.json` during build or generated via a static API route. Fuse.js then loads it client-side.

### Anti-Patterns to Avoid
- **Runtime database queries in page components:** Server components that query Azure SQL at request time will hit the sleeping database and cause 30-60s delays for visitors. All data fetching MUST happen at build time via `generateStaticParams` or static server component rendering.
- **Using `output: 'export'` instead of default build mode:** Static export (`output: 'export'`) disables ISR, API routes, and middleware. The project needs on-demand revalidation (INFRA-04), which requires the default Node.js build output deployed to Vercel.
- **Putting mssql in client bundle:** The `mssql` package is server-only. Never import it in client components or files that could be bundled for the browser. Keep all DB code in `src/lib/` and only call from server components / `generateStaticParams`.
- **Dark mode CSS variables:** The existing `globals.css` has a `prefers-color-scheme: dark` media query from the create-next-app template. This must be removed -- no dark mode per user decision.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy search | Custom string matching | Fuse.js | Handles typos, partial matches, name variants (619 bowlers); zero dependencies, < 10KB |
| SQL connection pooling | Manual connection management | mssql ConnectionPool | Handles pool lifecycle, idle timeout, concurrent request queuing |
| Font optimization | Manual font loading/preloading | next/font/google | Self-hosts fonts, eliminates CLS, no external network requests |
| CSS design tokens | Custom CSS variable setup | Tailwind @theme | Automatically generates utility classes from token definitions |
| Cold start retry | Simple setTimeout loop | Exponential backoff pattern | Microsoft recommends 5s initial delay with exponential growth up to 60s for Azure SQL serverless |

**Key insight:** This phase is mostly "wiring" -- connecting existing, well-documented tools together. The complexity is in the Azure SQL cold start handling and getting the Tailwind v4 `@theme` + `next/font` integration right. No custom algorithms needed.

## Common Pitfalls

### Pitfall 1: Azure SQL Cold Start Timeout
**What goes wrong:** Build fails because default connection timeout (15s) is shorter than Azure SQL serverless wake time (30-60s).
**Why it happens:** Azure SQL free tier auto-pauses after inactivity. First connection triggers a resume that takes 30-60 seconds.
**How to avoid:** Set `connectionTimeout: 120000` (120s) in mssql config. Implement exponential retry with 3 attempts (5s, 10s, 20s delays). Microsoft recommends initial retry delay of at least 5 seconds.
**Warning signs:** Build works locally (always-warm DB) but fails in CI/CD; intermittent "connection timeout" errors.

### Pitfall 2: Tailwind v4 @theme vs @theme inline
**What goes wrong:** Font utilities like `font-heading` resolve to `var(--font-heading)` which in turn references `var(--font-dm-serif)` -- but the CSS variable isn't available in the right scope, causing the font to not apply.
**Why it happens:** Standard `@theme` generates utility classes that reference `var(--font-heading)`. If `--font-heading` is defined as `var(--font-dm-serif)`, you get a variable referencing a variable, which can break in certain scopes.
**How to avoid:** Use `@theme inline` -- this makes utilities use the *value* directly instead of the CSS variable reference. So `font-heading` resolves directly to the font stack, not to `var(--font-heading)`.
**Warning signs:** Font appears in browser devtools CSS but doesn't visually render; computed style shows `var(--font-heading)` instead of actual font name.

### Pitfall 3: DM Serif Display is NOT a Variable Font
**What goes wrong:** Import without specifying `weight` causes build error or missing font.
**Why it happens:** Next.js `next/font/google` requires a `weight` option for non-variable fonts. DM Serif Display only has weight 400 (regular) and 400 italic.
**How to avoid:** Always specify `weight: '400'` when importing DM_Serif_Display. Inter IS a variable font and doesn't need weight specified.
**Warning signs:** Build error mentioning "Missing required `weight`" or font not loading.

### Pitfall 4: mssql in Client Bundle
**What goes wrong:** Build error or massive bundle size from Node.js-only `mssql` package being included in client JavaScript.
**Why it happens:** Importing `mssql` (directly or transitively) from a file that gets bundled for the browser. Even a shared utility file can cause this.
**How to avoid:** Keep all database code in `src/lib/db.ts` and `src/lib/queries.ts`. Only import these from server components, `generateStaticParams`, or API routes. Never from client components (`'use client'`).
**Warning signs:** Build warnings about Node.js modules (`net`, `tls`, `dns`) not being available in the browser.

### Pitfall 5: Forgetting dynamicParams = false
**What goes wrong:** Unrecognized slugs trigger server-side rendering at request time, hitting the sleeping Azure SQL database.
**Why it happens:** By default, `dynamicParams` is `true`, meaning Next.js will attempt to render unknown paths on-demand.
**How to avoid:** Export `dynamicParams = false` from every dynamic route page. Unknown paths return 404 immediately without touching the database.
**Warning signs:** Slow page loads for URLs not in the build; Azure SQL waking up during user visits.

### Pitfall 6: revalidatePath Does Not Eagerly Regenerate
**What goes wrong:** After calling the revalidation endpoint, content doesn't update immediately.
**Why it happens:** `revalidatePath` marks pages as stale but regeneration only happens on the next visitor request (stale-while-revalidate semantics).
**How to avoid:** This is expected behavior, not a bug. After triggering revalidation, the first visitor gets stale content while fresh content generates in the background. Subsequent visitors get fresh content. For biweekly data syncs, this is perfectly acceptable.
**Warning signs:** Operator calls revalidation endpoint and refreshes page but sees old data; second refresh shows new data.

### Pitfall 7: Remove Default Dark Mode and Geist Fonts
**What goes wrong:** Dark mode flickers on devices with dark system preference; Geist fonts render instead of DM Serif Display + Inter.
**Why it happens:** The create-next-app template includes `prefers-color-scheme: dark` CSS and Geist font imports.
**How to avoid:** Remove the dark mode media query from globals.css. Replace Geist font imports with DM_Serif_Display + Inter in layout.tsx.
**Warning signs:** Page briefly flashes dark background; headings render in sans-serif instead of serif font.

## Code Examples

### Environment Variables (.env.local)
```bash
# Azure SQL (used at build time and revalidation only)
AZURE_SQL_SERVER=splitzkrieg-sql.database.windows.net
AZURE_SQL_DATABASE=splitzkrieg
AZURE_SQL_USER=<from-azure-portal>
AZURE_SQL_PASSWORD=<from-azure-portal>

# Revalidation
REVALIDATION_SECRET=<generate-a-random-string>
```

### Mobile-Responsive Hamburger Navigation
```typescript
// src/components/layout/MobileNav.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

const NAV_LINKS = [
  { href: '/bowlers', label: 'Bowlers' },
  { href: '/teams', label: 'Teams' },
  { href: '/seasons', label: 'Seasons' },
  { href: '/leaderboards', label: 'Leaderboards' },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle navigation"
        className="p-2"
      >
        {/* Hamburger icon */}
      </button>
      {isOpen && (
        <nav className="absolute top-full left-0 right-0 bg-cream border-b border-navy/10">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-4 py-3 text-navy font-body hover:bg-cream-dark"
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
```

### Empty State Component (XCUT-03)
```typescript
// src/components/ui/EmptyState.tsx
interface EmptyStateProps {
  title: string;
  message?: string;
}

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className="py-12 text-center">
      <h3 className="font-heading text-lg text-navy/60">{title}</h3>
      {message && (
        <p className="mt-2 text-sm text-navy/40 font-body">{message}</p>
      )}
    </div>
  );
}
```

### Client-Side Search with Fuse.js
```typescript
// src/components/layout/SearchBar.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import type { SearchEntry } from '@/lib/search-index';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<SearchEntry[]>([]);

  useEffect(() => {
    fetch('/search-index.json')
      .then((res) => res.json())
      .then(setEntries);
  }, []);

  const fuse = useMemo(
    () => new Fuse(entries, { keys: ['name'], threshold: 0.3 }),
    [entries]
  );

  const results = query.length > 1 ? fuse.search(query, { limit: 8 }) : [];

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search bowlers..."
        className="w-full px-4 py-2 rounded-lg bg-white border border-navy/20
                   font-body text-navy placeholder:text-navy/40
                   focus:outline-none focus:ring-2 focus:ring-red/30"
      />
      {results.length > 0 && (
        <ul className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-navy/10 z-50">
          {results.map(({ item }) => (
            <li key={item.id}>
              <a
                href={`/bowler/${item.slug}`}
                className="block px-4 py-2 hover:bg-cream-dark font-body text-navy"
              >
                {item.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` (JavaScript) | `@theme` in CSS file | Tailwind v4 (Jan 2025) | No JS config needed; tokens defined in CSS; builds 5x faster |
| `getStaticProps` + `getStaticPaths` | `generateStaticParams` + server components | Next.js 13+ App Router | Data fetching happens in the component or `generateStaticParams`; no separate data-fetching functions |
| `next export` (full static) | `output: 'export'` or default build + ISR | Next.js 13+ | Default build supports ISR and API routes; `output: 'export'` is limited |
| `unstable_revalidate` | `revalidatePath` / `revalidateTag` | Next.js 13+ | Stable on-demand revalidation APIs |
| `@next/font` (separate package) | `next/font/google` (built-in) | Next.js 13.2+ | Font optimization is built into the framework |
| `params` as sync object | `params` as Promise (`await params`) | Next.js 15+ | `params` must be awaited in page components; breaking change from earlier versions |

**Deprecated/outdated:**
- `getStaticProps` / `getStaticPaths`: Pages Router only. App Router uses `generateStaticParams` + server component data fetching.
- `next export` command: Removed in Next.js 14. Use `output: 'export'` in next.config.ts (but we don't want this -- it disables ISR).
- `tailwind.config.js`: Still supported in Tailwind v4 but `@theme` is the primary approach for new projects.
- Geist fonts (create-next-app default): Must be replaced with DM Serif Display + Inter.

## Open Questions

1. **Search index generation timing**
   - What we know: The search index (JSON of bowler names) needs to exist before pages render client-side search. It can be generated as a static API route (`app/api/search-index/route.ts` with `generateStaticParams`) or written to `public/` during a pre-build script.
   - What's unclear: Whether generating it as part of `next build` (via a static route handler) or as a pre-build npm script is cleaner.
   - Recommendation: Use a static Route Handler at `/api/search-index` that queries the DB and returns JSON. This runs during `next build` automatically and the output is statically served. No extra build scripts needed.

2. **Vercel function region for Azure SQL latency**
   - What we know: Azure SQL is in North Central US. Vercel defaults to Washington, D.C. (iad1).
   - What's unclear: Whether build-time fetches are affected by region (likely not -- build happens once and latency is acceptable).
   - Recommendation: Set Vercel function region to `cle1` (Cleveland) or `iad1` (default) in `vercel.json` or project settings. This mainly matters for the revalidation API route, where the function re-fetches data from Azure SQL.

3. **Color exact values for cream/navy/red palette**
   - What we know: User wants "warm cream background with crisp navy and punchy red accent" inspired by Metrograph cinema website.
   - What's unclear: Exact hex/oklch values haven't been specified.
   - Recommendation: Start with the values in the code examples above (#FAF7F2 cream, #1B2A4A navy, #C53030 red) and adjust during implementation. These approximate a warm editorial feel.

## Sources

### Primary (HIGH confidence)
- [Next.js generateStaticParams docs (v16.1.6)](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) - SSG API, dynamicParams, params as Promise, return types
- [Next.js ISR guide (v16.1.6)](https://nextjs.org/docs/app/guides/incremental-static-regeneration) - revalidatePath, revalidateTag, on-demand revalidation patterns
- [Next.js Font Optimization (v16.1.6)](https://nextjs.org/docs/app/getting-started/fonts) - next/font/google, CSS variable approach, self-hosting
- [Tailwind CSS v4 Theme docs](https://tailwindcss.com/docs/theme) - @theme, @theme inline, namespace mapping, custom fonts/colors
- [mssql npm / GitHub](https://github.com/tediousjs/node-mssql) - v12.x, ConnectionPool config, Azure SQL settings

### Secondary (MEDIUM confidence)
- [Microsoft Azure SQL cold start guidance](https://learn.microsoft.com/en-us/answers/questions/865431/prevent-timeout-when-connecting-to-paused-azure-sq) - 120s timeout, 5s initial retry delay, exponential backoff
- [Azure SQL serverless tier overview](https://learn.microsoft.com/en-us/azure/azure-sql/database/serverless-tier-overview) - auto-pause behavior, wake time expectations
- [Fuse.js official site](https://www.fusejs.io/) - v7.1.0, API reference, fuzzy search configuration

### Tertiary (LOW confidence)
- Exact color values for Metrograph-inspired palette -- starting values are reasonable approximations but need visual tuning
- Vercel function region impact on build-time data fetching -- likely negligible but unverified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are well-documented, versions verified, APIs confirmed against official docs
- Architecture: HIGH - Patterns verified against Next.js 16.1.6 official documentation; Tailwind v4 @theme confirmed
- Pitfalls: HIGH - Azure SQL cold start behavior documented by Microsoft; Tailwind v4 @theme inline behavior verified; DM Serif Display non-variable font confirmed

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable stack, 30-day validity)
