# Phase 2: Bowler Profiles - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The centerpiece page — a bowler visits their profile and sees their complete career: stats by season, personal records, average progression chart, and game scores. All cross-linked and shareable. Achievements, milestones, and leaderboard context are Phase 5 scope.

</domain>

<decisions>
## Implementation Decisions

### Profile Layout
- Hero header with bowler name large, career stats displayed as stat pills underneath (Career Avg · Total Games · Seasons Active · Teams Played For)
- Single-column layout — no sidebar
- Section order: Hero → Personal records → Average chart → Season-by-season table → Game log
- Mixed section styling: tables go full-width, records panel and chart go in cards
- Share button in the hero area — copies profile URL to clipboard
- No distinction between active and inactive bowlers — every bowler gets the same profile
- Mobile-first responsive (375px minimum, consistent with Phase 1)

### Stats Table
- Full stats density: Season · Team · Games · Average · High Game · High Series · 200+ count · Total Pins
- Career totals as bold bottom row with subtle background highlight — classic Baseball Reference style
- Not sortable — chronological order, always
- Team names are clickable links to /team/[slug] (even before Phase 4 team pages exist)
- Season names are clickable links to /season/[slug] (even before Phase 4 season pages exist)

### Personal Records Panel
- 2x2 stat cards grid layout inside a card container
- Shows: High Game, High Series, 200+ count, 600+ count
- Score color coding: 200+ green, 250+ gold, 300 (perfect game) gets special treatment (red accent or badge)

### Average Progression Chart
- Clean line chart, not sparkline or full interactive
- Scratch average only — one clean line per season
- Site palette: navy line on cream background, red accent for career high point
- Hover shows exact average value
- Hide chart entirely if bowler has fewer than 3 seasons of data
- Chart lives in a card container

### Game Log
- Accordion per season — each season is a collapsible section
- Most recent season expanded by default, older seasons collapsed
- Expand All / Collapse All toggle at top of game log section
- Full detail per row: Week number · Date · Opponent team · Game 1 · Game 2 · Game 3 · Series total · W/L indicator
- Same score color coding in game log (200+ green, 250+ gold, 300 special)
- Opponent team names link to /team/[slug]

### Claude's Discretion
- Hero header visual treatment (background/gradient, accent elements)
- Mobile hero stat pills layout (2x2 grid vs vertical stack)
- Mobile table approach (horizontal scroll vs hide columns)
- Data point style on chart (dots at each season vs smooth line)
- Additional charts beyond average progression (e.g., score distribution) — only if they add clear value
- Loading states and error handling
- Exact spacing, typography sizing, and whitespace

</decisions>

<specifics>
## Specific Ideas

- Baseball Reference is the functional reference — data density, cross-linking, chronological career history
- Metrograph cinema aesthetic continues from Phase 1 — editorial feel, warm palette, confident typography
- Every entity (bowler, team, season) should link to every other — building the cross-linked reference graph from the start
- 300 is the holy grail of bowling — it deserves special visual treatment wherever it appears
- The profile should feel like a complete career page you'd text to your league mates

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/EmptyState.tsx`: Empty state component for sections with no data
- `src/components/ui/PageTransition.tsx`: Page transition animations
- `src/components/layout/Header.tsx`, `Footer.tsx`, `MobileNav.tsx`: Page shell components
- `src/components/layout/SearchBar.tsx`: Search with Fuse.js autocomplete

### Established Patterns
- Static generation with `generateStaticParams` + `dynamicParams = false` — no runtime DB queries
- `src/lib/db.ts`: Azure SQL connection pool with retry logic (build-time only)
- `src/lib/queries.ts`: Named query functions — all SQL lives here, pages call functions
- Tailwind CSS v4 with `@theme` inline block for design tokens
- DM Serif Display headings + Inter body text
- Cream/navy/red palette defined in globals.css

### Integration Points
- `src/app/bowler/[slug]/page.tsx`: Existing scaffold — needs full profile components added
- `src/lib/queries.ts`: Needs expanded queries for season stats, records, game scores, chart data
- `Bowler` interface needs expansion (currently: bowlerID, bowlerName, slug, isActive)
- Chart library needed — not yet installed (Recharts, Chart.js, or similar)
- Team/season slug generation needed for cross-links

</code_context>

<deferred>
## Deferred Ideas

- Achievements and milestones on bowler profile (e.g., "3 games from 100 career games") — Phase 5 (BWLR-07, BWLR-08)
- Leaderboard context on profile (e.g., "Ranked 5th in career average") — Phase 5 (BWLR-10)

</deferred>

---

*Phase: 02-bowler-profiles*
*Context gathered: 2026-03-02*
