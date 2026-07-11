# Team Season Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-team "Season Schedule" section to `/team/[slug]` for current-season teams, showing every week's matchup with a compact points-per-night strip and a detail table (record / XP / pts).

**Architecture:** One new cached SQL query resolves the team's current-season slate from `schedule LEFT JOIN matchResults` (opponent = other side, unplayed weeks come back with null results). A pure row-mapper shapes rows; a shared `game-record` util derives the "W-L-T" night record (extracted from `HeadToHead`). Two React server components render a stacked-bar strip and a table. The team page gates rendering on a shared, cached set of current-season team IDs (schedule-based, so it works in preseason).

**Tech Stack:** Next.js (static build, BUILD_ALL prerender), Azure SQL via `mssql`, `cachedQuery` disk cache, Tailwind, Vitest.

**Note on commits:** Commit steps below are the standard TDD cadence. Per the repo owner's standing rule ("don't commit unless asked"), confirm before actually committing during execution.

---

### Task 1: Shared game-record util

**Files:**
- Create: `src/lib/game-record.ts`
- Test: `src/lib/game-record.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/game-record.test.ts
import { describe, it, expect } from 'vitest';
import { countGames, nightRecordStr } from './game-record';

describe('countGames', () => {
  it('counts wins, losses, and ties across three games', () => {
    expect(countGames([180, 150, 200], [170, 160, 200])).toEqual({ w: 1, l: 1, t: 1 });
  });

  it('handles a 2-1-0 night', () => {
    expect(countGames([180, 190, 150], [170, 160, 200])).toEqual({ w: 2, l: 1, t: 0 });
  });

  it('skips games with null totals (unplayed)', () => {
    expect(countGames([180, null, null], [170, null, null])).toEqual({ w: 1, l: 0, t: 0 });
  });
});

describe('nightRecordStr', () => {
  it('formats as W-L-T', () => {
    expect(nightRecordStr([180, 190, 150], [170, 160, 200])).toBe('2-1-0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/game-record.test.ts`
Expected: FAIL - cannot resolve `./game-record`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/game-record.ts
/**
 * Per-game win/loss/tie counting for a single matchup night, from each team's
 * per-game handicap totals. A game with a null on either side (unplayed) is skipped.
 */
export function countGames(
  ours: (number | null)[],
  theirs: (number | null)[],
): { w: number; l: number; t: number } {
  let w = 0, l = 0, t = 0;
  for (let i = 0; i < ours.length; i++) {
    const o = ours[i];
    const th = theirs[i];
    if (o == null || th == null) continue;
    if (o > th) w++;
    else if (o < th) l++;
    else t++;
  }
  return { w, l, t };
}

/** Format a night's game record as "W-L-T" (e.g. "2-1-0"). */
export function nightRecordStr(
  ours: (number | null)[],
  theirs: (number | null)[],
): string {
  const { w, l, t } = countGames(ours, theirs);
  return `${w}-${l}-${t}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/game-record.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game-record.ts src/lib/game-record.test.ts
git commit -m "feat: add shared game-record util (countGames/nightRecordStr)"
```

---

### Task 2: Refactor HeadToHead to use the shared util (behavior-preserving)

**Files:**
- Modify: `src/components/team/HeadToHead.tsx:21-41`

- [ ] **Step 1: Replace the local per-game counting with the shared util**

Replace the existing `countGames` function body (the one taking a `TeamH2HMatchup`) so it delegates to the shared util. Keep the same name and signature so all call sites (`nightRecordStr`, `nightResultClass`) are unchanged:

```tsx
// add to the imports at the top of HeadToHead.tsx
import { countGames as countGameRecord } from '@/lib/game-record';

// replace the existing countGames(m) implementation with:
/** Count per-game W/L/T from a single matchup night */
function countGames(m: TeamH2HMatchup): { w: number; l: number; t: number } {
  return countGameRecord(
    [m.ourGame1, m.ourGame2, m.ourGame3],
    [m.theirGame1, m.theirGame2, m.theirGame3],
  );
}
```

Leave the local `nightRecordStr(m)` and `nightResultClass(m)` functions as-is - they call `countGames(m)` and keep working.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify HeadToHead renders unchanged**

Dev server is running on :3000. Open a team with h2h history, e.g. `http://localhost:3000/team/lucky-strikes`, and confirm the Head-to-Head night records (e.g. "2-1-0") still render with the same values and colors as before.

- [ ] **Step 4: Commit**

```bash
git add src/components/team/HeadToHead.tsx
git commit -m "refactor: HeadToHead uses shared game-record util"
```

---

### Task 3: Query - current-season team IDs + team schedule (with pure mapper)

**Files:**
- Create: `src/lib/queries/teams/schedule.ts`
- Test: `src/lib/queries/teams/schedule.test.ts`
- Modify: `src/lib/queries/teams/index.ts`

- [ ] **Step 1: Write the failing mapper test**

```ts
// src/lib/queries/teams/schedule.test.ts
import { describe, it, expect } from 'vitest';
import { shapeTeamScheduleRow } from './schedule';

describe('shapeTeamScheduleRow', () => {
  it('marks a row with a matchResults row as played and computes total', () => {
    const row = shapeTeamScheduleRow({
      week: 1, matchDate: '2026-07-20', opponentName: 'Gutterglory', opponentSlug: 'gutterglory',
      resultID: 500,
      ourGame1: 180, ourGame2: 190, ourGame3: 150,
      theirGame1: 170, theirGame2: 160, theirGame3: 200,
      gamePts: 4, xp: 3,
    });
    expect(row.played).toBe(true);
    expect(row.total).toBe(7);
    expect(row.gamePts).toBe(4);
    expect(row.xp).toBe(3);
    expect(row.opponentSlug).toBe('gutterglory');
  });

  it('marks a row with no matchResults row as unplayed with null totals', () => {
    const row = shapeTeamScheduleRow({
      week: 4, matchDate: '2026-08-24', opponentName: 'E-Bowla', opponentSlug: 'e-bowla',
      resultID: null,
      ourGame1: null, ourGame2: null, ourGame3: null,
      theirGame1: null, theirGame2: null, theirGame3: null,
      gamePts: null, xp: null,
    });
    expect(row.played).toBe(false);
    expect(row.total).toBeNull();
    expect(row.gamePts).toBeNull();
    expect(row.xp).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/queries/teams/schedule.test.ts`
Expected: FAIL - cannot resolve `./schedule`.

- [ ] **Step 3: Implement the query module**

```ts
// src/lib/queries/teams/schedule.ts
import { cache } from 'react';
import { getDb, cachedQuery } from '../../db';

export interface TeamScheduleRow {
  week: number;
  matchDate: string | null;
  opponentName: string;
  opponentSlug: string;
  played: boolean;
  ourGame1: number | null;
  ourGame2: number | null;
  ourGame3: number | null;
  theirGame1: number | null;
  theirGame2: number | null;
  theirGame3: number | null;
  gamePts: number | null;
  xp: number | null;
  total: number | null;
}

/** Raw row shape returned by GET_TEAM_CURRENT_SEASON_SCHEDULE_SQL. */
export interface TeamScheduleQueryRow {
  week: number;
  matchDate: string | null;
  opponentName: string;
  opponentSlug: string;
  resultID: number | null;
  ourGame1: number | null;
  ourGame2: number | null;
  ourGame3: number | null;
  theirGame1: number | null;
  theirGame2: number | null;
  theirGame3: number | null;
  gamePts: number | null;
  xp: number | null;
}

/** Pure mapper: raw SQL row -> display row (played flag + total). */
export function shapeTeamScheduleRow(r: TeamScheduleQueryRow): TeamScheduleRow {
  const played = r.resultID != null;
  const gamePts = played ? r.gamePts : null;
  const xp = played ? r.xp : null;
  const total = gamePts != null && xp != null ? gamePts + xp : null;
  return {
    week: r.week,
    matchDate: r.matchDate,
    opponentName: r.opponentName,
    opponentSlug: r.opponentSlug,
    played,
    ourGame1: r.ourGame1,
    ourGame2: r.ourGame2,
    ourGame3: r.ourGame3,
    theirGame1: r.theirGame1,
    theirGame2: r.theirGame2,
    theirGame3: r.theirGame3,
    gamePts,
    xp,
    total,
  };
}

// Latest season = highest year, Fall after Spring (matches getTeamCurrentRoster).
const LATEST_SEASON_SUBQUERY = `(
  SELECT TOP 1 seasonID FROM seasons
  ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
)`;

const GET_CURRENT_SEASON_TEAM_IDS_SQL = `
  SELECT DISTINCT teamID FROM (
    SELECT team1ID AS teamID FROM schedule WHERE seasonID = ${LATEST_SEASON_SUBQUERY}
    UNION
    SELECT team2ID AS teamID FROM schedule WHERE seasonID = ${LATEST_SEASON_SUBQUERY}
  ) t
  WHERE teamID IS NOT NULL
`;

/**
 * Set of team IDs scheduled in the current (latest) season. Schedule-based, so it is
 * populated in preseason (before any scores exist). React-cached so it runs once per build.
 */
export const getCurrentSeasonTeamIDs = cache(async (): Promise<Set<number>> => {
  const ids = await cachedQuery('getCurrentSeasonTeamIDs', async () => {
    const db = await getDb();
    const result = await db.request().query<{ teamID: number }>(GET_CURRENT_SEASON_TEAM_IDS_SQL);
    return result.recordset.map((r) => r.teamID);
  }, [], { sql: GET_CURRENT_SEASON_TEAM_IDS_SQL, dependsOn: ['schedule'] });
  return new Set(ids);
});

const GET_TEAM_CURRENT_SEASON_SCHEDULE_SQL = `
  WITH matchups AS (
    SELECT
      sch.week, sch.matchDate,
      sch.team2ID AS opponentID,
      mr.resultID,
      mr.team1Game1 AS ourGame1, mr.team1Game2 AS ourGame2, mr.team1Game3 AS ourGame3,
      mr.team2Game1 AS theirGame1, mr.team2Game2 AS theirGame2, mr.team2Game3 AS theirGame3,
      mr.team1GamePts AS gamePts, mr.team1BonusPts AS xp
    FROM schedule sch
    LEFT JOIN matchResults mr ON mr.scheduleID = sch.scheduleID
    WHERE sch.seasonID = @seasonID AND sch.team1ID = @teamID
    UNION ALL
    SELECT
      sch.week, sch.matchDate,
      sch.team1ID AS opponentID,
      mr.resultID,
      mr.team2Game1 AS ourGame1, mr.team2Game2 AS ourGame2, mr.team2Game3 AS ourGame3,
      mr.team1Game1 AS theirGame1, mr.team1Game2 AS theirGame2, mr.team1Game3 AS theirGame3,
      mr.team2GamePts AS gamePts, mr.team2BonusPts AS xp
    FROM schedule sch
    LEFT JOIN matchResults mr ON mr.scheduleID = sch.scheduleID
    WHERE sch.seasonID = @seasonID AND sch.team2ID = @teamID
  )
  SELECT
    m.week, m.matchDate,
    t.teamName AS opponentName,
    t.slug AS opponentSlug,
    m.resultID,
    m.ourGame1, m.ourGame2, m.ourGame3,
    m.theirGame1, m.theirGame2, m.theirGame3,
    m.gamePts, m.xp
  FROM matchups m
  JOIN teams t ON m.opponentID = t.teamID
  ORDER BY m.week, m.matchDate
`;

/**
 * The team's schedule for one season: every scheduled week, opponent, the team's own
 * match date, and per-game/points results once played (null while upcoming).
 */
export async function getTeamCurrentSeasonSchedule(
  teamID: number,
  seasonID: number,
): Promise<TeamScheduleRow[]> {
  return cachedQuery(`getTeamCurrentSeasonSchedule-${teamID}-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .input('seasonID', seasonID)
      .query<TeamScheduleQueryRow>(GET_TEAM_CURRENT_SEASON_SCHEDULE_SQL);
    return result.recordset.map(shapeTeamScheduleRow);
  }, [], { sql: GET_TEAM_CURRENT_SEASON_SCHEDULE_SQL, seasonID, dependsOn: ['scores', 'schedule'] });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/queries/teams/schedule.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Export from the teams barrel**

Add this line to `src/lib/queries/teams/index.ts` (alongside the other `export * from './...'` lines):

```ts
export * from './schedule';
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/queries/teams/schedule.ts src/lib/queries/teams/schedule.test.ts src/lib/queries/teams/index.ts
git commit -m "feat: add team current-season schedule query + current-season team IDs"
```

---

### Task 4: SeasonPointsStrip component (the stacked-bar strip)

**Files:**
- Create: `src/components/team/SeasonPointsStrip.tsx`

- [ ] **Step 1: Implement the strip**

Server component (no client JS): native `title` tooltip on hover, `Link` for click. `MAX_PTS = 9`, `UNIT = 7px` per point. Bottom-anchored stack via `flex-col-reverse` (game points first = bottom, XP above). Faint track shows the full 9. Upcoming weeks show only the gray track; the next unplayed week gets a star above its column.

```tsx
// src/components/team/SeasonPointsStrip.tsx
import Link from 'next/link';
import type { TeamScheduleRow } from '@/lib/queries';
import { nightRecordStr } from '@/lib/game-record';
import { formatMatchDate } from '@/lib/bowling-time';

const MAX_PTS = 9;
const UNIT = 7; // px per point
const TRACK_H = MAX_PTS * UNIT; // 63px

function tooltip(r: TeamScheduleRow): string {
  const date = formatMatchDate(r.matchDate, { month: 'short', day: 'numeric' }) ?? 'TBD';
  if (!r.played) return `Wk ${r.week} - ${date} - vs ${r.opponentName} - upcoming`;
  const rec = nightRecordStr(
    [r.ourGame1, r.ourGame2, r.ourGame3],
    [r.theirGame1, r.theirGame2, r.theirGame3],
  );
  return `Wk ${r.week} - ${date} - vs ${r.opponentName} - ${rec}, ${r.xp} XP - ${r.total} pts`;
}

export function SeasonPointsStrip({
  schedule,
  seasonSlug,
  nextWeek,
}: {
  schedule: TeamScheduleRow[];
  seasonSlug: string;
  nextWeek: number | null;
}) {
  return (
    <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
      {schedule.map((r) => {
        const gp = r.gamePts ?? 0;
        const xp = r.xp ?? 0;
        const isNext = r.week === nextWeek;
        return (
          <Link
            key={r.week}
            href={`/week/${seasonSlug}/${r.week}`}
            title={tooltip(r)}
            className="group flex flex-col items-center gap-1 shrink-0"
          >
            {/* star row: keep height stable whether or not the star shows */}
            <span className="h-3 text-amber-500 text-[10px] leading-none">{isNext ? '★' : ''}</span>
            <div
              className="relative w-4 rounded-sm bg-navy/[0.06] group-hover:bg-navy/10 transition-colors"
              style={{ height: TRACK_H }}
            >
              {r.played && (
                <div className="absolute inset-x-0 bottom-0 flex flex-col-reverse">
                  <div style={{ height: gp * UNIT }} className="bg-green-700" />
                  <div style={{ height: xp * UNIT }} className="bg-green-400" />
                </div>
              )}
            </div>
            <span className="text-[10px] font-body text-navy/50 tabular-nums leading-none">{r.week}</span>
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/team/SeasonPointsStrip.tsx
git commit -m "feat: add SeasonPointsStrip stacked-bar component"
```

---

### Task 5: TeamSchedule component (section = strip + table)

**Files:**
- Create: `src/components/team/TeamSchedule.tsx`

- [ ] **Step 1: Implement the section**

```tsx
// src/components/team/TeamSchedule.tsx
import Link from 'next/link';
import type { TeamScheduleRow } from '@/lib/queries';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { SeasonPointsStrip } from './SeasonPointsStrip';
import { nightRecordStr } from '@/lib/game-record';
import { formatMatchDate } from '@/lib/bowling-time';

const FULL_DATE: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };

export function TeamSchedule({
  schedule,
  seasonSlug,
}: {
  schedule: TeamScheduleRow[];
  seasonSlug: string;
}) {
  if (schedule.length === 0) return null;
  const nextWeek = schedule.find((r) => !r.played)?.week ?? null;

  return (
    <section id="schedule">
      <SectionHeading>Season Schedule</SectionHeading>

      <div className="mb-5">
        <SeasonPointsStrip schedule={schedule} seasonSlug={seasonSlug} nextWeek={nextWeek} />
      </div>

      <div className="bg-white border border-navy/10 rounded-lg shadow-sm overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-xs sm:text-base font-body">
          <thead>
            <tr className="border-b border-navy/10 text-navy/65 text-xs sm:text-sm uppercase tracking-wider">
              <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-right w-8 sm:w-10">Wk</th>
              <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left">Date</th>
              <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left">Opponent</th>
              <th className="px-2 py-1.5 sm:py-2 text-right">Record</th>
              <th className="px-2 py-1.5 sm:py-2 text-right hidden sm:table-cell">XP</th>
              <th className="px-2 py-1.5 sm:py-2 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((r) => {
              const isNext = r.week === nextWeek;
              const rec = r.played
                ? nightRecordStr(
                    [r.ourGame1, r.ourGame2, r.ourGame3],
                    [r.theirGame1, r.theirGame2, r.theirGame3],
                  )
                : null;
              return (
                <tr
                  key={r.week}
                  className={`border-b border-navy/5 ${isNext ? 'bg-amber-100/70 border-l-2 border-l-amber-400' : ''}`}
                >
                  <td className="px-2 py-1.5 sm:py-2.5 text-right tabular-nums text-navy/65">{r.week}</td>
                  <td className="px-2 py-1.5 sm:py-2.5 text-navy/70 whitespace-nowrap">
                    {formatMatchDate(r.matchDate, FULL_DATE) ?? 'TBD'}
                  </td>
                  <td className="px-2 py-1.5 sm:py-2.5 font-medium">
                    <Link href={`/team/${r.opponentSlug}`} className="text-navy hover:text-red-600 transition-colors">
                      {r.opponentName}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 sm:py-2.5 text-right tabular-nums text-navy/70">
                    {rec ?? (isNext ? <span className="text-amber-600 not-italic">Next</span> : <span className="text-navy/40">Upcoming</span>)}
                  </td>
                  <td className="px-2 py-1.5 sm:py-2.5 text-right tabular-nums text-navy/70 hidden sm:table-cell">
                    {r.played ? r.xp : ''}
                  </td>
                  <td className="px-2 py-1.5 sm:py-2.5 text-right tabular-nums font-semibold text-navy">
                    {r.played ? r.total : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/team/TeamSchedule.tsx
git commit -m "feat: add TeamSchedule section (strip + detail table)"
```

---

### Task 6: Wire into the team page

**Files:**
- Modify: `src/app/team/[slug]/page.tsx`

- [ ] **Step 1: Add imports**

Add to the existing imports near the top of the file:

```tsx
import { getTeamBySlug, getGhostTeamH2H, getAllTeamSlugs, getCurrentSeasonTeamIDs, getTeamCurrentSeasonSchedule, getCurrentSeasonID, type GhostTeamMatchup } from '@/lib/queries';
import { TeamSchedule } from '@/components/team/TeamSchedule';
```

(Merge the new names into the existing `@/lib/queries` import rather than adding a duplicate import line.)

- [ ] **Step 2: Fetch the schedule (gated, schedule-based)**

After the `ghostH2H` line (`const ghostH2H = isGhostTeam ? await getGhostTeamH2H() : [];`), add:

```tsx
  // Current-season schedule (schedule-based gate so it shows in preseason too).
  const currentSeasonTeamIDs = await getCurrentSeasonTeamIDs();
  const isCurrentSeasonTeam = !isGhostTeam && currentSeasonTeamIDs.has(team.teamID);
  let teamSchedule: Awaited<ReturnType<typeof getTeamCurrentSeasonSchedule>> = [];
  if (isCurrentSeasonTeam) {
    const currentSeasonID = await getCurrentSeasonID();
    if (currentSeasonID != null) {
      teamSchedule = await getTeamCurrentSeasonSchedule(team.teamID, currentSeasonID);
    }
  }
```

- [ ] **Step 3: Render the section at the top of the content stack**

In the JSX, the content stack begins with `<div className="mt-8 space-y-8">`. Insert the schedule as its first child, right after that opening div and before `{team.teamName === 'Ghost Team' && <GhostTeamExplainer />}`:

```tsx
        {teamSchedule.length > 0 && (
          <TeamSchedule schedule={teamSchedule} seasonSlug={currentSlug} />
        )}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/team/[slug]/page.tsx
git commit -m "feat: render Season Schedule on the team page for current-season teams"
```

---

### Task 7: Verify end-to-end on the dev server

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite**

Run: `npx vitest run src/lib/game-record.test.ts src/lib/queries/teams/schedule.test.ts`
Expected: PASS (6 tests total).

- [ ] **Step 2: Preseason (current) team - all upcoming**

Open `http://localhost:3000/team/lucky-strikes`. Expect: a "Season Schedule" section near the top with one bar per scheduled week (all gray tracks, star above week 1), and a table listing every week with the team's own date (e.g. week 1 = July 20), opponent links, "Next" on week 1, "Upcoming" after, and empty XP/Pts.

- [ ] **Step 3: Non-current-season team - no section**

Open a team not in the current season (a defunct franchise, e.g. any team whose latest activity predates the current season). Expect: no "Season Schedule" section renders.

- [ ] **Step 4: Played-state visual (spot check)**

Because the current season has no results yet, temporarily verify the played rendering by editing `src/app/team/[slug]/page.tsx` Step-2 block to pass a *past* seasonID with results (e.g. replace `currentSeasonID` with a literal like `35`) and reload a team from that season. Confirm: played weeks show a dark-green (game pts) + light-green (XP) stack summing to the night's points; the table shows the "2-1-0" record, XP, and Pts and they reconcile (W*2 + T*1 + XP == Pts). **Revert the temporary change afterward.**

- [ ] **Step 5: HeadToHead regression**

On the same team page, confirm the Head-to-Head night records still render correctly (Task 2 did not change behavior).

- [ ] **Step 6: Confirm no em dashes introduced**

Run: `grep -rn "—\|&mdash;\|---" src/lib/game-record.ts src/lib/queries/teams/schedule.ts src/components/team/SeasonPointsStrip.tsx src/components/team/TeamSchedule.tsx`
Expected: no matches.

---

## Notes / risks

- **Cost:** `getCurrentSeasonTeamIDs` is React-cached (runs once per build); `getTeamCurrentSeasonSchedule` runs only for the ~20 current-season teams. No cross-season query SQL changed, so no all-season cache bust.
- **Ghost/forfeit opponents:** if a current-season schedule row points at the Ghost Team (id 45) it will render as "vs Ghost Team". Acceptable for v1; revisit if it looks odd.
- **Record vs official pts:** the "W-L-T" record is derived from stored per-game handicap totals (same source `HeadToHead` uses); `Pts` is the stored authoritative total. In rare forfeit/3-bowler edge cases these could disagree, exactly as `HeadToHead` already does.
