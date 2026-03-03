# Phase 3: Search and Home Page - Research

**Researched:** 2026-03-02
**Domain:** Next.js static site — home page hub, client-side search, build-time data queries, placeholder pages
**Confidence:** HIGH

## Summary

Phase 3 transforms the current placeholder home page into a hub with multiple entry points: a discovery search bar, a milestone ticker, a countdown to the next bowling night, and current season snapshot. It also creates the bowler directory page at `/bowlers`, placeholder pages for `/teams`, `/seasons`, `/leaderboards`, and a `/resources` quick links page.

The technical domain is well-understood because the project already has all the foundational patterns in place: Fuse.js search with autocomplete (SearchBar.tsx), build-time static generation, all SQL in queries.ts, and the Tailwind v4 design system. The work is primarily UI composition and new SQL queries — no new libraries are needed beyond what's already installed. The discovery search enhancement (category prompts before typing) and the countdown clock are the two most architecturally interesting pieces.

**Primary recommendation:** Build on the existing SearchBar.tsx pattern for the discovery search, add 3-4 new queries to queries.ts for milestone/countdown/snapshot data, and create simple static pages for all the placeholder routes. No new dependencies required.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Primary Audience:** Current bowlers are the main audience — they're the ones checking the site regularly
- **Home Page Hero:** Hub with multiple entry points, not a single-purpose search page. Stats-forward personality with one big beautiful league photo as the emotional anchor. Clear paths for different visitors: "Find your bowler" (search), "This week's results" (latest blog/recap), browse teams, check leaderboards. Newcomer paths to About and Join visible but not dominating.
- **Discovery Search (Home Page Only):** Home page search bar acts as a discovery hub — clicking into it shows category prompts (Bowlers, Teams, Seasons, Leaderboards) before the user types anything. Once typing starts, switches to fuzzy search results (existing Fuse.js behavior). Header SearchBar stays simple — no category prompts, just the existing text search.
- **Bowler Directory:** Browse page at /bowlers — alphabetical listing of all 619 bowlers
- **League Snapshot Content:** Quick stats ticker shows upcoming milestones and recently achieved milestones (not static totals like "619 bowlers"). Current season section: placeholder for now — standings, individual playoff rankings, season records/best nights will populate once matchResults data is backfilled.
- **Countdown:** Days and hours countdown to next bowling night. Off-season: switch to season wrap-up stats. Unknown next date: league-voice humor. Schedule data exists for Seasons XXVI-XXXV (846 rows).
- **Placeholder Pages:** Teams, Seasons, Leaderboards links work now, navigate to placeholder pages with league-voice personality.
- **Quick Links / Resources Page:** Dedicated page for operational links bowlers are always hunting for. Surfaced from home page and navigation. Actual URLs to be provided later — build the structure now.
- **Photos:** 1-2 good league photos on the landing page for now — no gallery. Instagram link in footer (not embedded feed).

### Claude's Discretion
- Home page layout and section ordering
- Photo placement and overlay treatment
- Discovery search prompt design and interaction
- Countdown visual treatment (make it look good, not cheesy)
- Milestone ticker format and animation
- Placeholder page layout and styling
- Quick links page display format
- Mobile responsive adaptations for all new components

### Deferred Ideas (OUT OF SCOPE)
- Full Instagram photo integration (embedded feed, API pull) — future enhancement, just footer link for now
- Season standings from matchResults — data backfill needed, placeholder for now
- Individual playoff rankings — data backfill needed, placeholder for now
- Team pages with full content — Phase 4
- Season pages with full content — Phase 4
- Blog system for weekly recaps — Phase 6 (but home page will link to latest post once it exists)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SRCH-01 | User can search for bowlers from prominent search bar on home page | Existing SearchBar.tsx + Fuse.js pattern; create DiscoverySearch variant for home page with category prompts |
| SRCH-02 | Search includes autocomplete with fuzzy matching and name variant handling | Already implemented — Fuse.js with threshold 0.3, minMatchCharLength 2, keyboard nav, ARIA. Works as-is. |
| HOME-01 | Home page with league branding and Metrograph-inspired design | Rebuild src/app/page.tsx as hub with hero photo, search, sections. Use existing DM Serif Display + Inter + cream/navy/red palette. |
| HOME-02 | Prominent bowler search bar front and center | DiscoverySearch component on home page — larger, centered, with category prompts on focus |
| HOME-03 | Current season snapshot (standings, recent results) | New query for latest season info; placeholder content until matchResults backfill. Show what data IS available (top averages, high games from scores table). |
| HOME-04 | Countdown clock to next bowling night | Client component using schedule table data. New query getNextBowlingNight(). Client-side countdown with useEffect interval. |
| HOME-05 | Quick stats ticker (total bowlers, total games, league since 2007) | Per CONTEXT.md: milestones not static totals. New query for recent/upcoming milestones. Ticker component with CSS animation. |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App Router, static generation, file-based routing | Project framework |
| React | 19.2.3 | UI components | Project framework |
| Fuse.js | 7.1.0 | Client-side fuzzy search | Already powering SearchBar.tsx |
| Tailwind CSS | v4 | Styling with @theme tokens | Project design system |
| mssql | 12.2.0 | Azure SQL queries at build time | Project data layer |

### Supporting (No New Installs Needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/font/google | built-in | DM Serif Display + Inter | Already configured in layout.tsx |
| next/image | built-in | Optimized image loading | League hero photo(s) |
| React.cache | built-in | Deduplicate server queries | Wrap new queries used by both generateMetadata and page |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS animation for ticker | framer-motion | Overkill for a simple ticker scroll. CSS keyframes are sufficient and zero-bundle-cost. |
| setInterval for countdown | date-fns + useEffect | date-fns would add a dependency for date math that can be done with plain JS Date. Not needed. |
| New search library | Keep Fuse.js | Fuse.js already works. No reason to switch. |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── page.tsx                    # Home page (REBUILD - hub layout)
│   ├── bowlers/
│   │   └── page.tsx                # NEW - bowler directory (alphabetical listing)
│   ├── teams/
│   │   └── page.tsx                # NEW - placeholder page
│   ├── seasons/
│   │   └── page.tsx                # NEW - placeholder page
│   ├── leaderboards/
│   │   └── page.tsx                # NEW - placeholder page
│   └── resources/
│       └── page.tsx                # NEW - quick links page
├── components/
│   ├── home/
│   │   ├── DiscoverySearch.tsx     # NEW - home page search with category prompts
│   │   ├── CountdownClock.tsx      # NEW - client component, days/hours to next night
│   │   ├── MilestoneTicker.tsx     # NEW - scrolling milestone ticker
│   │   └── SeasonSnapshot.tsx      # NEW - current season placeholder/preview
│   └── layout/
│       ├── SearchBar.tsx           # UNCHANGED - header search stays simple
│       ├── Header.tsx              # MINOR UPDATE - add Resources nav link
│       └── Footer.tsx              # MINOR UPDATE - add Instagram link
├── lib/
│   ├── queries.ts                  # ADD new queries for milestones, countdown, snapshot, bowler directory
│   └── search-index.ts            # UNCHANGED
```

### Pattern 1: Discovery Search (Two-Mode Component)
**What:** A search component that shows category prompts (Bowlers, Teams, Seasons, Leaderboards) when focused but empty, then switches to Fuse.js fuzzy results when the user types.
**When to use:** Home page only. Header SearchBar stays as-is.
**Architecture:**
```typescript
// DiscoverySearch.tsx — 'use client'
// State machine: IDLE -> BROWSING (focused, empty) -> SEARCHING (typing)
// BROWSING: show category cards/links (Bowlers, Teams, Seasons, Leaderboards)
// SEARCHING: show Fuse.js results (reuse same logic as SearchBar.tsx)
// Can share the Fuse instance and search index loading with SearchBar
// Or more simply: load search index independently (it's a small static JSON)
```
**Key decisions:**
- DiscoverySearch is a separate component from SearchBar (different UX, different size, different context)
- But it reuses the same `/api/search-index` endpoint and Fuse.js configuration
- Category prompts are static links (not search queries) — they navigate to /bowlers, /teams, /seasons, /leaderboards
- Larger visual treatment: bigger input, more prominent placement, potentially with a decorative background

### Pattern 2: Build-Time Data for Home Page
**What:** Home page data (milestones, countdown date, season snapshot) is fetched at build time via queries.ts, passed as props to server components, then hydrated client-side only for the countdown timer.
**When to use:** All home page data sections.
**Architecture:**
```typescript
// src/app/page.tsx (server component)
export default async function Home() {
  const nextBowlingNight = await getNextBowlingNight();
  const milestones = await getRecentMilestones();
  const seasonSnapshot = await getCurrentSeasonSnapshot();
  const allBowlers = await getAllBowlersForDirectory(); // for bowler count, etc.

  return (
    <>
      <HeroSection />
      <DiscoverySearch />
      <MilestoneTicker milestones={milestones} />
      <CountdownClock targetDate={nextBowlingNight} />
      <SeasonSnapshot data={seasonSnapshot} />
    </>
  );
}
```
**Key insight:** The countdown clock receives the target date as a serialized string prop from the server component. The client component handles the live countdown via `useEffect` + `setInterval`. This means the countdown works even though the site is statically generated — the target date is baked in at build time, and the client calculates the remaining time dynamically.

### Pattern 3: Bowler Directory as Static Page
**What:** `/bowlers` page showing all 619 bowlers in an alphabetical grid/list with links to profiles.
**When to use:** Bowler directory page.
**Architecture:**
```typescript
// src/app/bowlers/page.tsx (server component)
// Query all bowlers at build time, render as static HTML
// Group by first letter for easy scanning
// Each bowler links to /bowler/[slug]
// Include seasons active count for context
// Reuse data from search-index query or write a dedicated query
```

### Pattern 4: Placeholder Pages with Personality
**What:** Static pages at /teams, /seasons, /leaderboards with league-voice humor instead of generic "Coming Soon."
**When to use:** Routes that exist in nav but don't have full content yet.
**Architecture:**
```typescript
// Simple server components, no data fetching needed
// Each gets unique personality text per CONTEXT.md decisions
// Can use EmptyState component as a base or create a PlaceholderPage component
// Include generateMetadata for proper OG tags
```

### Anti-Patterns to Avoid
- **Don't make DiscoverySearch a wrapper around SearchBar:** They have fundamentally different UX. DiscoverySearch has category prompts, is larger, and is home-page-only. Build it as a separate component that shares the search index data pattern but not the component tree.
- **Don't fetch countdown data client-side:** The next bowling night date should be baked in at build time. Only the countdown timer logic (calculating remaining days/hours) runs client-side.
- **Don't put milestone calculations in the component:** All SQL stays in queries.ts. The milestone query should return pre-computed milestones, not raw data for the component to process.
- **Don't create API routes for home page data:** This is a static site. Use server components that call queries.ts directly at build time.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy search | Custom string matching | Fuse.js (already installed) | Handles typos, partial matches, scoring. Already proven in SearchBar. |
| Date countdown math | Manual date subtraction | Plain JS Date arithmetic | Simple enough for days/hours. No library needed, but don't hand-roll timezone logic — use UTC or build-time local. |
| Ticker animation | JavaScript-driven animation | CSS `@keyframes` + `animation` | Smoother, no JS overhead, works with reduced-motion media query. |
| Alphabetical grouping | Manual sort/group | `Array.reduce()` to group by first letter | Standard JS pattern, no library needed. |

**Key insight:** This phase introduces no new problem domains that require new libraries. The complexity is in UI composition and SQL queries, not in novel technical challenges.

## Common Pitfalls

### Pitfall 1: Countdown Clock Hydration Mismatch
**What goes wrong:** Server renders "5 days 3 hours" but client hydrates with "5 days 2 hours 59 minutes" because time passed between build and page load. React throws a hydration mismatch warning.
**Why it happens:** Static generation bakes in a specific time, but the client calculates from the current time.
**How to avoid:** Render a static fallback on the server (e.g., just the target date text), then use `useEffect` to start the live countdown only after hydration. Alternatively, use `suppressHydrationWarning` on the countdown element.
**Warning signs:** Console warnings about text content mismatch during development.

### Pitfall 2: Discovery Search Focus/Blur Race Condition
**What goes wrong:** Clicking a category prompt in the dropdown causes the input to blur, which closes the dropdown before the click registers.
**Why it happens:** The `blur` event fires before `click`. This is the same issue already solved in SearchBar.tsx with `onMouseDown` + `e.preventDefault()`.
**How to avoid:** Use `onMouseDown` with `e.preventDefault()` for dropdown interactions (same pattern as existing SearchBar.tsx line 144).
**Warning signs:** Dropdown items that work with keyboard but not mouse clicks.

### Pitfall 3: Milestone Query Performance
**What goes wrong:** Complex milestone queries (approaching 100 career games, just hit first 200+ game, etc.) run slow on Azure SQL serverless cold starts, causing build timeouts.
**Why it happens:** Milestone calculations scan large portions of the scores table (22,817 rows) with multiple subqueries.
**How to avoid:** Design milestone queries to be efficient — use pre-computed values from views where possible. Consider caching the milestone query result with React.cache. Keep the milestone list small (5-10 items, not exhaustive).
**Warning signs:** Build times exceeding 2 minutes for the home page.

### Pitfall 4: Schedule Data Gaps for Countdown
**What goes wrong:** Schedule data only exists for Seasons XXVI-XXXV. If the current season has no schedule data, the countdown query returns null and the component needs a fallback.
**Why it happens:** Historical data gap — not all seasons have matchDate entries.
**How to avoid:** The query should find the next matchDate that is >= today. If none exists, return null. The component must handle null gracefully with the league-voice humor fallback ("We honestly don't know when the next bowling night is...").
**Warning signs:** Countdown showing "NaN days" or crashing on null date.

### Pitfall 5: Home Page Layout Becoming a Scroll Monster
**What goes wrong:** Too many sections stacked vertically makes the home page feel endless and unfocused.
**Why it happens:** Each requirement (search, snapshot, countdown, ticker, navigation paths) gets its own full-width section.
**How to avoid:** Use a grid layout with cards for secondary content. Hero + search gets the full-width hero treatment. Countdown, snapshot, and milestone ticker can be arranged in a 2-3 column grid on desktop. Keep the page to roughly 1.5 viewport heights on desktop.
**Warning signs:** More than 4 full-width sections stacked vertically.

## Code Examples

### New Query: getNextBowlingNight
```typescript
// Add to src/lib/queries.ts
// Returns the next scheduled match date from the schedule table
// Returns null if no future dates exist (off-season or data gap)
export async function getNextBowlingNight(): Promise<string | null> {
  if (!process.env.AZURE_SQL_SERVER) return null;
  try {
    const db = await getDb();
    const result = await db.request().query<{ matchDate: Date }>(`
      SELECT TOP 1 matchDate
      FROM schedule
      WHERE matchDate >= CAST(GETDATE() AS DATE)
      ORDER BY matchDate ASC
    `);
    // Return ISO string for serialization to client component
    return result.recordset[0]?.matchDate?.toISOString() ?? null;
  } catch (err) {
    console.warn('getNextBowlingNight: DB unavailable', err);
    return null;
  }
}
```

### New Query: Milestone Data (Conceptual)
```typescript
// Add to src/lib/queries.ts
// Returns recent and upcoming milestones for the ticker
// "Recent" = achieved in the last N weeks
// "Upcoming" = within X games/pins of a threshold
export interface Milestone {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  type: 'achieved' | 'approaching';
  milestone: string; // e.g., "100 career games", "first 200+ game"
  value: number;
  threshold: number;
}

// Milestone thresholds to check:
// - Career games: 50, 100, 150, 200, 250, 300, 400, 500
// - Career average crossing: 150, 160, 170, 180, 190, 200
// - Total 200+ games: 10, 25, 50, 100
// - Total 600+ series: 5, 10, 25, 50
// - First 200+ game ever
// - First 600+ series ever
```

### Client-Side Countdown Pattern
```typescript
// CountdownClock.tsx — 'use client'
'use client';
import { useState, useEffect } from 'react';

interface CountdownClockProps {
  targetDate: string | null; // ISO string from server
}

export function CountdownClock({ targetDate }: CountdownClockProps) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number } | null>(null);

  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();

    function update() {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      });
    }

    update();
    const interval = setInterval(update, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate) {
    return (
      <div className="text-center font-body text-navy/60">
        {/* League-voice humor for unknown date */}
        <p>Next bowling night? Your guess is as good as ours.</p>
      </div>
    );
  }

  if (!timeLeft) return null; // Pre-hydration

  return (
    <div className="flex items-center gap-4">
      <div className="text-center">
        <span className="font-heading text-4xl text-navy">{timeLeft.days}</span>
        <span className="block text-sm font-body text-navy/60">days</span>
      </div>
      <div className="text-center">
        <span className="font-heading text-4xl text-navy">{timeLeft.hours}</span>
        <span className="block text-sm font-body text-navy/60">hours</span>
      </div>
    </div>
  );
}
```

### Discovery Search Two-Mode Pattern
```typescript
// DiscoverySearch.tsx — 'use client'
// Shows category prompts on focus (empty query)
// Switches to Fuse.js results when typing

const categoryPrompts = [
  { label: 'Bowlers', href: '/bowlers', description: 'Browse all 619 bowlers' },
  { label: 'Teams', href: '/teams', description: 'View team rosters and history' },
  { label: 'Seasons', href: '/seasons', description: 'Explore 35+ seasons' },
  { label: 'Leaderboards', href: '/leaderboards', description: 'All-time records and rankings' },
];

// State: isFocused && query.length === 0 → show category prompts
// State: isFocused && query.length >= 2 → show Fuse.js results
// State: !isFocused → show nothing (closed)
```

### CSS Ticker Animation
```css
/* Smooth horizontal scroll for milestone ticker */
@keyframes ticker-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.ticker-track {
  animation: ticker-scroll 30s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .ticker-track {
    animation: none;
  }
}
```

### Bowler Directory Grouping
```typescript
// Group bowlers by first letter for the /bowlers page
function groupByLetter(bowlers: { name: string; slug: string }[]) {
  return bowlers.reduce<Record<string, typeof bowlers>>((groups, bowler) => {
    const letter = bowler.name[0].toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(bowler);
    return groups;
  }, {});
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getServerSideProps` | App Router server components | Next.js 13+ (2023) | Data fetching is just `async function` in server components. Already used in project. |
| `pages/api/*` routes | Route handlers in `app/api/*` | Next.js 13+ (2023) | Already used for `/api/search-index`. |
| CSS-in-JS for animations | Tailwind v4 + CSS @keyframes | Tailwind v4 (2024) | No extra library needed for ticker animation. |

**Deprecated/outdated:**
- None relevant. The project is already on modern Next.js 16 + React 19 + Tailwind v4.

## New Pages Inventory

| Route | Type | Data Source | Notes |
|-------|------|-------------|-------|
| `/` (home) | Server + client components | queries.ts (milestones, countdown, snapshot) | Complete rebuild of current placeholder |
| `/bowlers` | Server component | queries.ts (all bowlers) | Alphabetical directory, links to /bowler/[slug] |
| `/teams` | Server component | None (placeholder) | League-voice placeholder |
| `/seasons` | Server component | None (placeholder) | League-voice placeholder |
| `/leaderboards` | Server component | None (placeholder) | League-voice placeholder |
| `/resources` | Server component | None (hardcoded links) | Quick links page, URLs provided later |

## New Queries Inventory

| Query Function | Purpose | Table(s) | Complexity |
|----------------|---------|----------|------------|
| `getNextBowlingNight()` | Next scheduled match date | schedule | LOW — simple TOP 1 query |
| `getRecentMilestones()` | Recently achieved + approaching milestones | scores, bowlers, seasons | MEDIUM — needs threshold checks |
| `getCurrentSeasonSnapshot()` | Current season leaders, stats summary | scores, seasons | MEDIUM — aggregate queries for current season |
| `getAllBowlersDirectory()` | All bowlers with name, slug, seasons, isActive | bowlers, teamRosters | LOW — similar to search-index query |

## Open Questions

1. **League Photos**
   - What we know: User wants 1-2 good league photos on the landing page. The project has three logos in `/public/` but no actual league photos yet.
   - What's unclear: Which photos will be provided and when.
   - Recommendation: Build the hero section with a placeholder image container. Use one of the existing logos as a fallback. Photos can be swapped in during implementation when the user provides them.

2. **Milestone Definitions**
   - What we know: Milestones should be "recently achieved" and "approaching" — more compelling than static totals.
   - What's unclear: Exact thresholds (e.g., is 95 games "approaching" 100? What about 90?). How far back does "recently achieved" go?
   - Recommendation: Start with sensible defaults (within 5 games/pins for "approaching", last 4 weeks for "recently achieved"). These can be tuned iteratively per the user's preference for UI iteration.

3. **Resources Page URLs**
   - What we know: User said "Actual URLs to be provided later — build the structure now."
   - What's unclear: Exact list of resources and their categories.
   - Recommendation: Build the page structure with placeholder entries (Google Sheets DB, Current Season DB, Lineup Submission Form, etc.) using `#` href values. User can fill in URLs later.

4. **Off-Season Countdown Behavior**
   - What we know: Off-season should show "season wrap-up stats, push people toward historical records and leaderboards."
   - What's unclear: What specific wrap-up stats to show when no next bowling night exists.
   - Recommendation: If `getNextBowlingNight()` returns null, show a "Season Complete" card with links to leaderboards and a summary stat (e.g., "Season XXXV: 1,247 games bowled"). Can be refined iteratively.

## Sources

### Primary (HIGH confidence)
- Project codebase direct inspection — src/components/layout/SearchBar.tsx, src/lib/queries.ts, src/lib/search-index.ts, src/app/page.tsx, package.json
- CONTEXT.md user decisions — .planning/phases/03-search-and-home-page/03-CONTEXT.md
- REQUIREMENTS.md — .planning/REQUIREMENTS.md

### Secondary (MEDIUM confidence)
- Next.js App Router patterns — based on project's existing implementation (Next.js 16.1.6, already using server components, generateStaticParams, force-static)
- Fuse.js configuration — based on existing SearchBar.tsx implementation (v7.1.0, threshold 0.3)

### Tertiary (LOW confidence)
- None. All findings are based on direct codebase inspection and locked user decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed, everything is already installed and proven
- Architecture: HIGH - Patterns directly extend existing codebase conventions (queries.ts, server components, client components for interactivity)
- Pitfalls: HIGH - Hydration mismatch and blur/click race conditions are well-known React patterns; schedule data gaps are documented in MEMORY.md

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (30 days — stable domain, no fast-moving dependencies)
