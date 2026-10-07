# Weekly Writeup Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Write one" on the week page creates the recap post with Bowler of the Week, Team of the Week, Personal Bests and Career Milestones already written, context included.

**Architecture:** A pure formatter (`src/lib/writeup/draft.ts`, data in, markdown out, unit tested) and a data gatherer (`src/lib/writeup/draft-data.ts`, direct DB reads at click time). `POST /api/evillair/week-writeup` calls both when it creates a post and falls back to empty content if anything throws. BOTW, TOTW and personal-best counts reuse `computeWeeklyAwards()` so the draft and the week page cannot disagree.

**Tech Stack:** Next.js App Router route handler, `mssql`, vitest.

Spec: `docs/superpowers/specs/2026-10-07-weekly-writeup-draft-design.md`

**Project rules that apply** (from CLAUDE.md):
- No em dashes anywhere, including comments. Use a plain hyphen.
- Per-game counts use `SUM(gamesBowled)`, never `COUNT(*) * 3`.
- Do not run `next build` locally. Tests: `npx vitest run <path>`.
- Never `git add -A`; add the named files only.

---

## File map

- Create `src/lib/writeup/draft.ts`: types, `ordinal`, `rankAmong`, phrase helpers, `buildWeekDraft`.
- Create `src/lib/writeup/draft.test.ts`: unit tests for all of the above.
- Create `src/lib/writeup/draft-data.ts`: `gatherDraftInput(seasonID, week)`.
- Modify `src/app/api/evillair/week-writeup/route.ts`: `seasonRoman` also returns `seasonID`; POST builds the draft.
- Delete `scripts/create-weekly-post.mjs`.

---

### Task 1: Ordinals and ranking helpers

**Files:**
- Create: `src/lib/writeup/draft.ts`
- Test: `src/lib/writeup/draft.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/writeup/draft.test.ts
import { describe, it, expect } from 'vitest';
import { ordinal, rankAmong } from './draft';

describe('ordinal', () => {
  it.each([
    [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'],
    [11, '11th'], [12, '12th'], [13, '13th'],
    [21, '21st'], [22, '22nd'], [23, '23rd'],
    [101, '101st'], [111, '111th'], [112, '112th'],
  ])('%i -> %s', (n, s) => {
    expect(ordinal(n)).toBe(s);
  });
});

describe('rankAmong', () => {
  it('ranks highest first by default', () => {
    expect(rankAmong(741, [700, 741, 760, 650])).toEqual({ rank: 2, tied: false });
  });

  it('marks a tie when another value is equal', () => {
    expect(rankAmong(741, [741, 741, 760])).toEqual({ rank: 2, tied: true });
  });

  it('counts the value itself once even if it is in the list', () => {
    expect(rankAmong(800, [800])).toEqual({ rank: 1, tied: false });
  });

  it('ranks lowest first when asked (fastest = fewest games)', () => {
    expect(rankAmong(300, [280, 300, 300, 350], 'asc')).toEqual({ rank: 2, tied: true });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/writeup/draft.test.ts`
Expected: FAIL, cannot resolve `./draft`.

- [ ] **Step 3: Implement**

```ts
// src/lib/writeup/draft.ts
/**
 * The weekly recap draft: data in, markdown out. No DB access here, so every
 * wording rule is unit tested. See
 * docs/superpowers/specs/2026-10-07-weekly-writeup-draft-design.md.
 */

export interface RankInfo {
  rank: number;
  tied: boolean;
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/**
 * Standard competition rank of `value` within `all` (which should include the
 * value itself). 'desc' = higher is better, 'asc' = lower is better.
 */
export function rankAmong(value: number, all: number[], direction: 'desc' | 'asc' = 'desc'): RankInfo {
  const better = all.filter((v) => (direction === 'desc' ? v > value : v < value)).length;
  const equal = all.filter((v) => v === value).length;
  return { rank: better + 1, tied: equal > 1 };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/writeup/draft.test.ts`
Expected: PASS (17 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/writeup/draft.ts src/lib/writeup/draft.test.ts
git commit -m "feat(writeup): ordinal and rank helpers for the recap draft"
```

---

### Task 2: Phrase helpers

**Files:**
- Modify: `src/lib/writeup/draft.ts`
- Test: `src/lib/writeup/draft.test.ts`

- [ ] **Step 1: Write the failing tests** (append to the test file; extend the import line to `import { ordinal, rankAmong, seasonRankPhrase, clubPhrase, fastestPhrase, milestoneLabel } from './draft';`)

```ts
describe('seasonRankPhrase', () => {
  it('is null outside the top 10', () => {
    expect(seasonRankPhrase({ rank: 11, tied: false })).toBeNull();
  });
  it('reads "best of the season so far" for 1st', () => {
    expect(seasonRankPhrase({ rank: 1, tied: false })).toBe('best of the season so far');
  });
  it('reads "tied for best" for a shared 1st', () => {
    expect(seasonRankPhrase({ rank: 1, tied: true })).toBe('tied for best of the season so far');
  });
  it('reads "3rd best of the season"', () => {
    expect(seasonRankPhrase({ rank: 3, tied: false })).toBe('3rd best of the season');
  });
  it('reads "tied for 10th best of the season"', () => {
    expect(seasonRankPhrase({ rank: 10, tied: true })).toBe('tied for 10th best of the season');
  });
});

describe('clubPhrase', () => {
  it('reads "#91 in the club"', () => {
    expect(clubPhrase({ rank: 91, tied: false })).toBe('#91 in the club');
  });
  it('reads "tied for #90 in the club"', () => {
    expect(clubPhrase({ rank: 90, tied: true })).toBe('tied for #90 in the club');
  });
});

describe('fastestPhrase', () => {
  it('reads "9th fastest"', () => {
    expect(fastestPhrase({ rank: 9, tied: false })).toBe('9th fastest');
  });
  it('reads "fastest ever" for 1st', () => {
    expect(fastestPhrase({ rank: 1, tied: false })).toBe('fastest ever');
  });
  it('reads "tied for 4th fastest"', () => {
    expect(fastestPhrase({ rank: 4, tied: true })).toBe('tied for 4th fastest');
  });
  it('reads "tied for fastest ever" for a shared 1st', () => {
    expect(fastestPhrase({ rank: 1, tied: true })).toBe('tied for fastest ever');
  });
});

describe('milestoneLabel', () => {
  it.each([
    ['totalGames', 250, '250 career games'],
    ['totalPins', 100000, '100,000 career pins'],
    ['totalTurkeys', 100, '100 career turkeys'],
    ['games200Plus', 25, '25 200 games'],
    ['series600Plus', 10, '10 600 series'],
  ] as const)('%s %i -> %s', (category, threshold, label) => {
    expect(milestoneLabel(category, threshold)).toBe(label);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/writeup/draft.test.ts`
Expected: FAIL, `seasonRankPhrase` is not exported.

- [ ] **Step 3: Implement** (append to `draft.ts`; add the import at the top of the file)

```ts
import type { MilestoneCategory } from '@/lib/milestone-config';

const SEASON_RANK_CUTOFF = 10;

/** Season rank clause for a series, or null when it is not worth mentioning. */
export function seasonRankPhrase(r: RankInfo): string | null {
  if (r.rank > SEASON_RANK_CUTOFF) return null;
  const tie = r.tied ? 'tied for ' : '';
  if (r.rank === 1) return `${tie}best of the season so far`;
  return `${tie}${ordinal(r.rank)} best of the season`;
}

export function clubPhrase(r: RankInfo): string {
  return `${r.tied ? 'tied for ' : ''}#${r.rank} in the club`;
}

export function fastestPhrase(r: RankInfo): string {
  const tie = r.tied ? 'tied for ' : '';
  if (r.rank === 1) return `${tie}fastest ever`;
  return `${tie}${ordinal(r.rank)} fastest`;
}

// Russ's own wording from past recaps ("25 200 games", "100 Career turkeys").
const MILESTONE_NOUN: Record<MilestoneCategory, string> = {
  totalGames: 'career games',
  totalPins: 'career pins',
  totalTurkeys: 'career turkeys',
  games200Plus: '200 games',
  series600Plus: '600 series',
};

export function milestoneLabel(category: MilestoneCategory, threshold: number): string {
  return `${threshold.toLocaleString('en-US')} ${MILESTONE_NOUN[category]}`;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/writeup/draft.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/writeup/draft.ts src/lib/writeup/draft.test.ts
git commit -m "feat(writeup): season rank, club and fastest phrasing"
```

---

### Task 3: `buildWeekDraft`

**Files:**
- Modify: `src/lib/writeup/draft.ts`
- Test: `src/lib/writeup/draft.test.ts`

- [ ] **Step 1: Write the failing tests** (append; add `buildWeekDraft, type DraftInput` to the import)

```ts
const base: DraftInput = {
  bowlersOfWeek: [{ bowlerName: 'Vance Woods', teamName: 'HOT FUN', handSeries: 741, seasonRank: { rank: 3, tied: false } }],
  teamOfWeek: { teamName: 'Wild Llamas', hcpSeries: 2813, seasonRank: { rank: 1, tied: false } },
  personalBests: { highGames: 6, highSeries: 7 },
  milestones: [
    { bowlerName: 'Mark Oates', category: 'totalPins', threshold: 100000, club: { rank: 14, tied: false }, fastest: { rank: 9, tied: false } },
    { bowlerName: 'Kelly Shirley', category: 'totalGames', threshold: 250, club: { rank: 90, tied: true }, fastest: null },
  ],
};

describe('buildWeekDraft', () => {
  it('writes all four sections in Russ\'s format', () => {
    expect(buildWeekDraft(base)).toBe(
      [
        '**Bowler of the Week**: <bowler>Vance Woods</bowler> (HOT FUN) - 741 handicap series (3rd best of the season)',
        '',
        '**Team of the Week**: <team>Wild Llamas</team> - 2,813 handicap series (best of the season so far)',
        '',
        '**Personal Bests**: 6 all-time high games, 7 all-time high series, see below',
        '',
        '**Career Milestones**',
        '',
        '   - <bowler>Mark Oates</bowler> - 100,000 career pins, #14 in the club, 9th fastest',
        '   - <bowler>Kelly Shirley</bowler> - 250 career games, tied for #90 in the club',
        '',
      ].join('\n'),
    );
  });

  it('drops the season rank clause outside the top 10', () => {
    const out = buildWeekDraft({
      ...base,
      bowlersOfWeek: [{ ...base.bowlersOfWeek[0], seasonRank: { rank: 12, tied: false } }],
    });
    expect(out).toContain('(HOT FUN) - 741 handicap series\n');
  });

  it('joins tied bowlers of the week with "and"', () => {
    const out = buildWeekDraft({
      ...base,
      bowlersOfWeek: [
        { bowlerName: 'A One', teamName: 'T1', handSeries: 700, seasonRank: { rank: 20, tied: true } },
        { bowlerName: 'B Two', teamName: 'T2', handSeries: 700, seasonRank: { rank: 20, tied: true } },
      ],
    });
    expect(out).toContain('**Bowlers of the Week**: <bowler>A One</bowler> (T1) and <bowler>B Two</bowler> (T2) - 700 handicap series');
  });

  it('drops a zero personal-best clause, and the line when both are zero', () => {
    expect(buildWeekDraft({ ...base, personalBests: { highGames: 0, highSeries: 2 } }))
      .toContain('**Personal Bests**: 2 all-time high series, see below');
    expect(buildWeekDraft({ ...base, personalBests: { highGames: 1, highSeries: 0 } }))
      .toContain('**Personal Bests**: 1 all-time high game, see below');
    expect(buildWeekDraft({ ...base, personalBests: { highGames: 0, highSeries: 0 } }))
      .not.toContain('Personal Bests');
  });

  it('drops the milestones section when there are none', () => {
    expect(buildWeekDraft({ ...base, milestones: [] })).not.toContain('Career Milestones');
  });

  it('omits BOTW and TOTW lines when there is nothing to report', () => {
    const out = buildWeekDraft({ ...base, bowlersOfWeek: [], teamOfWeek: null });
    expect(out).not.toContain('of the Week');
  });

  it('never contains an em dash', () => {
    expect(buildWeekDraft(base)).not.toMatch(/\u2014/);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/writeup/draft.test.ts`
Expected: FAIL, `buildWeekDraft` is not exported.

- [ ] **Step 3: Implement** (append to `draft.ts`)

```ts
export interface DraftBowlerOfWeek {
  bowlerName: string;
  teamName: string;
  handSeries: number;
  seasonRank: RankInfo;
}

export interface DraftTeamOfWeek {
  teamName: string;
  hcpSeries: number;
  seasonRank: RankInfo;
}

export interface DraftMilestone {
  bowlerName: string;
  category: MilestoneCategory;
  threshold: number;
  club: RankInfo;
  /** null for games milestones: everyone takes the same number of games. */
  fastest: RankInfo | null;
}

export interface DraftInput {
  bowlersOfWeek: DraftBowlerOfWeek[];
  teamOfWeek: DraftTeamOfWeek | null;
  personalBests: { highGames: number; highSeries: number };
  milestones: DraftMilestone[];
}

const num = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function withRank(text: string, rank: RankInfo): string {
  const phrase = seasonRankPhrase(rank);
  return phrase ? `${text} (${phrase})` : text;
}

/** The recap post body. Each section is a paragraph; empty sections are left out. */
export function buildWeekDraft(input: DraftInput): string {
  const blocks: string[] = [];

  const botw = input.bowlersOfWeek;
  if (botw.length > 0) {
    const heading = botw.length > 1 ? 'Bowlers of the Week' : 'Bowler of the Week';
    const names = botw.map((b) => `<bowler>${b.bowlerName}</bowler> (${b.teamName})`).join(' and ');
    blocks.push(withRank(`**${heading}**: ${names} - ${num(botw[0].handSeries)} handicap series`, botw[0].seasonRank));
  }

  const totw = input.teamOfWeek;
  if (totw) {
    blocks.push(withRank(`**Team of the Week**: <team>${totw.teamName}</team> - ${num(totw.hcpSeries)} handicap series`, totw.seasonRank));
  }

  const { highGames, highSeries } = input.personalBests;
  const pbParts = [
    highGames > 0 ? plural(highGames, 'all-time high game', 'all-time high games') : null,
    highSeries > 0 ? `${highSeries} all-time high series` : null,
  ].filter(Boolean);
  if (pbParts.length > 0) {
    blocks.push(`**Personal Bests**: ${pbParts.join(', ')}, see below`);
  }

  if (input.milestones.length > 0) {
    const lines = input.milestones.map((m) => {
      const facts = [milestoneLabel(m.category, m.threshold), clubPhrase(m.club)];
      if (m.fastest) facts.push(fastestPhrase(m.fastest));
      return `   - <bowler>${m.bowlerName}</bowler> - ${facts.join(', ')}`;
    });
    blocks.push(`**Career Milestones**\n\n${lines.join('\n')}`);
  }

  return blocks.length > 0 ? `${blocks.join('\n\n')}\n` : '';
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/writeup/draft.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/writeup/draft.ts src/lib/writeup/draft.test.ts
git commit -m "feat(writeup): build the recap draft from week data"
```

---

### Task 4: Gather the draft's data

**Files:**
- Create: `src/lib/writeup/draft-data.ts`

No unit test: this file is only DB reads plus calls into already-tested functions. It is verified against the live DB in Task 6.

- [ ] **Step 1: Implement**

```ts
// src/lib/writeup/draft-data.ts
/**
 * Everything the recap draft needs, read at click time from the admin route.
 * Never runs at build time, so nothing here is cached and no page query changes.
 */
import sql from 'mssql';
import { getDb, withRetry } from '@/lib/db';
import { getWeekScores } from '@/lib/queries/seasons/weekly';
import { computeIndividualLeaders, computeWeeklyAwards } from '@/components/season/weekStatsUtils';
import type { MilestoneCategory } from '@/lib/milestone-config';
import { rankAmong, type DraftInput, type DraftMilestone } from './draft';

interface ClubRow {
  category: MilestoneCategory;
  threshold: number;
  bowlerID: number;
  bowlerName: string;
  seasonID: number;
  week: number;
  careerGames: number | null;
}

/** "Before or during this week" ordering key for (season, week). */
const when = (seasonID: number, week: number) => seasonID * 1000 + week;

export async function gatherDraftInput(seasonID: number, week: number): Promise<DraftInput> {
  const db = await getDb();

  // Same source as the week page, so BOTW/TOTW/personal bests always agree.
  const weekScores = await getWeekScores(seasonID, week);
  const { bowlers } = computeIndividualLeaders(weekScores, false);
  const { allTimeHighGames, allTimeHighSeries, bowlersOfWeek, teamOfWeek } = computeWeeklyAwards(weekScores, bowlers);

  // Season-to-date bowler series and team series, for the top-10 rank clause.
  // Team series sums handSeries over every row, penalties included, exactly as
  // computeWeeklyAwards does.
  const season = await withRetry(
    () =>
      db.request()
        .input('seasonID', sql.Int, seasonID)
        .input('week', sql.Int, week)
        .query<{ kind: 'bowler' | 'team'; series: number }>(`
          SELECT 'bowler' AS kind, CAST(handSeries AS INT) AS series
          FROM scores
          WHERE seasonID = @seasonID AND week <= @week AND isPenalty = 0 AND handSeries IS NOT NULL
          UNION ALL
          SELECT 'team', CAST(SUM(handSeries) AS INT)
          FROM scores
          WHERE seasonID = @seasonID AND week <= @week
          GROUP BY teamID, week
        `),
    'writeup-draft:season',
  );
  const bowlerSeries = season.recordset.filter((r) => r.kind === 'bowler').map((r) => r.series);
  const teamSeries = season.recordset.filter((r) => r.kind === 'team').map((r) => r.series);

  const teamNameBySlug = new Map(weekScores.map((s) => [s.bowlerSlug, s.teamName]));

  // Every member of every club someone joined this week, with career games
  // through the night they joined. SUM(gamesBowled), never COUNT * 3.
  const clubs = await withRetry(
    () =>
      db.request()
        .input('seasonID', sql.Int, seasonID)
        .input('week', sql.Int, week)
        .query<ClubRow>(`
          SELECT bm.category, bm.threshold, bm.bowlerID, b.bowlerName, bm.seasonID, bm.week,
            (SELECT SUM(sc.gamesBowled) FROM scores sc
             WHERE sc.bowlerID = bm.bowlerID AND sc.isPenalty = 0
               AND (sc.seasonID < bm.seasonID OR (sc.seasonID = bm.seasonID AND sc.week <= bm.week))
            ) AS careerGames
          FROM bowlerMilestones bm
          JOIN bowlers b ON b.bowlerID = bm.bowlerID
          WHERE EXISTS (
            SELECT 1 FROM bowlerMilestones t
            WHERE t.seasonID = @seasonID AND t.week = @week
              AND t.category = bm.category AND t.threshold = bm.threshold
          )
        `),
    'writeup-draft:clubs',
  );

  const milestones: DraftMilestone[] = clubs.recordset
    .filter((r) => r.seasonID === seasonID && r.week === week)
    .sort((a, b) => b.threshold - a.threshold) // the week page's order
    .map((m) => {
      const members = clubs.recordset.filter((r) => r.category === m.category && r.threshold === m.threshold);
      const club = rankAmong(when(m.seasonID, m.week), members.map((r) => when(r.seasonID, r.week)), 'asc');
      const fastest =
        m.category === 'totalGames' || m.careerGames == null
          ? null
          : rankAmong(
              m.careerGames,
              members.map((r) => r.careerGames).filter((g): g is number => g != null),
              'asc',
            );
      return { bowlerName: m.bowlerName, category: m.category, threshold: m.threshold, club, fastest };
    });

  return {
    bowlersOfWeek: bowlersOfWeek.map((b) => ({
      bowlerName: b.name,
      teamName: teamNameBySlug.get(b.slug) ?? '',
      handSeries: b.handSeries,
      seasonRank: rankAmong(b.handSeries, bowlerSeries),
    })),
    teamOfWeek: teamOfWeek
      ? { teamName: teamOfWeek.teamName, hcpSeries: teamOfWeek.hcpSeries, seasonRank: rankAmong(teamOfWeek.hcpSeries, teamSeries) }
      : null,
    personalBests: { highGames: allTimeHighGames.length, highSeries: allTimeHighSeries.length },
    milestones,
  };
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "writeup" ; echo exit=$?`
Expected: no lines mentioning `writeup` (grep exit 1). Fix any reported error before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/writeup/draft-data.ts
git commit -m "feat(writeup): gather recap draft data at click time"
```

---

### Task 5: Wire into the route

**Files:**
- Modify: `src/app/api/evillair/week-writeup/route.ts`

- [ ] **Step 1: `seasonRoman` returns the seasonID too**

Replace the function with:

```ts
async function seasonFor(seasonSlug: string): Promise<{ romanNumeral: string; seasonID: number } | null> {
  const db = await getDb();
  const r = await withRetry(
    () =>
      db
        .request()
        .input('slug', sql.VarChar(50), seasonSlug)
        .query<{ romanNumeral: string; seasonID: number }>(`
          SELECT TOP 1 romanNumeral, seasonID FROM seasons
          WHERE LOWER(CONCAT(period, '-', year)) = LOWER(@slug)
        `),
    'week-writeup:season',
  );
  return r.recordset[0] ?? null;
}
```

In `POST`, replace

```ts
    const roman = await seasonRoman(seasonSlug);
    if (!roman) {
```

with

```ts
    const season = await seasonFor(seasonSlug);
    if (!season) {
```

and add `const roman = season.romanNumeral;` on the line after that `if` block closes.

- [ ] **Step 2: Build the draft, fall back to empty**

Add the imports:

```ts
import { buildWeekDraft } from '@/lib/writeup/draft';
import { gatherDraftInput } from '@/lib/writeup/draft-data';
```

Replace

```ts
    // Empty content on purpose: every stat on the week page comes from the page
    // itself, so a template would only be something to delete.
    const postID = await createBlogPost({
      slug: recapSlug(roman, week),
      title: recapTitle(roman, week),
      content: '',
```

with

```ts
    // Start from a written draft (BOTW, TOTW, personal bests, milestones with
    // club and fastest ranks) so Russ only adds what he wants. A failure here
    // must never block writing a post, so it falls back to empty.
    let content = '';
    try {
      content = buildWeekDraft(await gatherDraftInput(season.seasonID, week));
    } catch (err) {
      console.error('[WEEK_WRITEUP] draft failed, creating an empty post', err);
    }
    const postID = await createBlogPost({
      slug: recapSlug(roman, week),
      title: recapTitle(roman, week),
      content,
```

- [ ] **Step 3: Type check and tests**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "writeup|week-writeup" ; npx vitest run src/lib/writeup`
Expected: no tsc lines; vitest PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/evillair/week-writeup/route.ts
git commit -m "feat(writeup): Write one starts from a drafted recap"
```

---

### Task 6: Verify against the live DB

Temporary script, not committed. Proves the club numbers match the historical `bowlerMilestones.ordinal` values and prints what week 7's draft data will be.

- [ ] **Step 1: Write `scripts/.tmp-check-clubs.mjs`**

```js
import sql from 'mssql';
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim();
}
const p = await sql.connect({ server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD, options: { encrypt: true } });
const rows = (await p.request().query(`SELECT category, threshold, bowlerID, seasonID, week, ordinal FROM bowlerMilestones`)).recordset;
await p.close();
const key = (r) => r.seasonID * 1000 + r.week;
let checked = 0, exact = 0; const off = [];
for (const r of rows.filter((x) => x.ordinal != null)) {
  const members = rows.filter((x) => x.category === r.category && x.threshold === r.threshold);
  const rank = members.filter((x) => key(x) < key(r)).length + 1;
  const sameWeek = members.filter((x) => key(x) === key(r)).length;
  checked++;
  // A same-week tie may have been stored as any ordinal inside the tied block.
  if (r.ordinal >= rank && r.ordinal < rank + sameWeek) exact++; else off.push({ ...r, rank });
}
console.log(`checked ${checked}, agree ${exact}, disagree ${off.length}`);
console.table(off.slice(0, 15));
```

- [ ] **Step 2: Run it**

Run: `node scripts/.tmp-check-clubs.mjs`
Expected: `disagree 0`. If not zero, stop and show Russ the table before going on: either the history has gaps (club numbers would be low) or the stored ordinals used another rule.

- [ ] **Step 3: Delete it**

Run: `rm scripts/.tmp-check-clubs.mjs`

---

### Task 7: Retire the MDX scaffold script

- [ ] **Step 1: Confirm nothing references it**

Run: `grep -rn "create-weekly-post" --exclude-dir=node_modules --exclude-dir=.next . | grep -v "^./docs/superpowers"`
Expected: no output (references in other docs: update them to point at "Write one" on the week page).

- [ ] **Step 2: Delete and commit**

```bash
git rm scripts/create-weekly-post.mjs
git commit -m "chore: drop the MDX recap scaffold, posts live in blogPosts"
```

---

### Task 8: End to end on localhost (with Russ)

- [ ] **Step 1:** Russ opens `http://localhost:3000/week/fall-2026/7` logged in and clicks **Write one**. This creates the real week 7 post (unpublished, so not public).
- [ ] **Step 2:** Read the draft back with a one-off query (`SELECT content FROM blogPosts WHERE seasonSlug='fall-2026' AND week=7`, using the env-loading pattern from Task 6) and check every number by hand against the week page: BOTW name/team/series, TOTW team/series, personal best counts against the "Milestones & Personal Bests" card, each milestone line.
- [ ] **Step 3:** Run `npx vitest run` (whole suite) and `node scripts/pre-push-check.mjs`. Both green.
- [ ] **Step 4:** Ask Russ before pushing. The route change ships with the next push; it touches no cached query.
