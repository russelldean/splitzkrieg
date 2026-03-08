# Phase 5: Polish and Team H2H - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix remaining polish items and wire up real head-to-head data on team pages. Scope: mobile parallax verification, standings week number, match results legend (dropped), team H2H with real matchResults data, TeamHero standing card improvements, bowler profile page navigation improvements.

</domain>

<decisions>
## Implementation Decisions

### Match Results Legend
- Dropped — green/red/amber color coding is self-explanatory, no legend needed

### Team H2H — Summary Table
- One row per opponent team with: opponent name (linked to team page), W, L, T, win%
- Sorted by most matchups first (highlights biggest rivalries)
- Opponent names link to their team pages (maintains cross-linked graph)
- Only show teams they've actually played in the table
- Below the table: "Have not yet faced each other" list, but ONLY for other currently active teams they haven't played. Inactive/defunct teams with no matchups are simply omitted entirely.

### Team H2H — Drill-Down Detail
- Click a summary row to expand and see matchup history
- Each meeting shows: date, season, week, W/L result (color coded: green/amber/navy), both teams' hcp series totals
- Each meeting row links to the weekly results page for that week
- Flat list, reverse chronological (newest first) — matches bowler profile game log pattern
- No overall aggregate record above the table

### TeamHero Standing Card
- Rank (#2 of 8)
- Division name underneath the rank
- Full W-L record (not just wins), XP, total pts
- Link to league nights page for that season

### Bowler Profile — Season Stats Collapsing
- Season stats table shows only the 3 most recent seasons by default
- "Show all X seasons" expander to reveal full history
- Career totals row always visible (even when collapsed)

### Bowler Profile — Game Log
- Keep as-is: per-season collapsing with newest season expanded by default

### Claude's Discretion
- Standings week number display format ("after Wk 3" or similar)
- Mobile parallax verification approach
- H2H drill-down visual treatment and expand/collapse animation
- Season stats "show all" button styling
- Exact spacing and responsive adaptations

</decisions>

<specifics>
## Specific Ideas

- H2H "have not yet faced each other" list below the main table — fun trivia element
- H2H drill-down links to weekly results page for anyone wanting to dig deeper into a specific matchup
- Season stats collapsing keeps the bowler profile page from being an overwhelming scroll for long-career bowlers

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ParallaxBg.tsx`: Already implemented with mobile path (translateY), dual desktop/mobile behavior — verify it works, may not need changes
- `Standings.tsx`: Renders division-aware standings table — needs week number added to title
- `WeeklyResults.tsx`: Has `gameWinClass()` for green/amber/navy color coding — reuse same pattern for H2H detail
- `HeadToHead.tsx`: Placeholder component with EmptyState — ready to replace with real implementation
- `TeamHero.tsx`: Shows `#{rank} of {size}` with W/XP/pts callout card — needs layout adjustments
- `SeasonStatsTable.tsx`: Season-by-season summary table — needs show/collapse behavior added
- `GameLog.tsx`: Accordion pattern with expand/collapse — reference for H2H drill-down interaction

### Established Patterns
- Static generation with `generateStaticParams` + `dynamicParams = false`
- All SQL in `src/lib/queries/` — components never use raw SQL
- Score color coding: green (win/200+), amber (tie), navy (loss/default)
- Accordion expand/collapse pattern established in GameLog

### Integration Points
- `matchResults` table: 786 rows across 10 seasons (XXVI-XXXV) — real H2H data source
- `getTeamCurrentStanding()` query — needs to return losses for full W-L display
- Weekly results pages exist at `/week/[seasonSlug]` — H2H detail rows link here
- League nights pages for TeamHero link

</code_context>

<deferred>
## Deferred Ideas

- Team logos — let teams submit logos to display on team pages (future phase)
- Merging season stats table into game log accordion (considered, decided against — horizontal scroll on stats table makes them better as separate sections)

</deferred>

---

*Phase: 05-polish-and-team-h2h*
*Context gathered: 2026-03-08*
