# Phase 1: Foundation - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Working Next.js app connected to Azure SQL with the Metrograph-inspired design system, loading skeletons for cold starts, mobile responsiveness, and graceful missing data handling. This is the foundation every subsequent page inherits — no feature pages yet.

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

### Loading & Cold Starts
- Claude's Discretion: Skeleton design, loading animation style, cold start messaging
- Key constraint: Azure SQL cold starts take 30-60 seconds. First visitor after idle must see branded loading state, not blank page or error.
- Skeletons should match the warm cream palette — not generic gray bars

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

### Integration Points
- layout.tsx: Root layout needs font setup, nav shell, footer
- globals.css: Tailwind @theme block needs design tokens (colors, fonts, spacing)
- No database connection exists yet — mssql package not installed
- No environment variables configured (.env.local needed for Azure SQL connection string)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-02*
