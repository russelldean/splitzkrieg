# Phase 2: Bowler Profiles - Research

**Researched:** 2026-03-02
**Domain:** Stats-heavy profile page with chart, tables, accordion game log, OG meta tags
**Confidence:** HIGH (schema verified, existing code analyzed, Recharts 3 confirmed, Next.js OG API verified from official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Profile Layout**
- Hero header with bowler name large, career stats displayed as stat pills underneath (Career Avg · Total Games · Seasons Active · Teams Played For)
- Single-column layout — no sidebar
- Section order: Hero → Personal records → Average chart → Season-by-season table → Game log
- Mixed section styling: tables go full-width, records panel and chart go in cards
- Share button in the hero area — copies profile URL to clipboard
- No distinction between active and inactive bowlers — every bowler gets the same profile
- Mobile-first responsive (375px minimum, consistent with Phase 1)

**Stats Table**
- Full stats density: Season · Team · Games · Average · High Game · High Series · 200+ count · Total Pins
- Career totals as bold bottom row with subtle background highlight — classic Baseball Reference style
- Not sortable — chronological order, always
- Team names are clickable links to /team/[slug] (even before Phase 4 team pages exist)
- Season names are clickable links to /season/[slug] (even before Phase 4 season pages exist)

**Personal Records Panel**
- 2x2 stat cards grid layout inside a card container
- Shows: High Game, High Series, 200+ count, 600+ count
- Score color coding: 200+ green, 250+ gold, 300 (perfect game) gets special treatment (red accent or badge)

**Average Progression Chart**
- Clean line chart, not sparkline or full interactive
- Scratch average only — one clean line per season
- Site palette: navy line on cream background, red accent for career high point
- Hover shows exact average value
- Hide chart entirely if bowler has fewer than 3 seasons of data
- Chart lives in a card container

**Game Log**
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

### Deferred Ideas (OUT OF SCOPE)
- Achievements and milestones on bowler profile (e.g., "3 games from 100 career games") — Phase 5 (BWLR-07, BWLR-08)
- Leaderboard context on profile (e.g., "Ranked 5th in career average") — Phase 5 (BWLR-10)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BWLR-01 | User can view bowler profile with career summary header (name, seasons active, career average, total games, teams played for) | `vw_BowlerCareerSummary` view provides all needed columns: `careerAverage`, `totalGamesBowled`, `seasonsPlayed`, plus a distinct-teams query from `teamRosters` |
| BWLR-02 | Profile shows season-by-season stats table with career totals row | `vw_BowlerSeasonStats` view provides all needed columns per season; career totals row computed client-side from the season rows or via `vw_BowlerCareerSummary` |
| BWLR-03 | Profile shows personal records panel (high game, high series, 200+ count, 600+ count, turkeys) | All values available from `vw_BowlerCareerSummary`: `highGame`, `highSeries`, `games200Plus`, `series600Plus`, `totalTurkeys` |
| BWLR-04 | Profile shows average progression line chart across seasons | `vw_BowlerSeasonStats` provides `seasonAverage` per season; Recharts 3.7.0 confirmed React 19 compatible |
| BWLR-05 | Profile shows game log with week-by-week scores expandable per season | Direct query on `scores` table joined to `seasons` and `schedule` for opponent; accordion built with `<details>`/`<summary>` or custom state |
| BWLR-11 | Color-coded performance in all score tables (200+ green, 250+ gold) | Pure Tailwind CSS utility function — no library needed; 300 gets red accent class |
| BWLR-12 | Shareable URL with OG meta tags (splitzkrieg.org/bowler/russ-smith) | Next.js `generateMetadata` with `openGraph` object; URL already exists from Phase 1 `generateStaticParams` |
| XCUT-01 | Cross-linking everywhere (every name and team is a clickable link) | Team slugs available from `teams` table; season slugs = `romanNumeral` column; links built as Next.js `<Link>` components |
</phase_requirements>

---

## Summary

Phase 2 builds the centerpiece page of Splitzkrieg. The core work divides into four tracks: (1) SQL queries — expanding the existing minimal `getBowlerBySlug` into multiple targeted queries covering career summary, season stats, personal records, and the game log; (2) UI components — a hero header, records panel, stats table, accordion game log, and line chart; (3) chart integration — Recharts 3 is now the current major version (3.7.0) and is fully React 19 compatible; (4) OG metadata — the existing `generateMetadata` scaffold needs opengraph fields added.

The biggest technical risk is the game log query complexity: the `scores` table has no opponent data (opponent comes from `schedule` which only covers Seasons XXVI–XXXV). Game log entries for earlier seasons will show opponent as NULL and must display gracefully. The chart has a hide-under-3-seasons guard that is important given sparse historical bowlers. The team slug for cross-links requires a JOIN to the `teams` table since `vw_BowlerSeasonStats` only returns `teamName`, not `slug`.

**Primary recommendation:** Use Recharts 3.7.0 for the line chart (not 2.x — the current npm default is 3). Build the game log accordion with native HTML `<details>`/`<summary>` or a simple React `useState` — no accordion library needed. All data fetching is build-time Server Component queries using the established `src/lib/queries.ts` pattern.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.1.6 (installed) | Static generation + `generateMetadata` | Already the project framework; `generateStaticParams` + `dynamicParams=false` pattern already established in Phase 1 |
| Tailwind CSS v4 | ^4 (installed) | All styling — colors, layout, score color coding | Design tokens already defined in `globals.css`; `text-green-600`, custom token classes available |
| Recharts | 3.7.0 | Average progression line chart | Only React 19-compatible charting lib with simple LineChart API; current npm latest is 3.7.0, NOT 2.x |
| React | 19.2.3 (installed) | Client components for chart + share button + accordion | Already installed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx | ^2 (already used in project patterns) | Conditional score color classes | Everywhere score values need conditional coloring |
| next/navigation | built-in | Share button needs `usePathname` for copying URL | Client component for the copy-to-clipboard action |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts 3 LineChart | Chart.js / react-chartjs-2 | Canvas-based, harder to style with Tailwind; Recharts is SVG and React-native |
| Native `<details>`/`<summary>` accordion | Headless UI Disclosure | No additional library needed; browser-native is sufficient for simple expand/collapse |
| Recharts 3 | Nivo | Nivo is heavier bundle, more complex API; Recharts is sufficient for a single line chart |

**Installation:**
```bash
npm install recharts clsx
```

Note: `clsx` may already be present in project — check `node_modules`. If not installed yet, add it.

---

## Architecture Patterns

### Recommended Component Structure

```
src/
├── app/
│   └── bowler/
│       └── [slug]/
│           └── page.tsx              # Expand from Phase 1 scaffold — fetch all data, render sections
│
├── components/
│   └── bowler/                       # New directory for bowler-specific components
│       ├── BowlerHero.tsx            # Server component: hero header, stat pills, share button area
│       ├── ShareButton.tsx           # 'use client': clipboard copy button
│       ├── PersonalRecordsPanel.tsx  # Server component: 2x2 stat cards
│       ├── SeasonStatsTable.tsx      # Server component: season table + career totals row
│       ├── AverageProgressionChart.tsx  # 'use client': Recharts LineChart
│       └── GameLog.tsx               # 'use client': accordion per season (needs useState)
│
└── lib/
    └── queries.ts                    # Expand with new query functions
```

### Pattern 1: Multiple Parallel Queries in Page Component

**What:** The `page.tsx` fetches all data the profile needs in parallel using `Promise.all`. Each query function lives in `src/lib/queries.ts`.

**When to use:** Any page with multiple independent data needs.

```typescript
// src/app/bowler/[slug]/page.tsx
export default async function BowlerPage({ params }) {
  const { slug } = await params;
  const bowler = await getBowlerBySlug(slug);
  if (!bowler) notFound();

  // Fetch all sections in parallel — build-time only
  const [careerSummary, seasonStats, gameLog] = await Promise.all([
    getBowlerCareerSummary(bowler.bowlerID),
    getBowlerSeasonStats(bowler.bowlerID),
    getBowlerGameLog(bowler.bowlerID),
  ]);

  return (
    <main>
      <BowlerHero careerSummary={careerSummary} />
      <PersonalRecordsPanel careerSummary={careerSummary} />
      {seasonStats.length >= 3 && (
        <AverageProgressionChart seasons={seasonStats} />
      )}
      <SeasonStatsTable seasons={seasonStats} />
      <GameLog gameLog={gameLog} />
    </main>
  );
}
```

### Pattern 2: Score Color Utility Function

**What:** A reusable function that returns the appropriate Tailwind class for a game score.

**When to use:** Every place a game score is rendered — game log rows, records panel.

```typescript
// src/lib/score-utils.ts  (or inline in queries.ts utils section)
export function scoreColorClass(score: number | null): string {
  if (score === null) return '';
  if (score === 300) return 'text-red font-bold';     // Perfect game — red accent
  if (score >= 250) return 'text-amber-500 font-semibold'; // 250+ gold
  if (score >= 200) return 'text-green-600';           // 200+ green
  return '';
}
```

### Pattern 3: Recharts 3 Line Chart with React 19

**What:** `ResponsiveContainer` + `LineChart` from Recharts 3. Must be a `'use client'` component since Recharts requires browser APIs.

**When to use:** Average progression chart. Hide entirely if fewer than 3 seasons.

```typescript
// src/components/bowler/AverageProgressionChart.tsx
'use client';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceDot } from 'recharts';

interface Props {
  seasons: { displayName: string; seasonAverage: number }[];
}

export function AverageProgressionChart({ seasons }: Props) {
  const maxAvg = Math.max(...seasons.map(s => s.seasonAverage));
  const careerHighSeason = seasons.find(s => s.seasonAverage === maxAvg);

  return (
    <div className="card-container">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={seasons}>
          <XAxis dataKey="displayName" tick={{ fontSize: 12 }} />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => [`${value}`, 'Average']} />
          <Line
            type="monotone"
            dataKey="seasonAverage"
            stroke="#1B2A4A"   // navy
            strokeWidth={2}
            dot={{ fill: '#1B2A4A', r: 4 }}
            activeDot={{ r: 6 }}
          />
          {/* Red dot at career high */}
          {careerHighSeason && (
            <ReferenceDot
              x={careerHighSeason.displayName}
              y={maxAvg}
              r={6}
              fill="#C53030"    // red
              stroke="none"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Recharts 3 note:** `ReferenceDot` replaces the previous pattern of a custom dot renderer for highlighting a specific point. This is cleaner in v3.

### Pattern 4: Share Button (Client Component)

**What:** A minimal `'use client'` button that uses `navigator.clipboard.writeText` with the current page URL.

**When to use:** Hero section of the bowler profile.

```typescript
// src/components/bowler/ShareButton.tsx
'use client';
import { useState } from 'react';

export function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button onClick={handleCopy} className="...">
      {copied ? 'Copied!' : 'Share'}
    </button>
  );
}
```

Pass `url` as a prop from the server component parent (derive from `process.env.NEXT_PUBLIC_SITE_URL + '/bowler/' + slug` or use `headers()` — but simpler to pass as prop from the static page).

### Pattern 5: OG Meta Tags in generateMetadata

**What:** Expand the existing `generateMetadata` in `page.tsx` to include OpenGraph fields for shareability.

**Source:** Next.js official docs, verified 2026-02-27.

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const { slug } = await params;
  const bowler = await getBowlerBySlug(slug);
  if (!bowler) return { title: 'Bowler Not Found | Splitzkrieg' };

  const careerSummary = await getBowlerCareerSummary(bowler.bowlerID);
  const avgStr = careerSummary?.careerAverage?.toFixed(1) ?? 'N/A';

  return {
    title: `${bowler.bowlerName} | Splitzkrieg`,
    description: `${bowler.bowlerName}'s bowling stats — ${avgStr} career average, ${careerSummary?.totalGamesBowled ?? 0} games across ${careerSummary?.seasonsPlayed ?? 0} seasons.`,
    openGraph: {
      title: `${bowler.bowlerName} | Splitzkrieg Bowling`,
      description: `Career average: ${avgStr} · ${careerSummary?.totalGamesBowled ?? 0} games bowled`,
      url: `https://splitzkrieg.org/bowler/${slug}`,
      siteName: 'Splitzkrieg Bowling League',
      type: 'profile',
    },
  };
}
```

Note: `metadataBase` should be added to `app/layout.tsx` so relative URLs work. The `openGraph.images` field is optional for Phase 2 — a static default OG image in `public/og-default.png` is sufficient. Dynamic per-bowler OG images (next/og ImageResponse) are a Phase 5+ enhancement.

### Pattern 6: Game Log Accordion

**What:** A `'use client'` component that renders a collapsible section per season. Most-recent season open by default. Expand All / Collapse All toggle.

**When to use:** Game log section only.

```typescript
// src/components/bowler/GameLog.tsx
'use client';
import { useState } from 'react';

export function GameLog({ seasons }: { seasons: GameLogSeason[] }) {
  const [openSeasons, setOpenSeasons] = useState<Set<number>>(
    new Set([seasons[0]?.seasonID])  // Most recent season open by default
  );

  const allOpen = openSeasons.size === seasons.length;

  function toggleAll() {
    if (allOpen) {
      setOpenSeasons(new Set());
    } else {
      setOpenSeasons(new Set(seasons.map(s => s.seasonID)));
    }
  }

  function toggleSeason(seasonID: number) {
    setOpenSeasons(prev => {
      const next = new Set(prev);
      next.has(seasonID) ? next.delete(seasonID) : next.add(seasonID);
      return next;
    });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-2xl text-navy">Game Log</h2>
        <button onClick={toggleAll} className="text-sm text-navy/60 hover:text-red">
          {allOpen ? 'Collapse All' : 'Expand All'}
        </button>
      </div>
      {seasons.map(season => (
        <div key={season.seasonID} className="border-b border-navy/10">
          <button
            onClick={() => toggleSeason(season.seasonID)}
            className="w-full flex justify-between items-center py-3"
          >
            <span className="font-heading text-navy">{season.displayName}</span>
            <span>{openSeasons.has(season.seasonID) ? '▲' : '▼'}</span>
          </button>
          {openSeasons.has(season.seasonID) && (
            <div className="overflow-x-auto pb-4">
              <table className="w-full text-sm">
                {/* Week · Date · Opponent · G1 · G2 · G3 · Series · W/L */}
              </table>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
```

### Anti-Patterns to Avoid

- **Sorting the season table on the client:** The stats table is locked to chronological order (CONTEXT.md). Do not add a TanStack Table sortable wrapper — use a plain HTML table rendered server-side.
- **Fetching game log data lazily:** The entire page is static-generated at build time. All data — including the game log — must be fetched in `generateStaticParams`/`page.tsx`, not lazily on accordion open.
- **Installing Recharts 2.x:** The existing STACK.md references Recharts ^2.15 but the current npm latest is 3.7.0. Install `recharts` without a version pin to get 3.7.0 (React 19 compatible). Do not pin to 2.x.
- **Putting SQL in page components:** All queries live in `src/lib/queries.ts`. The page component calls named query functions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Line chart | Custom SVG chart | Recharts 3 `LineChart` | D3 scale logic, responsive resize, hover tooltips — 50+ lines of custom SVG code |
| Score color logic | Inline ternaries everywhere | `scoreColorClass(score)` utility in `src/lib/score-utils.ts` | Used in 3+ components; centralize so 200/250/300 thresholds are a single source of truth |
| OG meta tags | Raw `<meta>` in layout | Next.js `generateMetadata` with `openGraph` object | Framework handles head injection, deduplication, and streaming; raw meta tags in layouts break static rendering |
| Clipboard copy | `document.execCommand('copy')` | `navigator.clipboard.writeText()` | execCommand is deprecated; clipboard API is the standard |

**Key insight:** The main "don't hand-roll" risk here is building a custom chart when Recharts 3 covers the exact use case (single line, hover tooltip, responsive container) in ~30 lines of JSX.

---

## Common Pitfalls

### Pitfall 1: Team Slug Missing from vw_BowlerSeasonStats

**What goes wrong:** The `vw_BowlerSeasonStats` view returns `teamName` but NOT `slug`. The stats table needs `/team/[slug]` links.

**Why it happens:** The view was designed before cross-linking was a requirement.

**How to avoid:** The `getBowlerSeasonStats` query must JOIN to `teams` to get `t.slug AS teamSlug`. Options:
1. Rewrite the query to not use the view, joining directly on `scores → teams`
2. Join `vw_BowlerSeasonStats` to `teams ON teamName = teamName` (fragile — avoid)
3. Best option: query `scores` directly with the full JOIN chain in `getBowlerSeasonStats`:

```sql
SELECT
  sc.seasonID,
  sn.romanNumeral,
  sn.displayName,
  sn.year,
  sn.period,
  t.teamName,
  t.slug AS teamSlug,     -- ← needed for /team/[slug] links
  COUNT(sc.scoreID) AS nightsBowled,
  ...
FROM scores sc
JOIN seasons sn ON sc.seasonID = sn.seasonID
LEFT JOIN teams t ON sc.teamID = t.teamID
WHERE sc.bowlerID = @bowlerID
  AND sc.isPenalty = 0
GROUP BY sc.seasonID, sn.romanNumeral, sn.displayName, sn.year, sn.period,
         t.teamName, t.slug
ORDER BY sn.year ASC, CASE sn.period WHEN 'Spring' THEN 1 ELSE 2 END ASC
```

**Warning signs:** Test links on the stats table — if any team name is not a link, the slug is NULL.

### Pitfall 2: Game Log Opponent Data Missing for Pre-XXVI Seasons

**What goes wrong:** The `schedule` table only has data for Seasons XXVI–XXXV (10 of 35 seasons). Joining `scores` to `schedule` to get opponent team will return NULL for Seasons I–XXV.

**Why it happens:** Historical schedule data was never loaded (documented in data quality report).

**How to avoid:** The game log query must handle NULL opponent gracefully. Display "—" or "N/A" for the opponent column when no schedule data exists. Do NOT skip the row.

```sql
-- Game log query skeleton
SELECT
  sc.week,
  sch.matchDate,
  COALESCE(opp.teamName, NULL) AS opponentName,
  COALESCE(opp.slug, NULL) AS opponentSlug,
  sc.game1, sc.game2, sc.game3, sc.scratchSeries
FROM scores sc
JOIN seasons sn ON sc.seasonID = sn.seasonID
LEFT JOIN schedule sch ON sch.seasonID = sc.seasonID
  AND sch.week = sc.week
  AND (sch.team1ID = sc.teamID OR sch.team2ID = sc.teamID)
LEFT JOIN teams opp ON (
  CASE WHEN sch.team1ID = sc.teamID THEN sch.team2ID ELSE sch.team1ID END = opp.teamID
)
WHERE sc.bowlerID = @bowlerID
  AND sc.isPenalty = 0
ORDER BY sn.year DESC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END DESC, sc.week DESC
```

**Warning signs:** If game log shows blank rows for older seasons, the NULL handling is broken.

### Pitfall 3: Penalty Rows in Stats Calculations

**What goes wrong:** Including `isPenalty = 1` rows in game log or stats will show 0-game rows and distort averages.

**Why it happens:** Penalty rows have `isPenalty = 1` and NULL games; they exist for handicap calculation purposes, not as real bowling nights.

**How to avoid:** ALL queries on `scores` MUST include `WHERE isPenalty = 0` (or `AND sc.isPenalty = 0`). This applies to game log, season stats, and career summary queries alike. The views already filter these correctly, but any raw `scores` query must add the filter manually.

**Warning signs:** Game log shows rows with all-zero or NULL games; career average is lower than expected.

### Pitfall 4: Recharts Must Be a Client Component

**What goes wrong:** Importing Recharts in a Server Component causes a build error ("you're importing a component that needs X").

**Why it happens:** Recharts uses browser APIs (`ResizeObserver`, `window`) that are not available in the Node.js server environment.

**How to avoid:** `AverageProgressionChart` MUST have `'use client'` at the top. The parent page passes data as serializable props (array of `{ displayName, seasonAverage }`). Never pass non-serializable objects (functions, class instances) from server to client components.

**Warning signs:** Build error mentioning `ResizeObserver` or `window is not defined`.

### Pitfall 5: Share Button URL Construction

**What goes wrong:** Using `window.location.href` in the share button component fails during SSR (server has no `window`).

**Why it happens:** The share button is a client component, but Next.js still SSR-renders client components on the first pass.

**How to avoid:** Pass the URL as a prop from the server component parent. The server component can construct the URL from `process.env.NEXT_PUBLIC_SITE_URL` + the slug. No need for `window` at all.

```typescript
// In page.tsx (Server Component) — pass URL as prop
const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/bowler/${slug}`;
<BowlerHero careerSummary={careerSummary} shareUrl={shareUrl} />

// BowlerHero passes to ShareButton (Client Component)
<ShareButton url={shareUrl} />
```

**Warning signs:** Hydration mismatch error; URL is undefined on server render.

### Pitfall 6: Bowler With Zero Games (Edge Case)

**What goes wrong:** The `vw_BowlerCareerSummary` uses a LEFT JOIN so bowlers with no scores get NULL careerAverage, NULL highGame, etc. These bowlers exist (619 bowlers includes some with very sparse data).

**Why it happens:** The bowlers table includes everyone ever registered; a few have 0 scored nights.

**How to avoid:** Display graceful empty states for each section when data is NULL/zero. Use the existing `EmptyState` component for sections with no data. The existing `EmptyState.tsx` is pre-built for exactly this purpose.

---

## Code Examples

Verified patterns for Phase 2:

### Query: Career Summary (using existing view)

```typescript
// src/lib/queries.ts — add after getBowlerBySlug

export interface BowlerCareerSummary {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  gender: string | null;
  isActive: boolean | null;
  totalGamesBowled: number;
  totalPins: number;
  careerAverage: number | null;
  highGame: number | null;
  highSeries: number | null;
  games200Plus: number;
  series600Plus: number;
  totalTurkeys: number;
  firstYear: number | null;
  lastYear: number | null;
  seasonsPlayed: number;
}

export async function getBowlerCareerSummary(bowlerID: number): Promise<BowlerCareerSummary | null> {
  if (!process.env.AZURE_SQL_SERVER) return null;
  try {
    const db = await getDb();
    const result = await db
      .request()
      .input('bowlerID', bowlerID)
      .query<BowlerCareerSummary>(`
        SELECT *
        FROM vw_BowlerCareerSummary
        WHERE bowlerID = @bowlerID
      `);
    return result.recordset[0] ?? null;
  } catch (err) {
    console.warn('getBowlerCareerSummary: DB unavailable', err);
    return null;
  }
}
```

### Query: Season Stats with Team Slug

```typescript
export interface BowlerSeasonStats {
  seasonID: number;
  romanNumeral: string;
  displayName: string;
  year: number;
  period: string;
  teamName: string | null;
  teamSlug: string | null;           // Needed for /team/[slug] links
  nightsBowled: number;
  gamesBowled: number;
  totalPins: number;
  seasonAverage: number | null;
  highGame: number | null;
  highSeries: number | null;
  games200Plus: number;
  series600Plus: number;
}

export async function getBowlerSeasonStats(bowlerID: number): Promise<BowlerSeasonStats[]> {
  if (!process.env.AZURE_SQL_SERVER) return [];
  try {
    const db = await getDb();
    const result = await db
      .request()
      .input('bowlerID', bowlerID)
      .query<BowlerSeasonStats>(`
        SELECT
          sc.seasonID,
          sn.romanNumeral,
          sn.displayName,
          sn.year,
          sn.period,
          t.teamName,
          t.slug                                          AS teamSlug,
          COUNT(sc.scoreID)                               AS nightsBowled,
          COUNT(sc.scoreID) * 3                           AS gamesBowled,
          SUM(sc.scratchSeries)                           AS totalPins,
          CAST(SUM(sc.scratchSeries) * 1.0 /
               NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS seasonAverage,
          MAX(CASE WHEN sc.game1 >= sc.game2 AND sc.game1 >= sc.game3 THEN sc.game1
                   WHEN sc.game2 >= sc.game3 THEN sc.game2
                   ELSE sc.game3 END)                     AS highGame,
          MAX(sc.scratchSeries)                           AS highSeries,
          SUM(CASE WHEN sc.game1 >= 200 THEN 1 ELSE 0 END +
              CASE WHEN sc.game2 >= 200 THEN 1 ELSE 0 END +
              CASE WHEN sc.game3 >= 200 THEN 1 ELSE 0 END) AS games200Plus,
          SUM(CASE WHEN sc.scratchSeries >= 600 THEN 1 ELSE 0 END) AS series600Plus
        FROM scores sc
        JOIN seasons sn ON sc.seasonID = sn.seasonID
        LEFT JOIN teams t ON sc.teamID = t.teamID
        WHERE sc.bowlerID = @bowlerID
          AND sc.isPenalty = 0
        GROUP BY sc.seasonID, sn.romanNumeral, sn.displayName, sn.year, sn.period,
                 t.teamName, t.slug
        ORDER BY sn.year ASC,
                 CASE sn.period WHEN 'Spring' THEN 1 ELSE 2 END ASC
      `);
    return result.recordset;
  } catch (err) {
    console.warn('getBowlerSeasonStats: DB unavailable', err);
    return [];
  }
}
```

### Query: Game Log (with graceful opponent NULL handling)

```typescript
export interface GameLogWeek {
  seasonID: number;
  displayName: string;      // Season display name for grouping
  week: number;
  matchDate: Date | null;   // NULL for pre-XXVI seasons
  opponentName: string | null;   // NULL for pre-XXVI seasons
  opponentSlug: string | null;
  game1: number | null;
  game2: number | null;
  game3: number | null;
  scratchSeries: number | null;
}

export async function getBowlerGameLog(bowlerID: number): Promise<GameLogWeek[]> {
  if (!process.env.AZURE_SQL_SERVER) return [];
  try {
    const db = await getDb();
    const result = await db
      .request()
      .input('bowlerID', bowlerID)
      .query<GameLogWeek>(`
        SELECT
          sc.seasonID,
          sn.displayName,
          sc.week,
          sch.matchDate,
          opp.teamName  AS opponentName,
          opp.slug      AS opponentSlug,
          sc.game1,
          sc.game2,
          sc.game3,
          sc.scratchSeries
        FROM scores sc
        JOIN seasons sn ON sc.seasonID = sn.seasonID
        LEFT JOIN schedule sch
          ON sch.seasonID = sc.seasonID
          AND sch.week = sc.week
          AND (sch.team1ID = sc.teamID OR sch.team2ID = sc.teamID)
        LEFT JOIN teams opp
          ON opp.teamID = CASE
               WHEN sch.team1ID = sc.teamID THEN sch.team2ID
               ELSE sch.team1ID
             END
        WHERE sc.bowlerID = @bowlerID
          AND sc.isPenalty = 0
        ORDER BY sn.year DESC,
                 CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END DESC,
                 sc.week ASC
      `);
    return result.recordset;
  } catch (err) {
    console.warn('getBowlerGameLog: DB unavailable', err);
    return [];
  }
}
```

### OG Metadata with Career Stats

```typescript
// Expand existing generateMetadata in src/app/bowler/[slug]/page.tsx
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const bowler = await getBowlerBySlug(slug);
  if (!bowler) return { title: 'Bowler Not Found | Splitzkrieg' };

  // Reuse the career summary (React.cache deduplication means no double query)
  const summary = await getBowlerCareerSummary(bowler.bowlerID);
  const avgStr = summary?.careerAverage?.toFixed(1) ?? 'N/A';
  const games = summary?.totalGamesBowled ?? 0;

  return {
    title: `${bowler.bowlerName} | Splitzkrieg`,
    description: `${bowler.bowlerName} — ${avgStr} career average · ${games} games bowled. Splitzkrieg Bowling League.`,
    openGraph: {
      title: `${bowler.bowlerName} | Splitzkrieg Bowling`,
      description: `Career average: ${avgStr} · ${games} games bowled`,
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/bowler/${slug}`,
      siteName: 'Splitzkrieg Bowling League',
      type: 'profile',
    },
  };
}
```

Note: For deduplication to work in static generation context, wrap `getBowlerCareerSummary` with `React.cache` in `queries.ts` when the same data is needed in both `generateMetadata` and the page component.

### Recharts 3 Installation Verification

```bash
# Verify latest version before installing
npm info recharts version
# As of research: 3.7.0

# Install
npm install recharts

# Peer deps (auto-satisfied by existing React 19 install):
# react '^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0' ✓
# react-dom same range ✓
# react-is same range (may need: npm install react-is) — check after install
```

---

## Database Schema Reference for Phase 2

Key tables and views used in this phase:

| Source | Columns Used | Notes |
|--------|-------------|-------|
| `vw_BowlerCareerSummary` | All columns | Used for hero stats + personal records panel |
| `scores` (direct query) | `bowlerID, seasonID, teamID, week, game1-3, scratchSeries, isPenalty` | Used for season stats (with JOINs) and game log |
| `seasons` | `seasonID, romanNumeral, displayName, year, period` | JOINed in season stats and game log queries |
| `teams` | `teamID, teamName, slug` | JOINed for team slugs (cross-links) |
| `schedule` | `seasonID, week, team1ID, team2ID, matchDate` | LEFT JOINed for opponent data (only XXVI+) |
| `teamRosters` | Not needed directly | `vw_BowlerCareerSummary` handles career stats |

**Critical:** The `teamsPlayedFor` count in the hero (BWLR-01) — number of distinct teams bowled for — requires a query since `vw_BowlerCareerSummary` doesn't include this. Add a subquery or separate query:

```sql
-- Count distinct teams for a bowler
SELECT COUNT(DISTINCT teamID) AS teamsPlayedFor
FROM scores
WHERE bowlerID = @bowlerID AND isPenalty = 0 AND teamID IS NOT NULL
```

This can be added as a column to the `getBowlerCareerSummary` query or as a separate function.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recharts 2.x (`^2.15`) | Recharts 3.7.0 | Recharts 3.0 released 2024/2025 | Breaking change: `CategoricalChartState` removed, `TooltipProps` → `TooltipContentProps`, `accessibilityLayer` now true by default. Must use 3.x for React 19 support. |
| `title.template` in page.tsx | `generateMetadata` with full `openGraph` object | Next.js 13.2+ | Dynamic OG tags are per-page via `generateMetadata`; static metadata object is for static pages only |
| `execCommand('copy')` for clipboard | `navigator.clipboard.writeText()` | Deprecated in all major browsers | Modern Clipboard API is the standard; execCommand removed from Chrome contexts |

**Deprecated/outdated:**
- Recharts 2.x: Do not install `recharts@2` — React 19 compatibility requires 3.x. The STACK.md reference to `^2.15` is outdated.
- `react-smooth` dependency: Removed from Recharts 3.0 — Recharts now bundles its own animations.

---

## Open Questions

1. **`NEXT_PUBLIC_SITE_URL` environment variable**
   - What we know: The share button and OG meta URL need the base URL (`https://splitzkrieg.org`)
   - What's unclear: Whether this env var is already configured in Vercel or needs to be added
   - Recommendation: Add `NEXT_PUBLIC_SITE_URL=https://splitzkrieg.org` to `.env.local.example` and Vercel env vars; use `''` as fallback for local dev (relative URLs work in browser)

2. **Game log W/L indicator (CONTEXT.md: "W/L indicator")**
   - What we know: `matchResults` table is empty (0 rows per data quality report); W/L per bowler per week is not derivable from the current data
   - What's unclear: Whether W/L should be team W/L (requires `matchResults`) or individual (undefined concept)
   - Recommendation: Omit W/L column entirely for now since `matchResults` is empty; the column stub can be added when data is populated. Display a "—" placeholder or remove the column from scope. This is a data availability gap, not a code limitation.

3. **React.cache for deduplication across generateMetadata + page.tsx**
   - What we know: Next.js `generateMetadata` and `page.tsx` both need career summary data for Phase 2; React.cache memoizes calls within a single render pass
   - What's unclear: Whether `getBowlerCareerSummary` needs to be explicitly wrapped in `React.cache` or if Next.js 16's memoization handles this automatically for static generation
   - Recommendation: Wrap the query function in `React.cache` from `react` package — it's a safe no-op if already cached and ensures deduplication: `import { cache } from 'react'; export const getBowlerCareerSummary = cache(async (bowlerID: number) => { ... })`

---

## Validation Architecture

> `workflow.nyquist_validation` is NOT present in `.planning/config.json` — this section is skipped per the output format instructions.

The config.json contains `"workflow": { "research": true, "plan_check": true, "verifier": true }` with no `nyquist_validation` key. Validation architecture section is omitted.

---

## Sources

### Primary (HIGH confidence)
- `/Users/russdean/Projects/splitzkrieg/docs/splitzkrieg-schema.sql` — Schema verified: `vw_BowlerCareerSummary`, `vw_BowlerSeasonStats`, `scores` table columns, `schedule` table (Seasons XXVI+ only)
- `/Users/russdean/Projects/splitzkrieg/docs/splitzkrieg-data-quality-report.md` — Data availability confirmed: matchResults empty, schedule partial, 619 bowlers
- Next.js official docs `generateMetadata` — https://nextjs.org/docs/app/api-reference/functions/generate-metadata — verified 2026-02-27, covers openGraph field structure
- `npm info recharts` (run 2026-03-02) — Confirmed current latest is 3.7.0; peerDependencies include React 19

### Secondary (MEDIUM confidence)
- Recharts 3.0 migration guide — https://github.com/recharts/recharts/wiki/3.0-migration-guide — verified breaking changes: CategoricalChartState removed, TooltipContentProps, accessibilityLayer default changed
- Existing project files (`src/app/bowler/[slug]/page.tsx`, `src/lib/queries.ts`, `src/app/globals.css`) — Analyzed directly for existing patterns

### Tertiary (LOW confidence)
- None — all critical claims verified from primary sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Recharts 3.7.0 confirmed from npm, React 19 peerDep verified; Next.js generateMetadata verified from official docs
- Architecture: HIGH — Based on verified schema, existing code patterns, and confirmed Recharts 3 API
- Pitfalls: HIGH — Team slug gap and schedule gap confirmed directly from schema/data quality report; penalty row filter is documented in schema

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (Recharts releases frequently; verify version before install)
