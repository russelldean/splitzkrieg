# Frame by Frame for Bowlers Who Skipped the Latest Season: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bowler with no nights in the latest scored season gets a full Frame by Frame built from the last season they bowled, and every scored bowler's page is prebuilt.

**Architecture:** The page picks the season (latest scored, else the bowler's latest), then calls the unchanged `getBowlerWrapped(bowlerID, seasonID)`. A `past` prop on `SeasonWrapped` switches about 20 "this season" phrases to "that season". Two tiny new queries in `src/lib/queries/bowlers.ts`. Spec: `docs/superpowers/specs/2026-11-10-frame-by-frame-last-season-design.md`.

**Tech Stack:** Next.js App Router, mssql via `cachedQuery`, vitest.

---

### Task 1: Two queries

**Files:**
- Modify: `src/lib/queries/bowlers.ts` (after `getLatestScoredSeasonID`, line ~427)

- [ ] **Step 1: Add the SQL and functions**

```ts
const GET_BOWLER_LATEST_SEASON_ID_SQL = `
  SELECT TOP 1 sn.seasonID FROM seasons sn
  WHERE EXISTS (SELECT 1 FROM scores sc WHERE sc.seasonID = sn.seasonID AND sc.bowlerID = @bowlerID AND sc.isPenalty = 0)
  ORDER BY sn.year DESC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END DESC
`;

/** The most recent season this bowler has a real score in, null if none. Frame by Frame falls back to it. */
export const getBowlerLatestSeasonID = cache(async (bowlerID: number): Promise<number | null> => {
  return cachedQuery(`getBowlerLatestSeasonID-${bowlerID}`, async () => {
    const db = await getDb();
    const result = await db.request().input('bowlerID', bowlerID).query<{ seasonID: number }>(GET_BOWLER_LATEST_SEASON_ID_SQL);
    return result.recordset[0]?.seasonID ?? null;
  }, null, { sql: GET_BOWLER_LATEST_SEASON_ID_SQL, bowlerID });
});

const GET_SCORED_BOWLER_SLUGS_SQL = `
  SELECT DISTINCT b.slug
  FROM bowlers b
  JOIN scores sc ON sc.bowlerID = b.bowlerID
  WHERE sc.isPenalty = 0 AND b.slug IS NOT NULL AND b.isPublic = 1
`;

/** Everyone public with at least one real score, for prebuilding Frame by Frame. */
export async function getScoredBowlerSlugs(): Promise<BowlerSlug[]> {
  return cachedQuery('getScoredBowlerSlugs', async () => {
    const db = await getDb();
    const result = await db.request().query<{ slug: string }>(GET_SCORED_BOWLER_SLUGS_SQL);
    return result.recordset;
  }, [], { sql: GET_SCORED_BOWLER_SLUGS_SQL, dependsOn: ['scores'] });
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit -p .`  Expected: no output.

### Task 2: Page picks the season and passes `past`

**Files:**
- Modify: `src/app/bowler/[slug]/frame-by-frame/page.tsx`

- [ ] **Step 1: Import and widen generateStaticParams**

Replace the import line and the params function:

```ts
import { getLatestScoredSeasonID, getBowlerLatestSeasonID, getScoredBowlerSlugs } from '@/lib/queries/bowlers';

// Under the full build, prebuild the recap for everyone who has ever scored
// (about 630 pages). Anyone else renders on their first visit.
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  if (process.env.BUILD_ALL === '1') {
    const bowlers = await getScoredBowlerSlugs();
    return bowlers.filter(b => b.slug).map(b => ({ slug: b.slug }));
  }
  return [];
}
```

- [ ] **Step 2: Fall back to the bowler's latest season**

Replace the body from `const [bowler, seasonID]` through the `SeasonWrapped` element:

```ts
  const [bowler, latestSeasonID] = await Promise.all([getBowlerBySlug(slug), getLatestScoredSeasonID()]);
  if (!bowler || latestSeasonID == null) notFound();

  // Someone who sat the latest season out gets the last season they bowled.
  const ownLatest = await getBowlerLatestSeasonID(bowler.bowlerID);
  if (ownLatest == null) notFound();
  const seasonID = ownLatest === latestSeasonID ? latestSeasonID : ownLatest;
  const past = seasonID !== latestSeasonID;

  const [wrapped, career] = await Promise.all([
    getBowlerWrapped(bowler.bowlerID, seasonID),
    getBowlerCareerSummary(bowler.bowlerID),
  ]);
  if (!wrapped) notFound();

  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splitzkrieg.com'}/bowler/${slug}/frame-by-frame`;

  return (
    <main className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <PreviewSwitcher current={slug} />
      <SeasonWrapped w={wrapped} career={career} shareUrl={shareUrl} past={past} />
    </main>
  );
```

Note: `ownLatest === latestSeasonID` is the only case where the bowler has nights in the latest season, since a bowler's own latest cannot be newer than the league's. The `past` flag is therefore exactly "the bowler skipped the latest season".

### Task 3: `past` wording in SeasonWrapped

**Files:**
- Modify: `src/components/bowler/wrapped/SeasonWrapped.tsx`

- [ ] **Step 1: Prop**

```ts
interface Props {
  w: BowlerWrapped;
  career: BowlerCareerSummary | null;
  shareUrl: string;
  /** True when the recap is for an earlier season than the league's latest. */
  past?: boolean;
}
```
and `export function SeasonWrapped({ w, career, shareUrl, past = false }: Props) {` with, right after `const season = ...`:
```ts
  const ts = past ? 'that season' : 'this season';
```

- [ ] **Step 2: Replace every "this season" inside the component body with `{ts}`**

Inside JSX text: `this season` becomes `{ts}`. Inside template strings and aria labels: `${ts}`. The four `ARCHETYPE` sentences at the top (lines 53 to 56) are module-level constants used by `Your style`; change the render site to append the season word instead: the constant drops " this season" and the render adds `{' '}{ts}.` Check with `grep -n 'this season' SeasonWrapped.tsx` that the only remaining hits are the comment on the narrative order and nothing user-facing.

- [ ] **Step 3: The three bespoke lines**

Nights card headline (line ~405) stays `You bowled N nights {ts}.`. The "You are missed." line changes its guard from `w.nights === 0 && missed` to `missed`.

Among your seasons (line ~501): `{past ? 'The season before you averaged' : 'Last season you averaged'} {o.previous.average.toFixed(1)}`.

Close card thanks (line ~792): the ternary becomes
```tsx
        {w.nights > 0 && !past
          ? <>Thank you, sincerely, for choosing to spend your Monday nights with Splitzkrieg.</>
          : <>Thank you, sincerely, for the time you spent with Splitzkrieg. The lanes are right where you left them.</>}
```

- [ ] **Step 4: Type check and em-dash sweep**

Run: `npx tsc --noEmit -p . && node scripts/pre-push-check.mjs`  Expected: clean.

### Task 4: Entry points

**Files:**
- Modify: `src/components/bowler/FrameByFrameBanner.tsx`
- Modify: `src/app/bowler/[slug]/page.tsx:143-148`
- Modify: `src/components/home/FrameByFrameCallout.tsx:28`

- [ ] **Step 1: Banner takes the season always plus a `current` flag**

```ts
interface Props {
  slug: string;
  /** Roman numeral of the season the recap covers. */
  season: string;
  /** False when that is an earlier season than the league's latest. */
  current: boolean;
}
```
Signature `export function FrameByFrameBanner({ slug, season, current }: Props)`. The eyebrow `<p>` renders unconditionally. The button text becomes `{current ? 'See your season' : 'See your bowling history'}`.

- [ ] **Step 2: Bowler page passes both**

```tsx
      {latestSeason && (
        <FrameByFrameBanner
          slug={slug}
          season={latestSeason.romanNumeral}
          current={isCurrentSeason}
        />
      )}
```

- [ ] **Step 3: Callout copy**

`If you ever bowled here, you have one. Find your name and see yours.`

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit -p .`  Expected: no output.

### Task 5: Verify in dev and commit

- [ ] **Step 1: Render four pages locally**

```bash
for s in john-williams outtama-tulachanh justin-faerber martin-hall; do
  curl -s -o /dev/null -w "$s %{http_code} %{time_total}s\n" http://localhost:3000/bowler/$s/frame-by-frame
done
```
Expected: four 200s. Then open John Williams in the browser: cover says Season XXXV, the stack has pins, average, best night, team; nights card says "that season" and "You are missed." is absent (May 2026 is under a year ago). Outtama: "You are missed." present. Martin Hall: unchanged from before, reads "this season".

- [ ] **Step 2: Tests, checks**

Run: `npx vitest run src/lib/views/bowler-wrapped.test.ts && node scripts/pre-push-check.mjs`  Expected: 37 passed, all checks OK.

- [ ] **Step 3: Commit**

```bash
git add src/lib/queries/bowlers.ts 'src/app/bowler/[slug]/frame-by-frame/page.tsx' 'src/app/bowler/[slug]/page.tsx' src/components/bowler/wrapped/SeasonWrapped.tsx src/components/bowler/FrameByFrameBanner.tsx src/components/home/FrameByFrameCallout.tsx docs/superpowers/specs/2026-11-10-frame-by-frame-last-season-design.md docs/superpowers/plans/2026-11-10-frame-by-frame-last-season.md
git commit -m "feat(frame-by-frame): build the recap from a bowler's last season when they skipped the latest, prebuild every scored bowler"
```
Remind Russ about the `siteUpdates` changelog row.
