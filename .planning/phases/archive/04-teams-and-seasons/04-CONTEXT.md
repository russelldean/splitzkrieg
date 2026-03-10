# Phase 4: Teams and Seasons - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can browse team profiles and season pages, completing the three-entity reference graph where every bowler, team, and season links to every other. Includes directory pages for /teams and /seasons, individual team profile pages at /team/[slug], and individual season pages at /season/[slug]. Leaderboards, achievements, milestones, and admin tools are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Team Profile Page — Layout & Sections
- Section order: Hero → Franchise name history (collapsed, similar to team appearances on bowler page) → Current roster → Season-by-season (W/L + stats, expandable bowlers) → All-time roster summary → Head-to-head records
- Hero emphasizes franchise identity: team name large, current roster count, seasons active, franchise lineage. At least one reference to current standings somewhere on page.
- Franchise name history shown as small collapsed list (similar to TeamBreakdown on bowler profiles), showing time period for each name when data is available. Historic name dates not yet in DB — build the structure, populate later.
- Championships section (team championships + individual winners from that team) built with empty state, ready for data from `seasonChampions` table

### Team Profile — Current Roster
- Shows everyone who has bowled for the team in the past year
- Each bowler shows: name (linked to profile) + current season average + games bowled
- Simple list, not cards

### Team Profile — Season-by-Season
- Top-level rows show team W/L records and other stats per season (with historic team name at the time listed)
- Expand a season to see individual bowlers who were on the team, how many games they bowled, and their stats
- W/L data: attempt to derive from schedule + scores where possible. If too complex/unreliable, fall back to waiting for matchResults population
- Older seasons (pre-XXVI) without schedule data: one friendly note covering the era — "Team records before Season XXVI are still in the file cabinets."

### Team Profile — All-Time Roster Summary
- Ranks everyone who ever bowled for the team
- Sorted by total games bowled for the team (loyalty metric)
- Shows games, pins, average, seasons with the team

### Team Profile — Head-to-Head Records
- Table: one row per opponent team — columns: opponent name, W/L record, last meeting date, next scheduled match if upcoming
- Wait for matchResults to be populated before showing — file cabinet empty state until then
- Uses schedule data (XXVI–XXXV) once matchResults available

### Season Page — Hero & Identity
- Season name (Roman numeral + display name), year, period (Spring/Fall)
- Key stats in hero: top average, high game, high series, champions (when data exists), league average for the season
- URL structure: `/season/fall-2025` (display name slug, not Roman numeral)

### Season Page — Standings
- Division-grouped standings when divisions exist, single list when they don't
- Show W/L, points, XP where derivable from schedule+scores
- Points system has changed over the years — don't assume current formula for historical seasons
- Standings race chart: visualization showing team rankings over the weeks (like F1 position chart — lines weaving as teams trade places). If too complex, fall back to week-by-week standings slider/dropdown.

### Season Page — Leaderboards
- Top 10 per category (leaders get their love)
- Mirror current spreadsheet categories: Men's Scratch, Women's Scratch, Handicap
- Plus records tables: high team series (scratch + hcp), high individual series (men's/women's scratch), high scratch game, turkeys, 200 games
- Below leaderboards: full sortable stats table for every bowler who bowled that season
- Full stats table split into separate tables by gender (men's scratch, women's scratch, handicap) — mirrors leaders approach

### Season Page — Weekly Results
- Full match detail per week (the box score experience) — expandable to show all matches with individual bowler scores, XP tiers, bowler/team of the week
- Basically the full weekly report on the site — each week is like a web page within the season
- Integrated schedule: played weeks show results, future weeks show the schedule
- Bowler/team of the week aggregated as its own dedicated section on the season page — list of who won each week across the season
- Splitzkrieg debuts shown inline within weekly results where they happened (not a separate section)

### Season Page — Data Tiers
- Recent seasons (XXVI–XXXV) with schedule data: full treatment (standings, weekly match results, leaderboards, bowler stats)
- Older seasons (I–XXV): simplified stats-only page (leaderboards, bowler stats, averages). No weekly view.

### Directory Pages — /teams
- Active teams first, then historical teams below
- Card layout (adapted from /bowlers pattern but with more info per card since fewer items)
- Each card: team name + roster count + seasons active + all-time record
- Team timeline visualization at bottom of page showing which teams existed in which seasons — cool way to see league evolution. If it can't look good inline, move to standalone /teams/history page.

### Directory Pages — /seasons
- Reverse chronological list (most recent first)
- Clean ordered list style, similar to Baseball Reference season index
- Each row: season name (e.g., "Fall 2025 - Season XXXV"), year, number of teams, number of bowlers, champion (if data exists)

### Empty Data Strategy
- League voice humor for missing data: "Someone is currently looking through the file cabinets to find this data. Check back in a month."
- Show everything we can compute from scores data (leaderboards, bowler stats, averages). Empty state only for sections that need matchResults/playoffResults/seasonChampions.
- Champions sections built with empty state on both team and season pages — ready for data (user says upload is easy)
- H2H on team pages: wait for matchResults before showing anything — file cabinet message
- Old season rows on team page: same columns with one note covering the era rather than per-row blanks

### Claude's Discretion
- Team hero visual treatment and stat pill layout
- Season hero layout and visual treatment
- Standings race chart implementation approach (Recharts line chart, custom SVG, etc.)
- Team timeline visualization approach
- Weekly results expandable UI design
- Mobile responsive adaptations for all new pages
- Exact spacing, typography, and card styling
- Loading states and error handling
- How to derive W/L from schedule+scores (or recommend waiting for matchResults)

</decisions>

<specifics>
## Specific Ideas

- Weekly results should feel like a box score you can go back and look at — the full match-by-match detail is what makes it special
- Standings race chart inspired by F1 position charts — lines weaving up and down as teams trade places through the season, tells the story at a glance
- Team timeline on /teams directory showing which teams existed in which seasons — visualizes how the league has evolved over 18 years
- "Someone is currently looking through the file cabinets to find this data. Check back in a month." — the canonical empty data message
- Reference PDFs in `docs/` show exact current reporting format: Standings (div/rank/total/wins/XP/scratch avg/hcp avg), Season Leaders (men's scratch/women's scratch/handicap + records), Weekly report (match-by-match with individual bowler lines), Bowler Stats (full stat sheet with gender rankings)
- Points system: Wins (2pts/win, 1pt/tie) + XP (top 5 hcp teams get 3pts, next 5 get 2pts, next 5 get 1pt, last 5 get 0) — but this has changed over the years
- Divisions are purely organizational — teams shuffled each season to ensure every team plays five new teams
- "Most improved" noted as a future idea, not for this phase
- Debuts as potential ticker item for later

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BowlerHero.tsx`: Hero pattern with name, stat pills, share button — adapt for TeamHero and SeasonHero
- `SeasonStatsTable.tsx`: Table with season/team/games/avg columns + cross-links — adapt for team season-by-season stats
- `GameLog.tsx`: Accordion-based, season-grouped week-by-week data — adapt for weekly results and team roster expansion
- `PersonalRecordsPanel.tsx`: Grid of stat cards — adapt for team records or season leaderboard highlights
- `TeamBreakdown.tsx`: Collapsed dropdown showing team list — adapt for franchise name history display
- `ShareButton.tsx`: Social share — reuse on team and season pages
- `EmptyState.tsx`: Generic empty state component — use for file cabinet messages
- `StrikeX.tsx`: Red/bold styled X — reuse in season Roman numerals and score displays
- `SeasonSnapshot.tsx`: Current season widget — reference for standings/leader widgets
- `AverageProgressionChart.tsx`: Recharts line chart — reference pattern for standings race chart

### Established Patterns
- Static generation with `generateStaticParams` + `dynamicParams = false`
- All SQL in `queries.ts`, components never use raw SQL
- `React.cache` wraps queries called by both generateMetadata and page component
- Parallel data fetching via `Promise.all()` in page components
- Tailwind CSS v4 with @theme tokens (cream/navy/red palette)
- Score color coding: 200+ green, 250+ gold, 300 special (red accent)
- Bowler profiles: `/bowler/[slug]` pattern with slug from DB

### Integration Points
- `src/lib/queries.ts`: Needs ~15+ new query functions for teams and seasons (no team/season queries exist yet)
- `src/app/team/[slug]/page.tsx`: New dynamic route needed
- `src/app/season/[slug]/page.tsx`: New dynamic route needed (slug = display name like "fall-2025")
- `src/app/teams/page.tsx`: Existing placeholder — replace with real directory
- `src/app/seasons/page.tsx`: Existing placeholder — replace with real directory
- `src/components/team/`: New component directory needed
- `src/components/season/`: New component directory needed
- DB tables: teams, teamNameHistory, teamRosters, seasons, schedule, scores, seasonDivisions, matchResults (empty), seasonChampions (empty)
- Schedule data only for Seasons XXVI–XXXV (846 rows)
- 42 teams, 35 seasons, 4,322 roster entries in DB

</code_context>

<deferred>
## Deferred Ideas

- "Most improved" award/stat — future phase or leaderboards phase
- Debuts as ticker item on home page — future enhancement
- Team name history dates in DB — user will upload when ready
- Full h2h records — waiting for matchResults population
- Champions data — user will upload soon with Claude's help
- Weekly results for older seasons (I–XXV) — only when schedule data is backfilled
- Standings points formula history — research needed per era

</deferred>

---

*Phase: 04-teams-and-seasons*
*Context gathered: 2026-03-03*
