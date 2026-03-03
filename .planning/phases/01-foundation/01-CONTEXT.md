# Phase 1: Foundation - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Statically generated Next.js site with build-time Azure SQL data fetching, Metrograph-inspired design system, pre-built search index, on-demand revalidation pipeline, and mobile responsiveness. Visitors never hit the database — all pages are pre-rendered HTML with instant loads. This is the foundation every subsequent page inherits — no feature pages yet.

</domain>

<decisions>
## Implementation Decisions

### Visual Identity
- Warm cream background with crisp navy and punchy red accent — editorial feel, somewhere between vintage and modern
- No dark mode — the warm cream palette IS the brand. One cohesive look.
- Typography: DM Serif Display for headings, Inter for body. Confident but restrained — moderate heading sizes, mixed case, editorial newspaper feel. Let the data breathe.
- User has existing logo files and will add them to the repo. Use text-based "SPLITZKRIEG" in heading font as placeholder until logo files arrive.

### Site Navigation
- Top bar with integrated search: Logo left, search bar center (always visible from every page), nav links right
- Top-level nav links: Bowlers, Teams, Seasons, Leaderboards (always visible)
- Footer: Secondary nav links (About, Rules, Blog, Join) plus league info. "Since 2007" branding.
- Mobile: Hamburger menu for nav links, search bar stays prominent

### Build-Time Data Pipeline
- Static hybrid architecture: all public pages are pre-rendered at build time. Azure SQL only wakes during builds and admin work — visitors never hit the database.
- Azure SQL cold starts (30-60s) are a build-time concern only. Build process must handle retries/timeouts gracefully.
- On-demand revalidation: after biweekly data syncs, trigger rebuild so fresh stats deploy as new static pages.
- Pre-built search index: bowler names baked into a JSON file at build time for instant client-side search (no live DB query needed).

### Page Transition States
- Claude's Discretion: Loading animation style for client-side page transitions (route changes within the SPA)
- Transitions should match the warm cream palette — not generic gray bars
- These are brief navigation transitions, not cold-start waits — keep them light and fast

### Page Shell & Layout
- Claude's Discretion: Max width, content density, whitespace, grid system
- General direction: Editorial feel — not cramped data tables, not wasteful whitespace. The data should be the star but presented cleanly.
- Mobile-first responsive design required at 375px minimum

</decisions>

<specifics>
## Specific Ideas

- Metrograph cinema website is the aesthetic reference — bold serif typography, warm palette, clean layout
- Baseball Reference is the functional reference — data density done right, everything cross-linked
- The site should feel like it belongs to a real league with personality, not a generic template
- "SPLITZKRIEG" as a word has visual punch — the typography should lean into that

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — pure Next.js scaffolding with default create-next-app template

### Established Patterns
- Next.js 16.1.6 with App Router (src/app/ directory structure)
- Tailwind CSS v4 with @theme inline block in globals.css
- Currently uses Geist fonts (will be replaced with DM Serif Display + Inter)
- No components, hooks, or utilities exist yet
- Static hybrid: pages use generateStaticParams + fetch at build time, not runtime server components hitting DB

### Integration Points
- layout.tsx: Root layout needs font setup, nav shell, footer
- globals.css: Tailwind @theme block needs design tokens (colors, fonts, spacing)
- No database connection exists yet — mssql package not installed (used at build time only, not in client bundle)
- No environment variables configured (.env.local needed for Azure SQL connection string — used during build/revalidation only)
- Revalidation endpoint needed: API route to trigger on-demand ISR after data syncs

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-02*
