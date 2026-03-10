# Phase 4: Teams and Seasons - Research

**Researched:** 2026-03-03
**Domain:** Next.js static page generation, SQL data aggregation, Recharts visualization
**Confidence:** HIGH

## Summary

Phase 4 builds two new entity types (teams and seasons) with four new route groups (`/teams`, `/team/[slug]`, `/seasons`, `/season/[slug]`) following the exact same static generation pattern established in Phases 2 and 3. The existing codebase provides strong patterns to follow: `generateStaticParams` + `dynamicParams = false`, all SQL in `queries.ts`, `React.cache` for metadata deduplication, `Promise.all` for parallel data fetching, and Recharts for visualization.

The primary complexity lies in SQL query design — this phase requires approximately 15-20 new query functions spanning team rosters, season-by-season team stats, season standings, leaderboards by gender, weekly results with individual scores, and schedule integration. The schedule data only covers Seasons XXVI-XXXV (846 rows), so older seasons get a reduced "stats-only" treatment. Three tables (`matchResults`, `playoffResults`, `seasonChampions`) are empty, requiring graceful empty states throughout.

**Primary recommendation:** Structure work into three waves: (1) data layer queries + team pages, (2) season pages with standings and leaderboards, (3) weekly results box scores and visualizations (standings race chart, team timeline). This mirrors the Phase 2/3 pattern of data-first, then UI.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Section order: Hero -> Franchise name history (collapsed, similar to team appearances on bowler page) -> Current roster -> Season-by-season (W/L + stats, expandable bowlers) -> All-time roster summary -> Head-to-head records
- Hero emphasizes franchise identity: team name large, current roster count, seasons active, franchise lineage. At least one reference to current standings somewhere on page.
- Franchise name history shown as small collapsed list (similar to TeamBreakdown on bowler profiles), showing time period for each name when data is available. Historic name dates not yet in DB — build the structure, populate later.
- Championships section (team championships + individual winners from that team) built with empty state, ready for data from `seasonChampions` table
- Current roster shows everyone who bowled for the team in the past year; each bowler shows: name (linked to profile) + current season average + games bowled; simple list, not cards
- Season-by-season: top-level rows show team W/L records and stats per season (with historic team name), expand to see individual bowlers. W/L data: attempt to derive from schedule + scores where possible, fall back to waiting for matchResults if too complex/unreliable. Older seasons (pre-XXVI) without schedule data: one friendly note covering the era.
- All-time roster summary ranks everyone who ever bowled for the team, sorted by total games bowled (loyalty metric), shows games, pins, average, seasons with the team
- Head-to-head records: table with one row per opponent team (W/L record, last meeting, next scheduled). Wait for matchResults — file cabinet empty state until then
- Season page hero: season name (Roman numeral + display name), year, period (Spring/Fall). Key stats: top average, high game, high series, champions (when data exists), league average. URL: `/season/fall-2025` (display name slug, not Roman numeral)
- Division-grouped standings when divisions exist, single list when they don't. Show W/L, points, XP where derivable. Points system has changed over the years — don't assume current formula for historical seasons.
- Standings race chart: visualization showing team rankings over weeks (F1 position chart style). If too complex, fall back to week-by-week standings slider/dropdown.
- Season leaderboards: top 10 per category. Mirror spreadsheet categories: Men's Scratch, Women's Scratch, Handicap. Plus records tables: high team series (scratch + hcp), high individual series (men's/women's scratch), high scratch game, turkeys, 200 games. Below leaderboards: full sortable stats table split by gender.
- Weekly results: full match detail per week (box score experience) — expandable to show all matches with individual bowler scores, XP tiers, bowler/team of the week. Integrated schedule: played weeks show results, future weeks show schedule. Bowler/team of the week aggregated as dedicated section. Splitzkrieg debuts shown inline within weekly results.
- Data tiers: Recent seasons (XXVI-XXXV) with schedule data get full treatment. Older seasons (I-XXV) get simplified stats-only page.
- /teams directory: active teams first, then historical. Card layout with team name + roster count + seasons active + all-time record. Team timeline visualization at bottom showing which teams existed in which seasons.
- /seasons directory: reverse chronological list. Each row: season name, year, number of teams, number of bowlers, champion (if data exists).
- Empty data strategy: league voice humor ("Someone is currently looking through the file cabinets..."). Show everything computable from scores. Empty state for sections needing matchResults/playoffResults/seasonChampions. H2H waits for matchResults. Old season rows get one note covering the era.

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

### Deferred Ideas (OUT OF SCOPE)
- "Most improved" award/stat — future phase or leaderboards phase
- Debuts as ticker item on home page — future enhancement
- Team name history dates in DB — user will upload when ready
- Full h2h records — waiting for matchResults population
- Champions data — user will upload soon with Claude's help
- Weekly results for older seasons (I-XXV) — only when schedule data is backfilled
- Standings points formula history — research needed per era
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEAM-01 | User can view team profile with current roster linked to bowler profiles | Team profile page with `generateStaticParams` from teams table, roster query joining teamRosters + scores + bowlers for current season |
| TEAM-02 | Team page shows team history (all-time record, past rosters by season) | Season-by-season query grouping scores by seasonID+teamID with expandable bowler detail; all-time roster summary query |
| TEAM-03 | Team page shows head-to-head record vs every other team | Empty state ("file cabinet" message) — matchResults table is empty. Build the UI shell, populate when data arrives |
| TEAM-04 | Shareable team URL (splitzkrieg.org/team/gutter-sluts) | Teams table already has `slug` column; same OG meta pattern as bowler pages |
| SEASN-01 | User can view season page with final standings and points breakdown | Standings query deriving W/L from schedule + scores for seasons XXVI-XXXV; division grouping from seasonDivisions table |
| SEASN-02 | Season page shows division alignment | seasonDivisions table query; conditional rendering — grouped when divisions exist, flat list when they don't |
| SEASN-03 | Season page shows weekly results archive | Week-by-week query joining schedule + scores + bowlers + teams; accordion UI following GameLog pattern |
| SEASN-04 | Season page shows season leaderboards (top averages, high games, high series) | Gender-split leaderboard queries (Men's Scratch, Women's Scratch, Handicap); records queries for high team series, turkeys, 200 games |
| SEASN-05 | Schedule display for current and past seasons | Schedule table query for seasons XXVI-XXXV; integrated into weekly results (played = results, future = schedule) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App Router, static generation, dynamic routes | Already in use, `generateStaticParams` + `dynamicParams = false` pattern established |
| React | 19.2.3 | UI components, `React.cache` for query deduplication | Already in use |
| mssql | 12.2.0 | Azure SQL connection pool with parameterized queries | Already in use via `db.ts` |
| Recharts | 3.7.0 | Line charts (standings race chart, team timeline) | Already in use for `AverageProgressionChart` |
| Tailwind CSS | 4.x | Styling with @theme tokens (cream/navy/red palette) | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fuse.js | 7.1.0 | Client-side fuzzy search (existing) | If team/season search added later — not needed this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts for race chart | D3.js / custom SVG | Recharts is already installed and used. Race chart is a standard multi-line chart with rank-position Y axis — Recharts handles this well. Only consider custom SVG if Recharts can't handle the bump/rank visual cleanly |
| Recharts for team timeline | HTML/CSS grid | A timeline showing which teams existed in which seasons may be better as a styled HTML table/grid than a chart. Recharts is overkill for a categorical presence/absence visualization |

**Installation:**
```bash
# No new packages needed — all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── team/[slug]/page.tsx       # Team profile (new)
│   ├── teams/page.tsx             # Teams directory (replace placeholder)
│   ├── season/[slug]/page.tsx     # Season page (new)
│   └── seasons/page.tsx           # Seasons directory (replace placeholder)
├── components/
│   ├── team/                      # New component directory
│   │   ├── TeamHero.tsx           # Adapted from BowlerHero pattern
│   │   ├── FranchiseHistory.tsx   # Collapsed list (adapted from TeamBreakdown)
│   │   ├── CurrentRoster.tsx      # Simple linked list
│   │   ├── TeamSeasonByseason.tsx # Accordion with expandable bowler rows
│   │   ├── AllTimeRoster.tsx      # Sorted table
│   │   └── HeadToHead.tsx         # Empty state shell
│   └── season/                    # New component directory
│       ├── SeasonHero.tsx         # Adapted from BowlerHero pattern
│       ├── Standings.tsx          # Division-grouped or flat standings table
│       ├── StandingsRaceChart.tsx # Recharts multi-line rank visualization
│       ├── SeasonLeaderboards.tsx # Gender-split top 10 tables + records
│       ├── WeeklyResults.tsx      # Accordion with match-by-match box scores
│       ├── WeeklyAwards.tsx       # BOTW/TOTW aggregation section
│       └── FullStatsTable.tsx     # Sortable stats table by gender
└── lib/
    └── queries.ts                 # ~15-20 new query functions added here
```

### Pattern 1: Static Generation with Slug-Based Routes
**What:** Pre-render all team and season pages at build time using `generateStaticParams` with `dynamicParams = false`
**When to use:** Every new route in this phase
**Example:**
```typescript
// src/app/team/[slug]/page.tsx — follows exact bowler pattern
export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getAllTeamSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const team = await getTeamBySlug(slug); // React.cache wrapped
  // ...
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);
  if (!team) notFound();

  const [roster, seasonStats, allTimeRoster] = await Promise.all([
    getTeamCurrentRoster(team.teamID),
    getTeamSeasonByseason(team.teamID),
    getTeamAllTimeRoster(team.teamID),
  ]);
  // ...
}
```

### Pattern 2: Season Slug Strategy
**What:** Season URLs use display name slug (`/season/fall-2025`) not Roman numeral
**When to use:** Season routes and all cross-links to seasons
**Implementation detail:** The `seasons` table has `displayName` (e.g., "Fall 2025"). Generate slug as `LOWER(REPLACE(displayName, ' ', '-'))`. This needs to be either a computed column in the DB or computed in the query. Since the existing pattern uses a `slug` column on the `bowlers` and `teams` tables, the cleanest approach is to compute it in queries: `LOWER(REPLACE(displayName, ' ', '-')) AS slug`.

### Pattern 3: Parallel Data Fetching
**What:** Use `Promise.all()` to fetch all page data concurrently at build time
**When to use:** Every page component that calls multiple queries
**Why:** Azure SQL cold start is 30-60s. Parallel fetching cuts total build time significantly since the pool is shared.

### Pattern 4: Accordion UI for Expandable Content
**What:** Client component with `useState<Set<number>>` for tracking which items are expanded
**When to use:** Season-by-season team stats (expand to see bowlers), weekly results (expand to see match details)
**Established by:** `GameLog.tsx` — toggle individual sections, expand/collapse all button

### Pattern 5: Conditional Content Tiers
**What:** Render different content depth based on data availability
**When to use:** Season pages (full vs stats-only), team season rows (with/without schedule data)
**Implementation:** Check if `seasonID` maps to a season with schedule data (Seasons XXVI-XXXV, which are seasonID values that need to be queried). For older seasons, render simplified stats-only view with the "file cabinet" message.

### Anti-Patterns to Avoid
- **Raw SQL in components:** All SQL goes in `queries.ts`. Components receive typed data only.
- **Runtime DB queries:** All data fetched at build time. `dynamicParams = false` means no runtime DB hits.
- **Single monolithic query per page:** Split into focused queries and use `Promise.all`. Keeps each query maintainable and allows the DB to execute them in parallel.
- **Hardcoding season IDs for data tier checks:** Query the schedule table to determine which seasons have schedule data, don't hardcode season ID ranges.
- **Assuming points formula is constant:** The XP/points system has changed over the years. Don't compute standings points for historical seasons — only show what's directly in the data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Standings race chart | Custom SVG from scratch | Recharts `LineChart` with rank-position data | Recharts already installed, supports multi-line with custom styling. Transform data to rank positions per week, plot as line chart with inverted Y axis (rank 1 at top) |
| Team timeline | Canvas/SVG timeline | Styled HTML grid/table | A presence/absence grid (teams x seasons) is naturally a table. CSS grid with colored cells for "active" seasons. Simpler, more accessible, naturally responsive |
| Sortable tables | Custom sort implementation | `useState` + `Array.sort()` with sort key/direction state | Client component with sort state. No library needed for simple column sorting of pre-fetched data |
| Roman numeral parsing | Custom parser | Direct from DB — `seasons.romanNumeral` column already stores it | The DB already has the Roman numeral string |
| W/L record derivation | Complex match-by-match logic | Recommend deferring to matchResults population | See "Open Questions" — deriving W/L from schedule+scores is unreliable without knowing the exact match format (how many bowlers per team, which bowlers were "on" each game). Recommend showing team stats without W/L for now |

**Key insight:** The biggest "don't hand-roll" risk in this phase is trying to derive win/loss records from schedule + scores data. The schedule tells us which teams played, and scores tells us individual bowler performances, but computing team W/L requires knowing the match format rules (which bowler counts were used, how ties were broken, etc.) — this is exactly what `matchResults` is supposed to store.

## Common Pitfalls

### Pitfall 1: W/L Derivation Complexity
**What goes wrong:** Attempting to compute team win/loss records from schedule + scores data leads to incorrect results because the matching logic between bowlers and team results is non-trivial.
**Why it happens:** The schedule table shows which teams played each week, but determining who won requires knowing: how many bowlers per team, which games counted, whether it was per-game or total pins, and how ties were resolved. This has changed over 35 seasons.
**How to avoid:** For the initial implementation, show team aggregate stats per season (total pins, games bowled, team average) without W/L columns. Add a "W/L records coming soon" note. When `matchResults` is populated, swap in the real data.
**Warning signs:** Computed W/L records that don't match historical records from the PDFs.

### Pitfall 2: Season Slug Collision
**What goes wrong:** Two seasons could theoretically have the same display name slug (e.g., if there were two "Fall 2025" entries).
**Why it happens:** Unlike the bowlers and teams tables which have a dedicated `slug` column, seasons use `displayName` to generate slugs.
**How to avoid:** Verify uniqueness of `LOWER(REPLACE(displayName, ' ', '-'))` across all 35 seasons. If collisions exist, append the Roman numeral. In practice, each season has a unique "Period Year" combination, so this is very low risk.
**Warning signs:** `generateStaticParams` returning duplicate slugs (Next.js will error at build time).

### Pitfall 3: Build Time Explosion
**What goes wrong:** With 42 teams and 35 seasons, each requiring multiple heavy queries, build time could exceed acceptable limits.
**Why it happens:** Azure SQL free tier has limited concurrent connections. Each page runs 5-10 queries in parallel.
**How to avoid:** Use `React.cache` aggressively for queries shared across pages. Consider that the mssql connection pool (`max: 10`) handles parallelism. Monitor build time after adding the first few pages.
**Warning signs:** Builds taking more than 5 minutes, connection pool exhaustion errors.

### Pitfall 4: Empty Data State Inconsistency
**What goes wrong:** Some sections show "no data" differently from others, creating a jarring user experience.
**Why it happens:** Three tables are empty (`matchResults`, `playoffResults`, `seasonChampions`), and old seasons lack schedule data. Each section needs its own empty state handling.
**How to avoid:** Use the canonical "file cabinet" message consistently. Create a shared `FileCabinetEmpty` component (extends existing `EmptyState`) with the league-voice text. Categorize sections by data dependency: (1) always available from scores, (2) needs schedule data, (3) needs matchResults/champions.
**Warning signs:** Silent missing data (sections that just don't render) vs. explicit empty states.

### Pitfall 5: Gender Data Gaps in Leaderboards
**What goes wrong:** 21 bowlers are missing gender data, which affects Men's Scratch and Women's Scratch leaderboard accuracy.
**Why it happens:** Known data gap (from PROJECT MEMORY).
**How to avoid:** Use `WHERE b.gender = 'M'` / `WHERE b.gender = 'F'` which naturally excludes NULL gender rows. The leaderboards will be correct for bowlers with gender data. This is acceptable — the 21 missing bowlers are likely historical/inactive.
**Warning signs:** Leaderboard totals not matching overall counts.

## Code Examples

### Query: Team Current Roster
```typescript
// Fetches everyone who bowled for this team in the current season
// Follows existing query pattern from queries.ts
export async function getTeamCurrentRoster(teamID: number): Promise<TeamRosterMember[]> {
  const db = await getDb();
  const result = await db.request()
    .input('teamID', teamID)
    .query<TeamRosterMember>(`
      SELECT
        b.bowlerID,
        b.bowlerName,
        b.slug,
        COUNT(sc.scoreID) * 3 AS gamesBowled,
        CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS seasonAverage
      FROM scores sc
      JOIN bowlers b ON sc.bowlerID = b.bowlerID
      WHERE sc.teamID = @teamID
        AND sc.isPenalty = 0
        AND sc.seasonID = (
          SELECT TOP 1 seasonID FROM seasons
          ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
        )
      GROUP BY b.bowlerID, b.bowlerName, b.slug
      ORDER BY gamesBowled DESC, seasonAverage DESC
    `);
  return result.recordset;
}
```

### Query: Season Standings
```typescript
// Season standings showing team stats, grouped by division
export async function getSeasonStandings(seasonID: number): Promise<StandingsRow[]> {
  const db = await getDb();
  const result = await db.request()
    .input('seasonID', seasonID)
    .query<StandingsRow>(`
      SELECT
        t.teamID,
        t.teamName,
        t.slug AS teamSlug,
        sd.divisionName,
        COUNT(DISTINCT sc.bowlerID) AS rosterSize,
        COUNT(sc.scoreID) * 3 AS totalGames,
        SUM(sc.scratchSeries) AS totalPins,
        CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS teamScratchAvg,
        MAX(sc.week) AS weeksPlayed
      FROM scores sc
      JOIN teams t ON sc.teamID = t.teamID
      LEFT JOIN seasonDivisions sd ON sd.seasonID = sc.seasonID AND sd.teamID = sc.teamID
      WHERE sc.seasonID = @seasonID
        AND sc.isPenalty = 0
        AND sc.teamID IS NOT NULL
      GROUP BY t.teamID, t.teamName, t.slug, sd.divisionName
      ORDER BY sd.divisionName, totalPins DESC
    `);
  return result.recordset;
}
```

### Component: Accordion Pattern (from existing GameLog)
```typescript
// Reusable accordion pattern for weekly results, season-by-season, etc.
'use client';
import { useState } from 'react';

export function AccordionSection({ items, renderHeader, renderContent }) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const allOpen = openItems.size === items.length;

  function toggleAll() {
    setOpenItems(allOpen ? new Set() : new Set(items.map(i => i.key)));
  }
  // ... follows GameLog.tsx pattern exactly
}
```

### Season Display Name to Slug
```typescript
// Utility for generating season slugs consistently
function seasonSlug(displayName: string): string {
  return displayName.toLowerCase().replace(/\s+/g, '-');
}
// "Fall 2025" -> "fall-2025"
// "Spring 2024" -> "spring-2024"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js `getStaticPaths` + `getStaticProps` | `generateStaticParams` + async Server Components | Next.js 13+ (App Router) | Already using current approach |
| Recharts 2.x | Recharts 3.7.0 | 2024 | Already on latest — API is stable, same `ResponsiveContainer`/`LineChart` pattern |
| Manual SQL string interpolation | Parameterized queries via `.input()` | Already in use | Safe from SQL injection |

**Deprecated/outdated:**
- None relevant — the project stack is current and the established patterns work well for this phase.

## Open Questions

1. **W/L Record Derivation Feasibility**
   - What we know: Schedule tells us which teams played. Scores tells us individual bowler performance per team per week. The `matchResults` table exists but is empty.
   - What's unclear: Can we reliably determine which team "won" each week from schedule + scores? This requires knowing the match format (per-game wins vs total pins, how many bowlers count, etc.)
   - Recommendation: **Skip W/L derivation for initial launch.** Show team stats (total pins, avg, games) without W/L columns. The user said "attempt to derive... fall back to waiting for matchResults." Given the complexity and risk of showing incorrect records, recommend falling back immediately. Add a "W/L records coming soon" note. This is the safe path that avoids showing wrong data.

2. **Season Slug Uniqueness**
   - What we know: 35 seasons with displayName like "Fall 2025", "Spring 2024". Each season has a unique year + period combination.
   - What's unclear: Whether the `seasons` table already has a `slug` column or if we need to compute slugs.
   - Recommendation: Check if the `teams` table slug pattern should be replicated for seasons (add a slug column) or if computing `LOWER(REPLACE(displayName, ' ', '-'))` in queries is sufficient. For build-time static generation, either works. A column is cleaner long-term.

3. **Standings Points Calculation**
   - What we know: Current system: Wins (2pts/win, 1pt/tie) + XP (top 5 hcp teams get 3pts, next 5 get 2pts, next 5 get 1pt, last 5 get 0). This has changed over the years.
   - What's unclear: Historical points formulas, and whether points data is stored anywhere (scores table? separate table?).
   - Recommendation: Show standings ordered by derivable stats (total pins, team average) for now. Don't attempt to compute points. When `matchResults` is populated, it likely includes points data. This is explicitly deferred by the user.

4. **Team Name History Dates**
   - What we know: `teamNameHistory` table exists but dates are not yet populated. User will upload when ready.
   - What's unclear: Table schema (does it have date columns that are NULL, or no date columns at all?).
   - Recommendation: Build the franchise history UI to show team names. If date columns exist, display them when non-NULL. If not, show names as an unordered list. This aligns with the user decision to "build the structure, populate later."

5. **Sortable Stats Tables**
   - What we know: User wants "full sortable stats table for every bowler who bowled that season" below leaderboards.
   - What's unclear: Whether client-side sort is sufficient or if the data volume (40+ bowlers per season) warrants anything more.
   - Recommendation: Client-side sorting with `useState` for sort column/direction. 40 bowlers is trivially sortable in the browser. No library needed.

## Data Dependency Map

Understanding which sections depend on which data sources is critical for this phase:

### Always Available (from `scores` + `bowlers` + `teams` tables)
- Team current roster (bowlers with scores for this team in current season)
- Team season-by-season stats (aggregate pins, games, averages per season)
- Team all-time roster summary (lifetime stats per bowler for this team)
- Season leaderboards (top averages, high games, high series — gender-split)
- Season full stats tables (all bowlers with their stats)
- Season aggregate stats (total games, bowlers, league average)

### Requires Schedule Data (Seasons XXVI-XXXV only, 846 rows)
- Weekly results with matchups (which teams played each other)
- Opponent display in match results
- Schedule display (future weeks)
- Match dates

### Requires Empty Tables (build shell, show empty state)
- `matchResults`: W/L records, standings points, head-to-head records
- `playoffResults`: Playoff brackets and results
- `seasonChampions`: Champion display on season and team pages

### Requires `seasonDivisions` Table
- Division-grouped standings (need to verify this table's schema and population)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/lib/queries.ts`, `src/app/bowler/[slug]/page.tsx`, all `src/components/bowler/*.tsx` — verified patterns by reading source files
- `package.json` — confirmed versions: Next.js 16.1.6, React 19.2.3, Recharts 3.7.0, mssql 12.2.0
- `.planning/phases/04-teams-and-seasons/04-CONTEXT.md` — user decisions
- `.planning/REQUIREMENTS.md` — requirement definitions for TEAM-01 through SEASN-05
- `.planning/STATE.md` — project state showing Phases 1-3 complete
- Project memory — data gaps (matchResults/playoffResults/seasonChampions empty, 21 bowlers missing gender, schedule data only XXVI-XXXV)

### Secondary (MEDIUM confidence)
- DB table existence inferred from existing queries (teams, teamNameHistory, teamRosters, seasons, schedule, scores, seasonDivisions) — actual column schemas not directly verified against DB, but query patterns confirm key columns
- PDF reference documents mentioned in CONTEXT.md (could not be read due to missing poppler dependency) — user confirmed standings format includes div/rank/total/wins/XP/scratch avg/hcp avg

### Tertiary (LOW confidence)
- `seasonDivisions` table schema — referenced in CONTEXT.md integration points but no existing query uses it. Need to verify column names when writing queries
- `teamNameHistory` table schema — referenced but no existing query uses it. Schema needs verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies needed
- Architecture: HIGH - follows established patterns from Phases 2-3 exactly
- Pitfalls: HIGH - based on known data gaps documented in project memory and CONTEXT.md
- Query design: MEDIUM - example queries follow existing patterns but need DB schema verification for new tables (seasonDivisions, teamNameHistory)
- W/L derivation: LOW - explicitly marked as uncertain; recommendation is to defer

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable — no external dependencies changing)
