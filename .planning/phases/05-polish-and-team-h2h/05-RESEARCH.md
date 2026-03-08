# Phase 5: Polish and Team H2H - Research

**Researched:** 2026-03-08
**Domain:** Next.js UI polish, SQL query design, client-side expand/collapse patterns
**Confidence:** HIGH

## Summary

Phase 5 is a focused polish phase with one significant new feature (Team H2H) and several targeted UI improvements. The codebase is mature with well-established patterns -- every change in this phase follows existing conventions rather than introducing new ones.

The Team H2H feature is the largest piece of work. It requires a new SQL query joining `matchResults` and `schedule` tables (both already used extensively in standings/race chart queries), a new TypeScript interface, and replacing the existing `HeadToHead.tsx` placeholder component. The UI pattern (summary table with expandable drill-down rows) mirrors the existing `GameLog.tsx` accordion pattern.

The remaining items are surgical: add a `weekNumber` prop to `Standings.tsx`, add losses to `TeamCurrentStanding` interface/query, add show/collapse to `SeasonStatsTable.tsx`, and verify `ParallaxBg.tsx` on mobile.

**Primary recommendation:** Build the H2H query first (it's the riskiest piece -- touching Azure SQL), then wire up the UI. Polish items are independent and can be done in any order.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Match Results Legend: Dropped -- green/red/amber color coding is self-explanatory, no legend needed
- Team H2H Summary Table: One row per opponent with W, L, T, win%. Sorted by most matchups first. Opponent names link to team pages. "Have not yet faced each other" list for active teams only.
- Team H2H Drill-Down Detail: Click row to expand. Each meeting shows date, season, week, W/L result (color coded green/amber/navy), both teams' hcp series totals. Links to weekly results page. Flat list, reverse chronological. No aggregate record above table.
- TeamHero Standing Card: Rank (#2 of 8), division name, full W-L record, XP, total pts. Link to league nights page.
- Bowler Profile Season Stats: Show only 3 most recent seasons by default, "Show all X seasons" expander, career totals always visible.
- Bowler Profile Game Log: Keep as-is.

### Claude's Discretion
- Standings week number display format ("after Wk 3" or similar)
- Mobile parallax verification approach
- H2H drill-down visual treatment and expand/collapse animation
- Season stats "show all" button styling
- Exact spacing and responsive adaptations

### Deferred Ideas (OUT OF SCOPE)
- Team logos -- future phase
- Merging season stats into game log accordion -- decided against
</user_constraints>

## Standard Stack

### Core (already in project)
| Library | Purpose | Notes |
|---------|---------|-------|
| Next.js 15 | Framework | Static generation, `dynamicParams=false` |
| React 19 | UI | `useState` for expand/collapse, `cache` for query dedup |
| Tailwind CSS | Styling | All styling via utility classes, no CSS modules |
| mssql (tedious) | Azure SQL | Via `cachedQuery()` wrapper with disk cache |

### Supporting
| Library | Purpose | Notes |
|---------|---------|-------|
| `@/lib/score-utils` | `scoreColorClass`, `seriesColorClass` | Reuse for color coding |
| `@/components/ui/SectionHeading` | Section headers | Standard across all pages |
| `@/components/ui/EmptyState` | No-data states | Used in current HeadToHead placeholder |

### No New Dependencies
This phase requires zero new npm packages. Everything needed is already in the project.

## Architecture Patterns

### Query Pattern (established)
All SQL lives in `src/lib/queries/*.ts`. Each query function:
1. Returns a typed interface
2. Wraps in `cachedQuery()` for disk-based build cache
3. Uses parameterized queries (`@teamID`, `@seasonID`)
4. Joins `matchResults` via `schedule` using `scheduleID`

```typescript
// Pattern from existing code (teams.ts, seasons.ts)
export async function getTeamH2H(teamID: number): Promise<TeamH2HRow[]> {
  return cachedQuery(`getTeamH2H-${teamID}`, async () => {
    const db = await getDb();
    const result = await db.request().input('teamID', teamID)
      .query<TeamH2HRow>(`...`);
    return result.recordset;
  }, []);
}
```

### Client Component Pattern (for expand/collapse)
Established in `GameLog.tsx`:
- `'use client'` directive at top
- `useState<Set<number>>` for tracking open items
- Toggle function that creates new Set (immutable update)
- Conditional rendering based on Set membership

```typescript
// Pattern from GameLog.tsx
const [openItems, setOpenItems] = useState<Set<number>>(new Set());
function toggle(id: number) {
  setOpenItems(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
}
```

### Color Coding Pattern
From `WeeklyResults.tsx` -- the `gameWinClass()` function:
```typescript
function gameWinClass(myScore: number | null, oppScore: number | null): string {
  if (myScore == null || oppScore == null) return '';
  if (myScore > oppScore) return 'text-green-600 font-semibold';
  if (myScore < oppScore) return 'text-navy/65';
  return 'text-amber-600'; // tie
}
```
For H2H drill-down, adapt for match-level W/L: compare `team1GamePts` totals.

### Static Generation Pattern
Team page (`src/app/team/[slug]/page.tsx`):
- Fetches all data in parallel with `Promise.all()`
- Passes data down as props to child components
- H2H data will be added to this parallel fetch

### Anti-Patterns to Avoid
- **Raw SQL in components** -- always in `src/lib/queries/`
- **Runtime DB queries** -- everything is build-time static
- **CSS modules or inline styles** -- Tailwind only
- **Mutable state updates** -- always create new Set/object

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Win/loss color coding | New color function | Adapt existing `gameWinClass()` | Consistency with weekly results page |
| Expand/collapse UI | Custom accordion | Follow `GameLog.tsx` pattern | Same visual language, proven pattern |
| Query caching | Custom cache | `cachedQuery()` wrapper | Handles disk persistence, versioning |
| Section headings | Custom h2/h3 | `<SectionHeading>` component | Design system consistency |

## Common Pitfalls

### Pitfall 1: H2H Query Must Handle Both Positions
**What goes wrong:** Team can be either `team1ID` or `team2ID` in the schedule table.
**Why it happens:** Schedule assigns home/away arbitrarily.
**How to avoid:** Use `UNION ALL` to unpivot, same pattern as standings `teamPtsUnpivot` CTE. Query must check both `sch.team1ID = @teamID` and `sch.team2ID = @teamID`.

### Pitfall 2: Losses Not in Current Standing Query
**What goes wrong:** `TeamCurrentStanding` interface has `wins` but not `losses`.
**Why it happens:** Original design only showed wins.
**How to avoid:** The query already computes `gamePts` -- losses can be derived. Each team plays `(maxWeek * 3)` total games. Alternatively, add a `losses` column to the CTE: `SUM(CASE WHEN gamePts = 0 THEN 1 ELSE 0 END)` style computation, but simpler: compute total match weeks and subtract wins. Or: add a `totalMatchWeeks` and calculate: `losses = totalMatchWeeks - wins - ties`.

Actually, the clearest approach: `gamePts / 2 = wins` (already done). Each matchup has 3 games (6 total gamePts pool). For the team: `3 - wins` gives losses per week if no ties, but ties exist. Better: track `SUM(gamePts)` total and `COUNT(*)` total match weeks, then `losses = (matchWeeks * 3) - wins` only works if no ties. Correct approach: track individual game results.

Simplest correct approach for the standing card: just show W-L as `wins - (totalGamesPlayed - wins - ties)`. The existing query gets `wins = gamePts / 2`. To get losses, add to the CTE: count weeks, compute `(weeks * 3 - wins * 2 - ties) / 2` as losses. Or more directly: add a `losses` computed column using `SUM(CASE WHEN gamePt = 0 THEN 1 ELSE 0 END)` on individual game point rows.

**Recommended:** Modify `getTeamCurrentStanding` to also return `losses` -- count game points of 0 from the unpivoted view.

### Pitfall 3: Ghost Team in H2H
**What goes wrong:** Ghost Team (teamID for forfeits) appears as an opponent in matchResults.
**Why it happens:** Forfeit matchups are recorded against the Ghost Team.
**How to avoid:** Include Ghost Team in H2H results -- it's a real opponent. The user has a Ghost Team explainer page already. No special filtering needed.

### Pitfall 4: "Not Yet Faced" List Requires Active Team Check
**What goes wrong:** Listing ALL teams they haven't played, including defunct teams.
**Why it happens:** `teams` table includes historical teams.
**How to avoid:** Per CONTEXT.md: only show "not yet faced" for currently active teams. Use same `isActive` check from `getAllTeamsDirectory` -- team has scores in the current season.

### Pitfall 5: SeasonStatsTable is Server Component
**What goes wrong:** Adding `useState` to `SeasonStatsTable.tsx` breaks it.
**Why it happens:** It currently has no `'use client'` directive -- it's a server component.
**How to avoid:** Add `'use client'` directive when adding the expand/collapse behavior. Or: split into a wrapper client component that controls visibility, passing seasons as props.

### Pitfall 6: Azure SQL Cold Start on Dev
**What goes wrong:** New H2H query times out during dev.
**Why it happens:** Azure SQL serverless has 30-60s cold start.
**How to avoid:** Use `next dev` (on-demand rendering, not full build). Test with a single team page load. The `connectTimeout` in `db.ts` already handles this.

## Code Examples

### H2H Summary Query Design
```sql
-- Get all matchups for a specific team, aggregated by opponent
WITH matchups AS (
  -- When our team is team1
  SELECT
    sch.team2ID AS opponentID,
    sch.seasonID,
    sch.week,
    sch.matchDate,
    mr.team1GamePts AS ourGamePts,
    mr.team2GamePts AS theirGamePts,
    mr.team1BonusPts AS ourBonusPts,
    mr.team2BonusPts AS theirBonusPts,
    mr.team1Series AS ourSeries,
    mr.team2Series AS theirSeries
  FROM matchResults mr
  JOIN schedule sch ON mr.scheduleID = sch.scheduleID
  WHERE sch.team1ID = @teamID
  UNION ALL
  -- When our team is team2
  SELECT
    sch.team1ID AS opponentID,
    sch.seasonID,
    sch.week,
    sch.matchDate,
    mr.team2GamePts AS ourGamePts,
    mr.team1GamePts AS theirGamePts,
    mr.team2BonusPts AS ourBonusPts,
    mr.team1BonusPts AS theirBonusPts,
    mr.team2Series AS ourSeries,
    mr.team1Series AS theirSeries
  FROM matchResults mr
  JOIN schedule sch ON mr.scheduleID = sch.scheduleID
  WHERE sch.team2ID = @teamID
)
-- Summary: aggregate by opponent
SELECT
  m.opponentID,
  COALESCE(tnh_latest.teamName, t.teamName) AS opponentName,
  t.slug AS opponentSlug,
  COUNT(*) AS matchups,
  SUM(CASE WHEN m.ourGamePts > m.theirGamePts THEN 1 ELSE 0 END) AS wins,
  SUM(CASE WHEN m.ourGamePts < m.theirGamePts THEN 1 ELSE 0 END) AS losses,
  SUM(CASE WHEN m.ourGamePts = m.theirGamePts THEN 1 ELSE 0 END) AS ties
FROM matchups m
JOIN teams t ON m.opponentID = t.teamID
-- Get current name for opponent
OUTER APPLY (
  SELECT TOP 1 tnh.teamName
  FROM teamNameHistory tnh
  JOIN seasons sn ON tnh.seasonID = sn.seasonID
  WHERE tnh.teamID = m.opponentID
  ORDER BY sn.year DESC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END DESC
) tnh_latest
GROUP BY m.opponentID, COALESCE(tnh_latest.teamName, t.teamName), t.slug
ORDER BY COUNT(*) DESC
```

### H2H Detail Query (per opponent)
```sql
-- Detail matchups for team vs specific opponent
-- Same matchups CTE as above, filtered by opponentID
SELECT
  m.seasonID,
  sn.displayName AS seasonName,
  LOWER(REPLACE(sn.displayName, ' ', '-')) AS seasonSlug,
  m.week,
  m.matchDate,
  m.ourGamePts,
  m.theirGamePts,
  m.ourSeries,
  m.theirSeries
FROM matchups m
JOIN seasons sn ON m.seasonID = sn.seasonID
ORDER BY sn.year DESC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END DESC, m.week DESC
```

**Key decision:** Fetch ALL detail data at build time (not on-demand) since this is a static site. One query per team that returns both summary and detail data is most efficient. Alternatively, one query returns all matchup rows, and the component groups/aggregates client-side.

**Recommended approach:** Single query returning all matchup rows (flat list). The component does the grouping:
1. Group by opponentID to build summary (count wins/losses/ties)
2. Group by opponentID for drill-down detail (individual matchups)
3. This avoids two separate DB queries and keeps logic in TypeScript

### Standings Week Number
```typescript
// In Standings component, add weekNumber prop
interface Props {
  standings: StandingsRow[];
  hasDivisions: boolean;
  playoffTeams?: Set<number> | null;
  seasonID?: number;
  weekNumber?: number | null;  // NEW
}

// In the heading:
<SectionHeading>
  Standings{weekNumber ? ` (after Wk ${weekNumber})` : ''}
</SectionHeading>
```

The `maxWeek` is already computed in `getSeasonStandings` CTE -- it just needs to be surfaced. Options:
1. Add it to `StandingsRow` (wasteful -- same value repeated per row)
2. Create separate tiny query `getStandingsWeekNumber(seasonID)`
3. Compute from the `matchResults`/`schedule` join in the page component

**Recommended:** Option 3 -- the season page already computes `maxScoreWeek` and `maxScheduleWeek` for the week list. Pass `totalWeeks` (which equals the standings week number for current season) as a prop to `Standings`.

### SeasonStatsTable Collapse Pattern
```typescript
'use client';
// Add to SeasonStatsTable.tsx
const INITIAL_VISIBLE = 3;
const [showAll, setShowAll] = useState(false);

// Seasons arrive newest-first. Show only first 3 unless expanded.
const visibleSeasons = showAll ? seasons : seasons.slice(0, INITIAL_VISIBLE);
const hiddenCount = seasons.length - INITIAL_VISIBLE;

// Career totals row always renders (outside the sliced array)
// "Show all X seasons" button between last visible row and career totals
```

### TeamHero Standing Card Updates
```typescript
// Current: {currentStanding.wins}W
// Updated: {currentStanding.wins}W-{currentStanding.losses}L
// Also link to league nights (current season) instead of standings
```

The `TeamCurrentStanding` interface needs a `losses` field. The existing `getTeamCurrentStanding` query's `teamPtsUnpivot` CTE already has per-game-point data. Add:
```sql
-- In teamWinsXP CTE:
CAST(SUM(gamePts) AS DECIMAL(5,1)) / 2 AS wins,
-- Losses: games where team got 0 points for that game
SUM(CASE WHEN gamePts = 0 THEN 1 ELSE 0 END) AS losses,
```

Wait -- `gamePts` is already aggregated. Looking at the CTE more carefully: `team1GamePts` and `team2GamePts` are total game points per matchup (0-6 scale, where each game win = 2 pts). So `wins = gamePts / 2`. For losses we need the per-game granularity which isn't in the current CTE.

Actually, each matchup week: each team gets `gamePts` (0-6, divisible by 2 since each game is 2 or 0). `gamePts / 2` = games won that week (0-3). `(6 - gamePts) / 2` = games lost + opponent won. But ties exist (1 pt each, so gamePts can be 1).

Looking at the data: `team1GamePts + team2GamePts = 6` always (3 games, 2 pts each). So losses for team = `(6 * matchWeeks - totalGamePts) / 2`. Simpler: `(3 * matchWeeks) - wins`. This works because wins + losses = 3 per week (ties count as 0.5W + 0.5L in the gamePts system -- each tied game gives 1 pt to each team).

So: just count the number of matchup weeks and compute `losses = (3 * weeks) - wins`.

## State of the Art

No technology changes needed. This phase uses the same stack, patterns, and conventions established in Phases 1-4.

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| HeadToHead placeholder | Real H2H data from matchResults | Completes TEAM-03 requirement |
| Server-only SeasonStatsTable | Client component with collapse | Improves UX for long-career bowlers |

## Open Questions

1. **H2H: Single query vs two queries?**
   - Recommendation: Single query returning all flat matchup rows. Component groups into summary + detail. Simpler, one DB round-trip, works well with `cachedQuery`.

2. **Week number source for Standings**
   - The season page already computes `totalWeeks`. Just pass it as a prop to `<Standings>`.
   - For the home page `MiniStandings`, might need a separate approach (or just skip week number there -- it's a mini view).

3. **Mobile parallax -- what counts as "verified"?**
   - ParallaxBg already has mobile path implemented. Verification = test on iOS Safari and Android Chrome.
   - If it works, no code changes needed. If not, debug the existing `MobileParallax` component.
   - Recommendation: Load a team/bowler page with parallax hero on a real phone, check visually.

## Sources

### Primary (HIGH confidence)
- Codebase analysis of all referenced components and queries
- `src/lib/queries/teams.ts` -- TeamCurrentStanding query, established patterns
- `src/lib/queries/seasons.ts` -- matchResults/schedule join patterns, StandingsRow interface
- `src/components/bowler/GameLog.tsx` -- expand/collapse accordion pattern
- `src/components/season/WeeklyResults.tsx` -- `gameWinClass()` color coding
- `src/components/ui/ParallaxBg.tsx` -- mobile parallax implementation
- `src/app/team/[slug]/page.tsx` -- team page data fetching pattern
- `src/components/season/Standings.tsx` -- current standings implementation
- `src/components/bowler/SeasonStatsTable.tsx` -- current server component

### Data
- `matchResults` table: 786 rows across 10 seasons (Seasons XXVI-XXXV)
- `schedule` table: contains `scheduleID`, `seasonID`, `week`, `matchDate`, `team1ID`, `team2ID`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new deps, all established
- Architecture: HIGH -- follows existing patterns exactly
- Pitfalls: HIGH -- identified from direct codebase analysis
- H2H query design: HIGH -- based on existing matchResults query patterns in codebase

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable -- no external dependencies changing)
