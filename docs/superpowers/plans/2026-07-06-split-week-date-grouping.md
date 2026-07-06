# Split-Week Date Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the week page, when a week's matches span more than one date (a "split week"), group them under per-date headings on the same page, in both the upcoming-matchups preview and the played results view.

**Architecture:** One pure grouping helper (`groupByMatchDate`) in `week-utils.ts`, one small shared `SplitDateHeading` presentational component, and a `isSplit` branch added to each of the three consumers (preview component, results component, page header). Purely presentational; no query/schema change. Single-date weeks render exactly as today.

**Tech Stack:** Next.js (App Router, RSC + one client component), TypeScript, Tailwind, Vitest.

---

## Background facts (verified against the codebase)

- `SeasonScheduleWeek` (`src/lib/queries/seasons/weekly.ts:6`) has `matchDate: string | null`, `homeTeamID/Name/Slug`, `awayTeamID/Name/Slug`, `week`.
- `WeeklyMatchScore` also has `matchDate: string | null`.
- `formatMatchDate(date, options)` (`src/lib/bowling-time.ts:84`) returns `string | null`, formats in UTC.
- Week page (`src/app/week/[seasonSlug]/[weekNum]/page.tsx`):
  - line 120: `const matchDate = weekScores[0]?.matchDate ?? weekSchedule[0]?.matchDate ?? null;`
  - line 121: `const dateStr = formatMatchDate(matchDate, { weekday: 'long', month: 'long', day: 'numeric' });`
  - line 165: `{dateStr && <> &middot; {dateStr}</>}` (renders the subtitle date).
  - Renders `<WeekSchedulePreview schedule={weekSchedule} .../>` for future weeks and `<WeekMatchSummary weekScores schedule matchResults week/>` for played weeks.
- `WeekSchedulePreview` (`src/components/season/WeekSchedulePreview.tsx`) is an RSC. It builds `h2hMap`, `standingsMap`, `rankMap` (lines 100-121), then has a `hasDivisions` branch (127-179) and a flat branch (182-198). Renders `MatchCard` per matchup.
- `WeekMatchSummary` (`src/components/season/WeekMatchSummary.tsx`) is a `'use client'` component. Builds `rows` from `matchups = schedule.filter(s => s.week === week)`, keeps expand/collapse state keyed by the flat row index `idx`, and URL hash `#match-{idx}`. Renders `rows.map((row, idx) => <div id={match-idx}>...)` inside `<div className="space-y-2">`.
- Tests run with `vitest run` (package.json `"test": "vitest run"`). Existing unit tests live beside their source (e.g. `src/lib/score-utils.test.ts`). No component-render test harness exists — UI is verified on `next dev`.

---

## Task 1: `groupByMatchDate` helper + tests

**Files:**
- Modify: `src/lib/week-utils.ts`
- Test: `src/lib/week-utils.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/week-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { groupByMatchDate } from './week-utils';

describe('groupByMatchDate', () => {
  it('returns a single group when all items share one date', () => {
    const items = [{ matchDate: '2026-08-24' }, { matchDate: '2026-08-24' }];
    const groups = groupByMatchDate(items, (x) => x.matchDate);
    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBe('2026-08-24');
    expect(groups[0].items).toHaveLength(2);
  });

  it('splits multiple dates into ascending groups, preserving within-group order', () => {
    const items = [
      { id: 1, matchDate: '2026-07-13' },
      { id: 2, matchDate: '2026-07-20' },
      { id: 3, matchDate: '2026-07-13' },
    ];
    const groups = groupByMatchDate(items, (x) => x.matchDate);
    expect(groups.map((g) => g.date)).toEqual(['2026-07-13', '2026-07-20']);
    expect(groups[0].items.map((i) => i.id)).toEqual([1, 3]);
    expect(groups[1].items.map((i) => i.id)).toEqual([2]);
  });

  it('sorts null dates last', () => {
    const items = [{ matchDate: null }, { matchDate: '2026-07-13' }];
    const groups = groupByMatchDate(items, (x) => x.matchDate);
    expect(groups.map((g) => g.date)).toEqual(['2026-07-13', null]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/week-utils.test.ts`
Expected: FAIL — `groupByMatchDate` is not exported.

- [ ] **Step 3: Add the implementation**

Append to `src/lib/week-utils.ts`:

```ts
export interface DateGroup<T> {
  date: string | null;
  items: T[];
}

/**
 * Group items by their match date, returned in ascending date order (null last).
 * Within-group order is preserved. Order-independent: does not assume the input
 * is pre-sorted. A single-date input returns one group.
 */
export function groupByMatchDate<T>(
  items: T[],
  getDate: (item: T) => string | null,
): DateGroup<T>[] {
  const map = new Map<string | null, T[]>();
  const order: (string | null)[] = [];
  for (const item of items) {
    const d = getDate(item);
    if (!map.has(d)) {
      map.set(d, []);
      order.push(d);
    }
    map.get(d)!.push(item);
  }
  order.sort((a, b) => {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a < b ? -1 : 1;
  });
  return order.map((date) => ({ date, items: map.get(date)! }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/week-utils.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/week-utils.ts src/lib/week-utils.test.ts
git commit -m "feat: add groupByMatchDate helper for split-week grouping"
```

---

## Task 2: `SplitDateHeading` component

**Files:**
- Create: `src/components/season/SplitDateHeading.tsx`

- [ ] **Step 1: Create the component**

`src/components/season/SplitDateHeading.tsx`:

```tsx
import { formatMatchDate } from '@/lib/bowling-time';

/**
 * Date divider shown above each group of matches on a split week (a week whose
 * matches span more than one date). Not rendered for single-date weeks.
 */
export function SplitDateHeading({ date, count }: { date: string | null; count: number }) {
  const label =
    formatMatchDate(date, { weekday: 'long', month: 'long', day: 'numeric' }) ?? 'Date TBD';
  return (
    <div className="flex items-baseline gap-2 mb-3 pb-1.5 border-b border-navy/10">
      <h4 className="font-heading text-base text-navy">{label}</h4>
      <span className="text-xs text-navy/50 font-body tabular-nums">
        {count} {count === 1 ? 'match' : 'matches'}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/season/SplitDateHeading.tsx
git commit -m "feat: add SplitDateHeading component"
```

---

## Task 3: Group the upcoming-matchups preview by date

**Files:**
- Modify: `src/components/season/WeekSchedulePreview.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/components/season/WeekSchedulePreview.tsx`, add:

```tsx
import { groupByMatchDate } from '@/lib/week-utils';
import { SplitDateHeading } from './SplitDateHeading';
```

- [ ] **Step 2: Add the split-week branch**

In `WeekSchedulePreview`, immediately AFTER the `rankMap` population loop (currently ends at line 121, `teams.forEach((t, i) => rankMap.set(t.teamID, i + 1));` and its closing `}`) and BEFORE the `// Group matchups by division` comment (line 123), insert:

```tsx
  // Split week: the week's matches span more than one date. Group by date and
  // render a flat grid within each date (takes precedence over division grouping).
  const dateGroups = groupByMatchDate(schedule, (s) => s.matchDate);
  if (dateGroups.length > 1) {
    return (
      <div className="space-y-6">
        <h3 className="font-heading text-lg text-navy">Upcoming Matchups</h3>
        {dateGroups.map((group) => (
          <div key={group.date ?? 'tbd'}>
            <SplitDateHeading date={group.date} count={group.items.length} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {group.items.map((matchup, idx) => (
                <MatchCard
                  key={idx}
                  matchup={matchup}
                  h2hMap={h2hMap}
                  standingsMap={standingsMap}
                  rankMap={rankMap}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
```

Leave the existing `hasDivisions` and flat branches unchanged below this. (A single-date week has `dateGroups.length === 1`, so it falls through to the existing behavior.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Visual verification on dev**

Run: `npm run dev` (or `npm run dev:fresh` if data looks stale)
Open `http://localhost:3000/week/fall-2026/1` — expect **two** date groups ("Monday, July 13" and "Monday, July 20"), five matchups each, under "Upcoming Matchups".
Open `http://localhost:3000/week/fall-2026/4` — expect the normal single flat/division list, **no** date headings.

- [ ] **Step 5: Commit**

```bash
git add src/components/season/WeekSchedulePreview.tsx
git commit -m "feat: group upcoming matchups by date on split weeks"
```

---

## Task 4: Multi-date subtitle in the week page header

**Files:**
- Modify: `src/app/week/[seasonSlug]/[weekNum]/page.tsx`

- [ ] **Step 1: Replace the single-date computation**

Replace lines 120-121:

```tsx
  // Get date for this week
  const matchDate = weekScores[0]?.matchDate ?? weekSchedule[0]?.matchDate ?? null;
  const dateStr = formatMatchDate(matchDate, { weekday: 'long', month: 'long', day: 'numeric' });
```

with:

```tsx
  // Date(s) for this week. A split week spans more than one date -> show both.
  const distinctDates = Array.from(
    new Set(
      [...weekSchedule, ...weekScores]
        .map((r) => r.matchDate)
        .filter((d): d is string => d != null),
    ),
  ).sort();
  const dateStr =
    distinctDates.length > 1
      ? distinctDates.map((d) => formatMatchDate(d, { month: 'short', day: 'numeric' })).join(' & ')
      : formatMatchDate(distinctDates[0] ?? null, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });
```

(The render at line 165, `{dateStr && <> &middot; {dateStr}</>}`, is unchanged — `dateStr` is now `"Jul 13 & Jul 20"` for split weeks and the long single date otherwise.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Visual verification**

On `next dev`, `http://localhost:3000/week/fall-2026/1` header subtitle reads `Week 1 · Fall 2026 · Jul 13 & Jul 20`.
`http://localhost:3000/week/fall-2026/4` reads the single long date as before.

- [ ] **Step 4: Commit**

```bash
git add "src/app/week/[seasonSlug]/[weekNum]/page.tsx"
git commit -m "feat: show both dates in header subtitle on split weeks"
```

---

## Task 5: Group the played results view by date

**Files:**
- Modify: `src/components/season/WeekMatchSummary.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/components/season/WeekMatchSummary.tsx` (it already imports from `@/lib/week-utils`), add `groupByMatchDate` to that import and add the SplitDateHeading import:

```tsx
import { organizeByWeek, indexMatchResults, findMatchMVP, groupByMatchDate } from '@/lib/week-utils';
import { SplitDateHeading } from './SplitDateHeading';
```

- [ ] **Step 2: Extract the per-row JSX into a local render function**

The component currently renders `rows.map((row, idx) => { ...large body... return (<div key={idx} id={`match-${idx}`}>...</div>); })` inside `<div className="space-y-2"> ... </div>` (starts at line 137).

Convert that map callback into a named local function defined in the component body (just before the `return (` at line 125), preserving its body **verbatim**:

```tsx
  const renderMatchRow = (row: (typeof rows)[number], idx: number) => {
    // ...the exact existing body from `const { matchup, mr, ... } = row;`
    // down through the final `return ( <div key={idx} id={`match-${idx}`}> ... </div> );
    // Moved unchanged from the old rows.map callback.
  };
```

`renderMatchRow` closes over `openMatches`, `toggleMatch`, and `forfeitTeamIDs`, which are all in scope in the component body — no prop threading needed. Do not change any of the moved JSX; the `idx` parameter keeps the same meaning (position in the flat `rows` array), so `id={`match-${idx}`}`, `openMatches.has(idx)`, and `toggleAll` continue to work.

- [ ] **Step 3: Add the grouping setup**

Immediately after `renderMatchRow` (still before the `return (`), add:

```tsx
  const indexedRows = rows.map((row, idx) => ({ row, idx }));
  const dateGroups = groupByMatchDate(indexedRows, (x) => x.row.matchup.matchDate);
  const isSplit = dateGroups.length > 1;
```

- [ ] **Step 4: Replace the render container**

Replace the existing results container:

```tsx
      <div className="space-y-2">
        {rows.map((row, idx) => {
          // ...moved to renderMatchRow...
        })}
      </div>
```

with:

```tsx
      <div className="space-y-2">
        {isSplit
          ? dateGroups.map((group) => (
              <div key={group.date ?? 'tbd'} className="space-y-2">
                <SplitDateHeading date={group.date} count={group.items.length} />
                {group.items.map(({ row, idx }) => renderMatchRow(row, idx))}
              </div>
            ))
          : rows.map((row, idx) => renderMatchRow(row, idx))}
      </div>
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Find a played split week to verify against**

The S36 split weeks have no scores yet, so verify the results grouping on a historical split week (a played week whose matches span two dates). Run this to find one:

```bash
node -e '
const sql=require("mssql");const {readFileSync}=require("fs");
const env=readFileSync(".env.local","utf8");for(const l of env.split("\n")){const m=l.match(/^([^#=]+)=(.*)$/);if(m)process.env[m[1].trim()]=m[2].trim();}
const cfg={server:process.env.AZURE_SQL_SERVER,database:process.env.AZURE_SQL_DATABASE,user:process.env.AZURE_SQL_USER,password:process.env.AZURE_SQL_PASSWORD,options:{encrypt:true,trustServerCertificate:false,connectTimeout:120000,requestTimeout:60000}};
(async()=>{const p=await sql.connect(cfg);const r=await p.request().query("SELECT TOP 5 s.seasonID, se.displayName, s.week, COUNT(DISTINCT s.matchDate) AS dates FROM schedule s JOIN seasons se ON se.seasonID=s.seasonID JOIN scores sc ON sc.seasonID=s.seasonID AND sc.week=s.week GROUP BY s.seasonID, se.displayName, s.week HAVING COUNT(DISTINCT s.matchDate)>1 ORDER BY s.seasonID DESC");console.log(r.recordset);await p.close();})();
'
```

Expected: at least one row (e.g. a prior Fall season week with `dates > 1`). Note its season slug (LOWER(displayName) with spaces -> hyphens) and week.

- [ ] **Step 7: Visual verification on dev**

If Step 6 returned a played split week at `/<seasonSlug>/<week>`, open `http://localhost:3000/week/<seasonSlug>/<week>` and confirm the **Match Results** section shows two date groups with headings, expand/collapse still works, and `#match-N` hash links still open the right match. Also open a normal (single-date) played week and confirm **no** date headings and unchanged behavior.

If Step 6 returns no rows (no historical split week has scores), rely on the passing `groupByMatchDate` unit tests plus the preview verification from Task 3, and note in the commit that the results path is logic-verified (it will visually surface once S36 week-1 scores land 7/13).

- [ ] **Step 8: Commit**

```bash
git add src/components/season/WeekMatchSummary.tsx
git commit -m "feat: group played match results by date on split weeks"
```

---

## Task 6: Full verification

- [ ] **Step 1: Run the test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new `week-utils.test.ts`.

- [ ] **Step 2: Typecheck + pre-push**

Run: `npx tsc --noEmit && node scripts/pre-push-check.mjs`
Expected: tsc exit 0; pre-push "All checks passed" (cache/em-dash/data-versions/published-week).

- [ ] **Step 3: Final visual pass**

On `next dev`: `/week/fall-2026/1` (split preview + subtitle), `/week/fall-2026/4` (combined, unchanged), and the historical played split week from Task 5 if found. Confirm combined weeks are visually identical to before.
