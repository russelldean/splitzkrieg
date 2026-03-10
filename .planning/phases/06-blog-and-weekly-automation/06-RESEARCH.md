# Phase 6: Blog and Weekly Automation - Research

**Researched:** 2026-03-10
**Domain:** MDX blog infrastructure, email automation (Resend), publish gate, weekly pipeline
**Confidence:** HIGH

## Summary

This phase adds a markdown-driven blog to a Next.js 16 static site, with MDX files living in `content/blog/` and rendered at build time using `@next/mdx` with dynamic imports. The blog needs custom React components for stat blocks (top performers, milestones, match results, standings) that reuse the project's existing score color utilities and design system. Email notification goes through Resend (already in `package.json`) to a Google Group address, triggered by a standalone Node script.

The publish gate is a DB-level control (settings row or column) that gates which week's data shows on high-traffic surfaces (homepage snapshot, bowler profiles) while leaving league night pages and blog posts ungated. This requires modifying the `latestWeek` CTE pattern used in `home.ts` and `bowlers.ts` queries.

**Primary recommendation:** Use `@next/mdx` with dynamic imports (the official Next.js approach), `gray-matter` for frontmatter parsing, and exported metadata objects from MDX files for blog index generation. Keep blog posts as `.mdx` files in `content/blog/` with custom stat-block React components.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Blog posts use hybrid sections: narrative intro/highlights paragraph, then distinct stat blocks
- All four stat blocks in every weekly recap: top performers, milestones/personal bests, match results, standings snapshot
- Score color coding same as rest of site (200+ green, 250+ gold)
- All bowler names link to profile pages in stat blocks AND narrative
- No image support for v1
- First blog post: combined site launch announcement + Week 4 recap
- Publish gate: DB flag controls published week, updated via `node scripts/publish-week.mjs --week=5`
- Publish gate gates: homepage latest week display + bowler profile stats
- NOT gated: league night pages, blog posts
- MDX files in `content/blog/` directory with React components inline
- YAML frontmatter: title, date, slug, season, week, excerpt, type
- `type` field: "recap" or "announcement"
- Slug-based URLs: `/blog/season-xxxv-week-4-recap` for recaps, `/blog/welcome-to-splitzkrieg` for one-offs
- Blog list page: cards with title, date, excerpt, stat highlight teaser
- Prev/next post navigation at bottom of each post
- Top-level nav item ("Blog" in main navigation)
- Blog replaces the Resources card on the homepage
- Hybrid pipeline: scripts handle mechanical parts, blog writing is conversational
- Email via Resend to Google Group address
- Email format: teaser with highlights + "Read the full recap" link
- Living runbook doc at `docs/weekly-runbook.md`
- Bidirectional cross-linking between blog posts and league night pages

### Claude's Discretion
- MDX parsing library choice and build-time rendering approach
- Blog card design and stat teaser formatting
- Prev/next navigation styling
- Email trigger mechanism (separate script vs flag on publish-week)
- Email template design (React Email with Resend)
- Runbook structure and level of detail
- Standings movement arrow design
- Blog list page responsive layout

### Deferred Ideas (OUT OF SCOPE)
- Subscriber signup form on site (opt-in email list)
- Auto-generated blog draft from weekly data
- Photo gallery in blog posts
- Fancier email list management (beyond Google Group)
- Email automation with per-bowler personalization
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONT-01 | Blog system for weekly recaps (new content going forward) | MDX infrastructure with `@next/mdx`, `content/blog/` directory, `generateStaticParams`, custom stat-block components, blog list page, prev/next navigation |
| CONT-02 | Auto-generated weekly highlights from score data (personal bests, milestones) | `getWeeklyHighlights()` query already exists in `home.ts` with debut detection, high game/series tracking, prior-best comparisons. Blog stat blocks reuse this data pattern. New queries needed for match results summary and standings snapshot. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@next/mdx` | latest | MDX compilation and rendering | Official Next.js MDX integration, supports App Router, dynamic imports, `generateStaticParams` |
| `@mdx-js/loader` | latest | Webpack loader for MDX files | Required by `@next/mdx` |
| `@mdx-js/react` | latest | React context for MDX components | Required by `@next/mdx` |
| `@types/mdx` | latest | TypeScript types for MDX | Type safety for MDX imports |
| `gray-matter` | ^4.0 | YAML frontmatter parsing | Battle-tested (used by Gatsby, Astro, Vitepress, etc.), simple API |
| `resend` | ^6.9.3 | Email sending API | Already installed in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `remark-gfm` | latest | GitHub Flavored Markdown (tables, strikethrough) | If blog posts need tables or extended markdown syntax |
| `@tailwindcss/typography` | latest | Prose styling for markdown content | Style raw markdown (headings, paragraphs, lists) with Tailwind classes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@next/mdx` | `next-mdx-remote` | next-mdx-remote has unstable RSC support; `@next/mdx` is the official path for Next.js 16 |
| `gray-matter` | Exported JS metadata objects from MDX | gray-matter gives YAML frontmatter (familiar authoring), but exported objects work too. Use gray-matter for the blog index page to read frontmatter without importing every MDX file. |
| `@tailwindcss/typography` | Hand-styled MDX components | Typography plugin handles prose baseline; custom components override specific elements |

**Installation:**
```bash
npm install @next/mdx @mdx-js/loader @mdx-js/react @types/mdx gray-matter remark-gfm @tailwindcss/typography
```

## Architecture Patterns

### Recommended Project Structure
```
content/
  blog/
    welcome-to-splitzkrieg.mdx        # Announcement post
    season-xxxv-week-4-recap.mdx      # Weekly recap post
src/
  app/
    blog/
      page.tsx                        # Blog list (read all frontmatter, render cards)
      [slug]/
        page.tsx                      # Dynamic blog post (import MDX by slug)
  components/
    blog/
      TopPerformers.tsx               # Stat block: top scratch series/game/hcp series
      MilestonesBlock.tsx             # Stat block: personal bests, patches earned
      MatchResultsSummary.tsx         # Stat block: team wins, sweeps, upsets
      StandingsSnapshot.tsx           # Stat block: standings with movement arrows
      BlogPostCard.tsx                # Card for blog list page
      BlogPostLayout.tsx              # Shared layout: post header, prev/next nav
      EmailTemplate.tsx               # React Email template for recap teaser
  lib/
    blog.ts                           # Utility: getAllPosts(), getPostBySlug() using gray-matter + fs
    queries/
      blog.ts                         # Queries for stat blocks (or reuse existing queries)
scripts/
  publish-week.mjs                    # Set published week flag in DB
  send-recap-email.mjs               # Send email via Resend after blog post is live
docs/
  weekly-runbook.md                   # Step-by-step commissioner workflow
mdx-components.tsx                    # Root-level MDX component overrides (required by @next/mdx)
```

### Pattern 1: MDX with Dynamic Imports and generateStaticParams
**What:** Blog post pages use dynamic `import()` to load MDX files by slug, with `generateStaticParams` pre-rendering all known slugs at build time.
**When to use:** For the `/blog/[slug]` route.
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/guides/mdx (dynamic imports section)
// app/blog/[slug]/page.tsx
import { getAllPosts, getPostBySlug } from '@/lib/blog';

export const dynamicParams = false;

export function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map(post => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  return { title: post?.title, description: post?.excerpt };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { default: Post } = await import(`@/content/blog/${slug}.mdx`);
  const meta = getPostBySlug(slug);
  return (
    <BlogPostLayout meta={meta}>
      <Post />
    </BlogPostLayout>
  );
}
```

### Pattern 2: Blog Index via File System + gray-matter
**What:** Read all MDX files from `content/blog/`, parse frontmatter with gray-matter, return sorted post metadata for the list page.
**When to use:** For `/blog` list page and anywhere you need post metadata without rendering MDX.
**Example:**
```typescript
// src/lib/blog.ts
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const POSTS_DIR = path.join(process.cwd(), 'content', 'blog');

export interface PostMeta {
  title: string;
  date: string;
  slug: string;
  season?: string;
  week?: number;
  excerpt: string;
  type: 'recap' | 'announcement';
}

export function getAllPosts(): PostMeta[] {
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.mdx'));
  return files
    .map(file => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
      const { data } = matter(raw);
      return data as PostMeta;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string): PostMeta | undefined {
  return getAllPosts().find(p => p.slug === slug);
}
```

### Pattern 3: Publish Gate via DB Settings Row
**What:** A `settings` table (or column on `seasons`) stores the published week number. Queries for homepage and bowler profiles use this instead of `MAX(week)`.
**When to use:** For controlling when new week data appears on high-traffic pages.
**Example:**
```sql
-- Option A: Simple settings table
CREATE TABLE leagueSettings (
  settingKey VARCHAR(50) PRIMARY KEY,
  settingValue VARCHAR(255)
);
INSERT INTO leagueSettings VALUES ('publishedWeek', '4');
INSERT INTO leagueSettings VALUES ('publishedSeasonID', '35');

-- Then in queries, replace:
--   SELECT MAX(sc.week) AS wk FROM scores sc WHERE sc.seasonID = @seasonID
-- With:
--   SELECT CAST(settingValue AS INT) AS wk FROM leagueSettings WHERE settingKey = 'publishedWeek'
```

### Pattern 4: Stat Block Components in MDX
**What:** Custom React components used inside MDX files for structured stat display. These are registered in `mdx-components.tsx` globally.
**When to use:** Every weekly recap post uses the same four stat blocks.
**Example:**
```mdx
---
title: "Season XXXV Week 4 Recap"
date: "2026-03-10"
slug: "season-xxxv-week-4-recap"
season: "XXXV"
week: 4
excerpt: "Three new career highs and a debut highlight an explosive Week 4."
type: "recap"
---

What a night! Week 4 brought fireworks...

<TopPerformers season="XXXV" week={4} />
<MilestonesBlock season="XXXV" week={4} />
<MatchResultsSummary season="XXXV" week={4} />
<StandingsSnapshot season="XXXV" week={4} />
```

**Important caveat:** Since this is a static site, stat block components cannot fetch data at render time inside MDX. Two approaches:
1. **Props-based:** Pass pre-fetched data as props from the page component (cleaner but requires wrapper)
2. **Build-time fetch inside component:** Use `async` server components that call `cachedQuery()` — this works in Next.js App Router since MDX components render server-side at build time

Recommendation: Use approach 2 (async server components) since it matches the project's existing pattern where components call query functions directly.

### Anti-Patterns to Avoid
- **Don't use `next-mdx-remote`** for this use case. The project has local MDX files, not remote/CMS content. `@next/mdx` with dynamic imports is simpler and officially supported.
- **Don't put MDX files in `app/blog/`** as page routes directly. Using dynamic imports from `content/blog/` keeps content separate from routing code and allows programmatic access to frontmatter.
- **Don't add `/* vN */` to `generateStaticParams` queries** per CLAUDE.md. The blog's `generateStaticParams` reads the file system, not the DB, so this is naturally safe.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering | Custom parser | `@next/mdx` | Handles JSX in markdown, remark/rehype pipeline, React component mapping |
| Frontmatter parsing | Regex or custom YAML parsing | `gray-matter` | Battle-tested, handles edge cases, 400M+ downloads |
| Prose typography | Custom CSS for every markdown element | `@tailwindcss/typography` | Automatic consistent styling for all prose elements |
| Email templates | Raw HTML strings | React Email components + Resend | Maintainable, testable, renders across email clients |
| Email delivery | SMTP, nodemailer | Resend SDK (already installed) | Simple API, good deliverability, React Email integration |

**Key insight:** The blog stat blocks are where custom code belongs. Everything around them (MDX rendering, frontmatter, prose styling, email sending) has mature solutions.

## Common Pitfalls

### Pitfall 1: MDX Dynamic Import Path Must Be Literal
**What goes wrong:** Template literal in `import()` must start with a static prefix for webpack to resolve.
**Why it happens:** Webpack needs to know which directory to scan at build time.
**How to avoid:** Always use `import(\`@/content/blog/${slug}.mdx\`)` with the static `@/content/blog/` prefix. Never use a fully dynamic path.
**Warning signs:** Build errors about "cannot find module" or empty pages.

### Pitfall 2: next.config Must Change to TypeScript-Compatible Format
**What goes wrong:** Current `next.config.ts` uses simple TypeScript export. `@next/mdx` requires wrapping with `createMDX()`.
**Why it happens:** The MDX plugin needs to modify the webpack config.
**How to avoid:** Convert `next.config.ts` to use `createMDX` wrapper. The config file is currently empty so this is a safe change.
**Warning signs:** MDX files not being compiled, raw text appearing instead of rendered content.

### Pitfall 3: mdx-components.tsx is Required
**What goes wrong:** App Router MDX rendering fails silently without this file.
**Why it happens:** `@next/mdx` with App Router requires a root-level `mdx-components.tsx` file.
**How to avoid:** Create `mdx-components.tsx` at project root (same level as `package.json`) before any MDX rendering.
**Warning signs:** Build errors mentioning mdx-components, or MDX rendering with no custom styles.

### Pitfall 4: Publish Gate Must Not Break Cache Hash
**What goes wrong:** Adding the publish gate changes SQL text in queries used by `generateStaticParams`, busting cache across all seasons.
**Why it happens:** Per CLAUDE.md, queries used by `generateStaticParams` run for ALL seasons.
**How to avoid:** The publish gate only affects `SNAPSHOT_STATS_SQL` and similar homepage/profile queries, NOT `generateStaticParams`. Keep the gate query separate from the season iteration queries.
**Warning signs:** 15+ minute builds, Azure SQL throttling during rebuild.

### Pitfall 5: Resend From Address Requires Verified Domain
**What goes wrong:** Emails fail to send or go to spam.
**Why it happens:** Resend requires a verified sending domain for production.
**How to avoid:** Verify `splitzkrieg.org` domain in Resend dashboard (DNS records). Use `from: 'Splitzkrieg <noreply@splitzkrieg.org>'`.
**Warning signs:** 403 errors from Resend API, emails in spam folder.

### Pitfall 6: Async Server Components in MDX
**What goes wrong:** Stat block components that fetch data don't work as expected.
**Why it happens:** MDX components need to be async server components to call `cachedQuery()`.
**How to avoid:** Ensure stat block components are `async function` server components (not client components). Test that data fetching works within the MDX rendering pipeline.
**Warning signs:** Components render without data, or hydration mismatches.

## Code Examples

### next.config.ts with MDX Support
```typescript
// Source: https://nextjs.org/docs/app/guides/mdx
import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
};

const withMDX = createMDX({
  options: {
    remarkPlugins: ['remark-gfm'],
    rehypePlugins: [],
  },
});

export default withMDX(nextConfig);
```

### mdx-components.tsx (Root Level)
```typescript
// Source: https://nextjs.org/docs/app/guides/mdx
import type { MDXComponents } from 'mdx/types';
import Link from 'next/link';
import { TopPerformers } from '@/components/blog/TopPerformers';
import { MilestonesBlock } from '@/components/blog/MilestonesBlock';
import { MatchResultsSummary } from '@/components/blog/MatchResultsSummary';
import { StandingsSnapshot } from '@/components/blog/StandingsSnapshot';

export function useMDXComponents(): MDXComponents {
  return {
    // Map stat block components for use in MDX
    TopPerformers,
    MilestonesBlock,
    MatchResultsSummary,
    StandingsSnapshot,
    // Style prose elements to match site design
    h1: ({ children }) => <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-4">{children}</h1>,
    h2: ({ children }) => <h2 className="font-heading text-2xl text-navy mt-8 mb-3">{children}</h2>,
    p: ({ children }) => <p className="font-body text-navy/80 leading-relaxed mb-4">{children}</p>,
    a: ({ href, children }) => (
      <Link href={href ?? '#'} className="text-red-600 hover:text-red-700 underline">
        {children}
      </Link>
    ),
  };
}
```

### Publish Week Script
```javascript
// scripts/publish-week.mjs
// Usage: node scripts/publish-week.mjs --week=5 [--season=35]
import sql from 'mssql';
// ... db config same as import-week-scores.mjs ...

const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.replace('--', '').split('='))
);
const week = parseInt(args.week);
const seasonID = parseInt(args.season ?? '35');

await pool.request()
  .input('key', sql.VarChar, 'publishedWeek')
  .input('val', sql.VarChar, String(week))
  .query(`UPDATE leagueSettings SET settingValue = @val WHERE settingKey = @key`);

await pool.request()
  .input('key', sql.VarChar, 'publishedSeasonID')
  .input('val', sql.VarChar, String(seasonID))
  .query(`UPDATE leagueSettings SET settingValue = @val WHERE settingKey = @key`);

console.log(`Published: Season ${seasonID}, Week ${week}`);
```

### Resend Email from Script
```javascript
// scripts/send-recap-email.mjs
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: 'Splitzkrieg <noreply@splitzkrieg.org>',
  to: ['splitzkrieg-bowlers@googlegroups.com'],
  subject: 'Week 4 Recap is Live!',
  html: `
    <h1>Week 4 Recap</h1>
    <p>Three new career highs and a debut highlight an explosive Week 4.</p>
    <a href="https://splitzkrieg.org/blog/season-xxxv-week-4-recap">Read the full recap</a>
  `,
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-mdx-remote` | `@next/mdx` with dynamic imports | Next.js 14+ App Router era | Simpler, no serialization, native RSC support |
| Custom SMTP/nodemailer | Resend + React Email | 2023+ | Simpler API, React components for emails |
| Separate CMS for blog | MDX in repo | Ongoing trend for dev-authored content | No CMS dependency, version-controlled content |

**Deprecated/outdated:**
- `next-mdx-remote`'s `serialize()` + `MDXRemote` pattern: replaced by dynamic imports in App Router
- `getStaticProps` / `getStaticPaths`: replaced by `generateStaticParams` in App Router (project already uses this)

## Open Questions

1. **DB table for publish gate: new `leagueSettings` table vs column on `seasons`?**
   - What we know: CONTEXT.md says "DB flag (column or settings row)." A `leagueSettings` table is more flexible for future settings.
   - Recommendation: Use `leagueSettings` table. It's one CREATE TABLE + two INSERT statements, and avoids modifying the `seasons` schema.

2. **Resend domain verification status?**
   - What we know: `resend` package is installed. Unknown if `splitzkrieg.org` is verified in Resend dashboard.
   - Recommendation: Verify domain before email task. If not verified, use `onboarding@resend.dev` for testing.

3. **Stat block data: fetch per-component or pass from page?**
   - What we know: Async server components work in MDX rendering pipeline. Project pattern is components calling query functions directly.
   - Recommendation: Stat block components call `cachedQuery()` directly with season/week props. This matches existing patterns and keeps MDX authoring simple.

4. **Countdown animation verification (mentioned in CONTEXT.md)**
   - What we know: Countdown components exist (7 files). Needs testing, not new development.
   - Recommendation: Add as a test-only task, not a build task.

## Sources

### Primary (HIGH confidence)
- [Next.js MDX Guide](https://nextjs.org/docs/app/guides/mdx) - Complete setup for @next/mdx with App Router, dynamic imports, generateStaticParams, mdx-components.tsx requirement
- [Resend Next.js Docs](https://resend.com/docs/send-with-nextjs) - Email sending API, React Email template integration
- Project source code: `package.json` (Next.js 16.1.6, React 19.2.3, Resend ^6.9.3), `src/lib/db.ts` (cachedQuery pattern), `src/lib/queries/home.ts` (latestWeek CTE pattern, weekly highlights query)

### Secondary (MEDIUM confidence)
- [gray-matter GitHub](https://github.com/jonschlinkert/gray-matter) - Frontmatter parsing, widely adopted
- [Tailwind Typography Plugin](https://github.com/tailwindlabs/tailwindcss-typography) - Prose styling

### Tertiary (LOW confidence)
- Async server components inside MDX rendering pipeline: based on Next.js App Router architecture, but should be verified during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Next.js docs confirm @next/mdx approach, Resend already installed
- Architecture: HIGH - Dynamic import pattern documented in Next.js MDX guide, matches project's existing generateStaticParams pattern
- Pitfalls: HIGH - Based on Next.js docs requirements (mdx-components.tsx), project cache rules (CLAUDE.md), and Resend docs
- Publish gate: MEDIUM - DB settings table approach is straightforward but query modifications need careful testing against cache system

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable libraries, no fast-moving changes expected)
