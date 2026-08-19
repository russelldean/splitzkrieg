# Merge Weekly Recap into the Week Page - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/week/[seasonSlug]/[weekNum]` the single destination for a league night - full stats plus Russ's writeup and photo - and retire the separate blog recap page.

**Architecture:** The week page already renders awards, match results, XP rankings, milestones and personal bests, and every query it runs is week-scoped (`getStandingsSnapshot(seasonID, week)` etc.), so it is already a faithful historical record. We add four things to it: the post's hero image, the post body in a collapsible `<details>` block, the standings and leaderboards snapshots that currently only exist in the blog recap, and the next-league-night line. Then `/blog/[slug]` server-redirects recap posts to their week page, the blog index links straight to week pages, and the weekly email points there too. `/blog` survives as the photo-led chronological index; standalone (non-recap) posts keep their own URLs.

The writeup opens expanded on the current season and collapsed on past seasons, using native `<details open>` so there is no JS and no hydration mismatch on a statically prebuilt site.

**Tech Stack:** Next.js App Router (RSC, static generation via `generateStaticParams`), TypeScript, Tailwind, `next-mdx-remote/rsc`, vitest.

---

## Context an implementer needs

**Post data shape** (`src/lib/blog.ts:6-19`):

```ts
export interface PostMeta {
  title: string;
  date: string;
  slug: string;
  excerpt: string;
  type: 'recap' | 'announcement';
  season?: string;        // roman numeral, e.g. "XXXVI"
  seasonSlug?: string;    // e.g. "fall-2026"
  week?: number;
  heroImage?: string;
  heroFocalY?: number;
  cardImage?: string;
  cardFocalY?: number;
}
```

**Existing helpers** (do not redefine):
- `getPostForWeek(season: string, week: number): Promise<PostMeta | undefined>` - `src/lib/blog.ts:90`
- `getPostContent(slug: string): Promise<string | undefined>` - `src/lib/blog.ts:61`
- `getCurrentSeasonSlug(): Promise<string | undefined>` - `src/lib/queries/seasons/core.ts:139`
- `CompactStandingsPreview({ standings, weekNumber })` - `src/components/blog/CompactStandingsPreview.tsx:9`
- `CompactLeaderboardPreview({ seasonSlug, week })` - `src/components/blog/CompactLeaderboardPreview.tsx`

**Post inventory as of 2026-08-19** - 10 posts, 9 are recaps carrying both a `week` and an embedded `<WeekRecap ... />` in the body; 1 (`some-lines-shouldn-t-be-crossed`, postID 2) is a standalone announcement with no week. Season slugs in use: `spring-2026` (XXXV), `fall-2026` (XXXVI).

**Critical:** every recap body ends with `<WeekRecap season="..." seasonSlug="..." week="..." />`. When the body is rendered on the week page, that component must render **nothing** or the stats appear twice. We do this by overriding the component map, not by editing post content.

**Testing reality:** this repo uses vitest for pure logic only (`src/lib/*.test.ts`). There is no React testing library. So tasks 1 and 5 are genuinely TDD; the JSX composition tasks are verified by running `npm run dev` and looking at the page. Do not invent component tests.

---

## File Structure

**Create:**
- `src/lib/week-writeup.ts` - pure decisions: should the writeup open expanded, and what week path does a post map to
- `src/lib/week-writeup.test.ts` - vitest coverage for the above
- `src/components/week/WeekWriteup.tsx` - the collapsible writeup block, renders post MDX with `WeekRecap` neutralised
- `src/components/week/WeekLeaderboards.tsx` - week-scoped leaderboards at full depth (server component)

**Modify:**
- `src/lib/queries/blog.ts` - season-scope the two snapshot queries (Task 0, ships first)
- `src/app/week/[seasonSlug]/[weekNum]/page.tsx` - replace the blog cross-link card with hero + writeup; add standings, leaderboards, next league night
- `src/app/blog/[slug]/page.tsx` - redirect recap posts to their week page
- `src/app/blog/page.tsx` - index cards link to week pages for recaps
- `src/app/api/evillair/email/route.ts:141` - email links to the week page
- `src/components/blog/WeekRecap.tsx` - drop the DiscoverySection block
- `src/app/evillair/(dashboard)/blog/[id]/page.tsx` - remove the "Around the Site" admin UI

**Delete:**
- `src/components/blog/DiscoverySection.tsx`

---

### Task 0: Re-scope the two snapshot queries from channel to season

**This must land, and deploy, before any other task.**

`getStandingsSnapshot` and `getLeaderboardSnapshot` currently use `dependsOn: ['schedule']` and `dependsOn: ['scores']`. In `src/lib/db.ts:310-315`, `dependsOn` resolves to `CHANNEL_HASHES[ch]`, which is an md5 of the **entire** channel object across every season. So bumping any one season's version invalidates that query for **all** seasons.

Today those two queries feed 10 blog recap pages, so a publish re-runs about 40 queries and nobody notices. Task 4 puts them on 325 week pages. At that point every weekly publish would invalidate all 325 week pages and force them to re-query, which is the 2026-05-05 incident: a cross-season query cascading to every season and overrunning Azure SQL's 30-connection cap mid-build.

Season scoping is also more correct: a week-3 snapshot for Season 36 depends only on Season 36 data. And `src/lib/db.ts:325-330` shows the season-scoped tag already combines **all** channel versions for that season (`${ch}${versions[seasonID]}`), so nothing is lost by dropping `dependsOn`.

Doing this now busts about 40 cache entries. Doing it after Task 4 would bust 325 pages' worth in one deploy, past the "never bust >20 query caches in one deploy" rule in `CLAUDE.md`.

**Files:**
- Modify: `src/lib/queries/blog.ts:363` and `src/lib/queries/blog.ts:446`

- [ ] **Step 1: Re-scope getStandingsSnapshot**

At `src/lib/queries/blog.ts:363`, replace:

```ts
  }, [], { sql: STANDINGS_SNAPSHOT_SQL + params, dependsOn: ['schedule'] });
```

with:

```ts
  // Season-scoped, not channel-scoped: a week-N snapshot depends only on this
  // season's data, and the season tag already folds in every channel version for
  // that season. Channel scoping would invalidate all 325 week pages on any
  // publish once this query moves onto the week page.
  }, [], { sql: STANDINGS_SNAPSHOT_SQL + params, seasonID });
```

- [ ] **Step 2: Re-scope getLeaderboardSnapshot**

At `src/lib/queries/blog.ts:446`, replace:

```ts
  }, [], { sql: sql + params, dependsOn: ['scores'] });
```

with:

```ts
  // Season-scoped for the same reason as getStandingsSnapshot above.
  }, [], { sql: sql + params, seasonID });
```

- [ ] **Step 3: Verify the cache invariants still hold**

Run: `node scripts/check-cache-invariants.mjs`

Expected: 0 violations. Neither query is `stable: true`, and both now carry `seasonID`, which is the same scoping every other week-page query uses.

- [ ] **Step 4: Confirm the blast radius before pushing**

Run: `ls .next/cache/sql/v1 | grep -cE "getStandingsSnapshot|getLeaderboardSnapshot"`

Expected: a number in the low dozens (roughly 4 entries per recap page). If it is over 20, note it and deploy this task alone anyway, with nothing else in the push.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/blog.ts
git commit -m "perf(cache): season-scope the standings and leaderboard snapshots

Both used dependsOn channel hashes, which are computed across ALL seasons, so
any publish invalidated them everywhere. Harmless while they fed 10 blog pages;
a cascade risk the moment they move onto 325 week pages. Season scoping already
folds in every channel version for that season, so nothing is lost."
```

- [ ] **Step 6: Deploy this alone and let it settle before starting Task 1**

Push it by itself. Do not stack the rest of the plan on the same deploy.

---

### Task 1: Pure decisions for the writeup

**Files:**
- Create: `src/lib/week-writeup.ts`
- Test: `src/lib/week-writeup.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/week-writeup.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { shouldExpandWriteup, weekPathForPost } from './week-writeup';
import type { PostMeta } from './blog';

const post = (over: Partial<PostMeta> = {}): PostMeta => ({
  title: 'Season XXXVI - Week 3 Recap',
  date: '2026-08-18',
  slug: 'season-xxxvi-week-3-recap',
  excerpt: 'Season XXXVI Week 3 recap',
  type: 'recap',
  season: 'XXXVI',
  seasonSlug: 'fall-2026',
  week: 3,
  ...over,
});

describe('shouldExpandWriteup', () => {
  it('expands when the post is in the current season', () => {
    expect(shouldExpandWriteup('fall-2026', 'fall-2026')).toBe(true);
  });

  it('collapses when the post is in a past season', () => {
    expect(shouldExpandWriteup('spring-2026', 'fall-2026')).toBe(false);
  });

  it('expands when the current season is unknown, so nothing hides by accident', () => {
    expect(shouldExpandWriteup('fall-2026', undefined)).toBe(true);
  });

  it('collapses when the post has no season slug', () => {
    expect(shouldExpandWriteup(undefined, 'fall-2026')).toBe(false);
  });
});

describe('weekPathForPost', () => {
  it('maps a recap to its week page', () => {
    expect(weekPathForPost(post())).toBe('/week/fall-2026/3');
  });

  it('maps a recap with a custom slug to its week page', () => {
    expect(
      weekPathForPost(
        post({ slug: 'this-site-built-entirely-on-a-brunswick-2000', seasonSlug: 'spring-2026', week: 4 }),
      ),
    ).toBe('/week/spring-2026/4');
  });

  it('returns null for an announcement with no week', () => {
    expect(
      weekPathForPost(
        post({ type: 'announcement', season: undefined, seasonSlug: undefined, week: undefined }),
      ),
    ).toBeNull();
  });

  it('returns null when the week is present but the season slug is not', () => {
    expect(weekPathForPost(post({ seasonSlug: undefined }))).toBeNull();
  });

  it('treats week 0 as a real week', () => {
    expect(weekPathForPost(post({ week: 0 }))).toBe('/week/fall-2026/0');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/week-writeup.test.ts`

Expected: FAIL - `Failed to resolve import "./week-writeup"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/week-writeup.ts`:

```ts
import type { PostMeta } from './blog';

/**
 * Should the writeup block start expanded?
 *
 * Current season expands, past seasons collapse. This is deliberately seasonal
 * rather than an age in days: the site is statically prebuilt, so any day-count
 * rule would be evaluated at BUILD time and would silently depend on how recently
 * we deployed. A season rule flips once per page, at changeover, which already
 * has a cold rebuild in the ritual.
 */
export function shouldExpandWriteup(
  postSeasonSlug: string | undefined,
  currentSeasonSlug: string | undefined,
): boolean {
  if (!postSeasonSlug) return false;
  // Unknown current season: expand rather than hide Russ's writing by accident.
  if (!currentSeasonSlug) return true;
  return postSeasonSlug === currentSeasonSlug;
}

/**
 * The week page a post belongs to, or null if it is not week-scoped.
 * Keyed on seasonSlug + week rather than `type`, because at least one recap
 * (postID 1) carries a custom slug and a title that does not look like a recap.
 */
export function weekPathForPost(post: PostMeta): string | null {
  if (!post.seasonSlug || post.week == null) return null;
  return `/week/${post.seasonSlug}/${post.week}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/week-writeup.test.ts`

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/week-writeup.ts src/lib/week-writeup.test.ts
git commit -m "feat(week): pure helpers for writeup expansion and week paths"
```

---

### Task 2: The collapsible writeup component

**Files:**
- Create: `src/components/week/WeekWriteup.tsx`

No test: this is JSX composition, and the repo has no React test setup. Behaviour is verified in Task 3 via `npm run dev`.

- [ ] **Step 1: Create the component**

Create `src/components/week/WeekWriteup.tsx`:

```tsx
import { MDXRemote } from 'next-mdx-remote/rsc';
import { mdxComponents } from '@/lib/mdx-components';

interface Props {
  /** Raw MDX body of the post. */
  content: string;
  /** Post title, used in the summary line. */
  title: string;
  /** Week number, used in the summary line. */
  weekNum: number;
  /** Whether the block starts open. */
  defaultOpen: boolean;
}

/**
 * Russ's writeup for a league night, rendered inline on the week page.
 *
 * Native <details> rather than a JS toggle: the site is fully prebuilt, so a
 * client-state default risks a hydration mismatch. <details open> is resolved
 * at render time, needs no JS, and is keyboard accessible for free.
 *
 * Recap bodies end with <WeekRecap ... />, which used to render the condensed
 * stats inside the blog post. The week page renders the real stats itself, so
 * that component is neutralised here rather than edited out of stored content.
 */
export function WeekWriteup({ content, title, weekNum, defaultOpen }: Props) {
  const components = {
    ...mdxComponents,
    WeekRecap: () => null,
  };

  return (
    <details
      open={defaultOpen}
      className="group mb-6 rounded-xl border border-navy/10 bg-white shadow-sm overflow-hidden"
    >
      <summary className="cursor-pointer list-none px-4 py-3 sm:px-5 hover:bg-navy/[0.02] transition-colors">
        <span className="flex items-center gap-2">
          <svg
            className="w-4 h-4 shrink-0 text-navy/50 transition-transform group-open:rotate-90"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="font-heading text-base sm:text-lg text-navy">
            Week {weekNum} Recap
          </span>
          <span className="sr-only">{title}</span>
        </span>
      </summary>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 border-t border-navy/10">
        <MDXRemote source={content} components={components} />
      </div>
    </details>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: no errors mentioning `WeekWriteup.tsx`. (Pre-existing errors elsewhere are fine; this codebase is not type-clean everywhere.)

- [ ] **Step 3: Commit**

```bash
git add src/components/week/WeekWriteup.tsx
git commit -m "feat(week): collapsible writeup block using native details"
```

---

### Task 2b: Expose the feature callout as an MDX component

Today the "NEW feature" box is a `callout` prop threaded into `<WeekRecap callout={...} />`. Since `WeekRecap` is neutralised on the week page, that route disappears. Russ still wants to call out a new feature, so make the box something he writes directly in the post body instead.

**Files:**
- Modify: `src/lib/mdx-components.tsx`

- [ ] **Step 1: Register the component**

In `src/lib/mdx-components.tsx`, add the import alongside the existing ones:

```tsx
import { RecapCallout } from '@/components/blog/RecapCallout';
```

Then add this wrapper above the `mdxComponents` object:

```tsx
/**
 * Feature callout, written directly in a post body:
 *   <Callout headline="..." description="..." href="/x" linkText="Take a look" />
 * Wraps RecapCallout, which takes a single `callout` object, so MDX can pass
 * flat attributes. Lives in the shared map so it works on the week page (inside
 * the collapsible writeup) and on standalone blog posts alike.
 */
function Callout({
  headline,
  description,
  href,
  linkText,
}: {
  headline: string;
  description: string;
  href?: string;
  linkText?: string;
}) {
  return <RecapCallout callout={{ headline, description, href, linkText }} />;
}
```

And register it in the `mdxComponents` object, next to `Bowler` and `Team`:

```tsx
  Callout,
```

- [ ] **Step 2: Verify it renders**

Run: `npm run dev`

Temporarily add this line to the top of the week 3 post body via `/evillair/blog/16`, save, then view `/week/fall-2026/3`:

```mdx
<Callout headline="Test callout" description="Checking the MDX component renders." href="/teams" linkText="Teams" />
```

Expected: the red-bordered box with a NEW badge, headline, description and a working "Teams" link, rendered inside the writeup block.

**Remove the test line from the post before committing.**

- [ ] **Step 3: Commit**

```bash
git add src/lib/mdx-components.tsx
git commit -m "feat(blog): expose the feature callout as an MDX <Callout> component

Was a prop threaded through WeekRecap, which the week page neutralises. Writing
it directly in the body keeps the styled NEW box available inside the writeup."
```

---

### Task 3: Put the hero and writeup on the week page

**Files:**
- Modify: `src/app/week/[seasonSlug]/[weekNum]/page.tsx`

The block being replaced is the "Blog cross-link" card - the `{blogPost && (<Link href={`/blog/${blogPost.slug}`} ...>)}` JSX that renders a teaser reading "Read the full Week N recap". Locate it by searching for `Blog cross-link`.

- [ ] **Step 1: Add the imports**

At the top of the file, alongside the existing imports, add:

```tsx
import { getPostForWeek, getPostContent } from '@/lib/blog';
import { getCurrentSeasonSlug } from '@/lib/queries';
import { WeekWriteup } from '@/components/week/WeekWriteup';
import { shouldExpandWriteup } from '@/lib/week-writeup';
```

`getPostForWeek` is likely already imported - do not duplicate it. `getCurrentSeasonSlug` is likely already imported for the redirect at the top of the file; check before adding.

- [ ] **Step 2: Fetch the content and the current season**

Immediately after the existing `const blogPost = await getPostForWeek(season.romanNumeral, weekNum);` line, add:

```tsx
  const writeupContent = blogPost ? await getPostContent(blogPost.slug) : undefined;
  const currentSeasonSlug = await getCurrentSeasonSlug();
```

- [ ] **Step 3: Replace the blog cross-link card**

Delete the entire `{/* Blog cross-link */}` block (from the comment through its closing `)}`), and put this in its place:

```tsx
      {/* Hero photo from the week's post */}
      {blogPost?.heroImage && (
        <div className="relative mb-4 h-40 sm:h-52 rounded-xl overflow-hidden shadow-md ring-1 ring-navy/10">
          <Image
            src={blogPost.heroImage}
            alt=""
            fill
            className="object-cover"
            style={{ objectPosition: `center ${(blogPost.heroFocalY ?? 0.5) * 100}%` }}
            sizes="(max-width: 1024px) 100vw, 960px"
          />
        </div>
      )}

      {/* Russ's writeup for the night */}
      {blogPost && writeupContent && (
        <WeekWriteup
          content={writeupContent}
          title={blogPost.title}
          weekNum={weekNum}
          defaultOpen={shouldExpandWriteup(blogPost.seasonSlug, currentSeasonSlug)}
        />
      )}
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`

Check these four URLs:
- `http://localhost:3000/week/fall-2026/3` - berry hero at top, writeup block **expanded** (current season), stats below it
- `http://localhost:3000/week/spring-2026/8` - writeup block **collapsed**, clicking the summary opens it
- `http://localhost:3000/week/spring-2026/1` - no post exists for this week, so **no hero and no writeup block**, page otherwise unchanged
- Confirm on `/week/fall-2026/3` that the condensed recap stats do **not** appear inside the writeup (the `WeekRecap: () => null` override is working)

- [ ] **Step 5: Commit**

```bash
git add "src/app/week/[seasonSlug]/[weekNum]/page.tsx"
git commit -m "feat(week): render the week's hero photo and writeup on the week page"
```

---

### Task 4: Add standings, leaderboards and next league night to the week page

These three exist only in the blog recap today. They are what makes the week page a complete replacement.

**Files:**
- Modify: `src/app/week/[seasonSlug]/[weekNum]/page.tsx`

Russ's call: **drop Cloud 9** (all matches are on this page anyway, so the highlight is redundant) and **expand the leaderboards** from the compact top 3 to the same depth `/stats` shows.

`getLeaderboardSnapshot(seasonID, week, gender, category, limit = 10)` already takes a limit and supports `'avg' | 'highSeries' | 'hcpAvg'`. `/stats` shows Top 10 Average and Top 10 High Game per gender plus Handicap Average; the week-scoped query offers High Series rather than High Game, so that is the closest faithful equivalent.

Do **not** reuse `src/components/season/SeasonLeaderboards.tsx`. It is a client component whose props demand `mensScratchPlayoffIDs`, `hcpIneligibleIDs`, `champions` and similar season-level concepts. Playoff qualification and champions are meaningless "as of week 3", and passing empty sets to satisfy the types would render misleading furniture.

- [ ] **Step 1: Build the full week-scoped leaderboards component**

Create `src/components/week/WeekLeaderboards.tsx`:

```tsx
import Link from 'next/link';
import { getLeaderboardSnapshot } from '@/lib/queries/blog';
import type { SeasonLeaderEntry } from '@/lib/queries';

interface Props {
  seasonID: number;
  week: number;
}

/**
 * Season leaderboards as of a given week, at full depth.
 *
 * Deliberately not SeasonLeaderboards from /stats: that is a client component
 * requiring playoff-qualification sets and champions, which are meaningless
 * partway through a season. This is a server component reading the same
 * week-scoped snapshot query the blog recap used, without the top-3 truncation.
 */
export async function WeekLeaderboards({ seasonID, week }: Props) {
  const [mensAvg, mensSeries, womensAvg, womensSeries, hcpAvg] = await Promise.all([
    getLeaderboardSnapshot(seasonID, week, 'M', 'avg'),
    getLeaderboardSnapshot(seasonID, week, 'M', 'highSeries'),
    getLeaderboardSnapshot(seasonID, week, 'F', 'avg'),
    getLeaderboardSnapshot(seasonID, week, 'F', 'highSeries'),
    getLeaderboardSnapshot(seasonID, week, null, 'hcpAvg'),
  ]);

  if (mensAvg.length === 0 && womensAvg.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Board title="Men's Scratch Average" entries={mensAvg} />
      <Board title="Women's Scratch Average" entries={womensAvg} />
      <Board title="Handicap Average" entries={hcpAvg} />
      <Board title="Men's High Series" entries={mensSeries} />
      <Board title="Women's High Series" entries={womensSeries} />
    </div>
  );
}

function Board({ title, entries }: { title: string; entries: SeasonLeaderEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="bg-white border border-navy/10 rounded-lg shadow-sm p-3">
      <h4 className="font-heading text-sm text-navy/70 mb-2">{title}</h4>
      <ol className="space-y-1">
        {entries.map((e, i) => (
          <li key={e.slug} className="flex items-baseline gap-2 font-body text-sm">
            <span className="w-5 shrink-0 tabular-nums text-navy/40">{i + 1}</span>
            <Link
              href={`/bowler/${e.slug}`}
              className="flex-1 min-w-0 truncate text-navy hover:text-red-600 transition-colors"
            >
              {e.bowlerName}
            </Link>
            <span className="tabular-nums font-semibold text-navy shrink-0">{e.value}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

`getLeaderboardSnapshot` defaults to `limit = 10`, so each board shows up to 10 without passing anything.

- [ ] **Step 2: Add the imports to the week page**

```tsx
import { CompactStandingsPreview } from '@/components/blog/CompactStandingsPreview';
import { WeekLeaderboards } from '@/components/week/WeekLeaderboards';
```

- [ ] **Step 3: Insert the sections**

Inside the non-future-week fragment, immediately **after** the `<TrackVisibility section="highlights" page="week">` block and before the closing `</>`, add:

```tsx
          {/* Standings as of this week */}
          <TrackVisibility section="standings-snapshot" page="week">
            <div className="mt-6">
              <SectionHeading>Standings</SectionHeading>
              <p className="font-body text-sm text-navy/65 mb-2">
                If the season ended today, playoff teams are:
              </p>
              <CompactStandingsPreview standings={standings} weekNumber={weekNum} />
            </div>
          </TrackVisibility>

          {/* Leaderboards as of this week - full depth, not the compact top 3 */}
          <TrackVisibility section="leaderboards-snapshot" page="week">
            <div className="mt-6">
              <SectionHeading>Leaderboards</SectionHeading>
              <WeekLeaderboards seasonID={season.seasonID} week={weekNum} />
            </div>
          </TrackVisibility>
```

`CompactLeaderboardPreview` truncates to the top 3 with `.slice(0, 3)` and only covers three boards; the week page shows the same depth as `/stats`.

Then, immediately before the closing `</main>` and after `<NextStopNudge ... />`, add the next-league-night line:

```tsx
      {(() => {
        const nextWeekSchedule = allSchedule.find((s) => s.week === weekNum + 1);
        if (!nextWeekSchedule?.matchDate) return null;
        const date = new Date(nextWeekSchedule.matchDate);
        const formatted = date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          timeZone: 'UTC',
        });
        return (
          <p className="font-body text-navy/80 text-center text-lg mt-6">
            Next League Night is {formatted}.
          </p>
        );
      })()}
```

`allSchedule` is the full season schedule already in scope (it is what `weekSchedule` is filtered from at line 117). `SectionHeading` is already imported at line 26. No new query and no new import beyond the two `Compact*` components.

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`

- `http://localhost:3000/week/fall-2026/3` - standings and leaderboards now appear below highlights, and "Next League Night is Monday, August 24." appears at the bottom
- `http://localhost:3000/week/fall-2026/3` standings must match `/season/fall-2026` **as of week 3**, not current standings
- `http://localhost:3000/week/spring-2026/9` - final week of a finished season shows standings and leaderboards, and **no** next-league-night line

- [ ] **Step 5: Commit**

```bash
git add "src/app/week/[seasonSlug]/[weekNum]/page.tsx" src/components/week/WeekLeaderboards.tsx
git commit -m "feat(week): add standings and full leaderboards snapshots and next league night"
```

---

### Task 5: Redirect recap posts to their week page

Every weekly email ever sent links to `https://splitzkrieg.com/blog/<slug>` (`src/app/api/evillair/email/route.ts:141`). Those URLs are in inboxes permanently and must keep resolving.

We do this in the page rather than `next.config.ts` because the mapping from a slug to a week path needs post data - a roman numeral cannot be turned into a season slug by regex.

**Files:**
- Modify: `src/app/blog/[slug]/page.tsx`
- Test: `src/lib/week-writeup.test.ts` (already covers `weekPathForPost`, no new tests needed)

- [ ] **Step 1: Add the imports**

```tsx
import { redirect } from 'next/navigation';
import { weekPathForPost } from '@/lib/week-writeup';
```

- [ ] **Step 2: Redirect before rendering**

In `BlogPostPage` (line 57), immediately **after** line 82's `if (!meta || !content) notFound();`, add:

```tsx
  // Weekly recaps now live on the week page. Old /blog/<slug> links are in every
  // weekly email ever sent, so they must keep resolving.
  // Draft previews are exempt: Russ needs to proof an unpublished recap in place.
  const weekPath = weekPathForPost(meta);
  if (weekPath && !isDraft) redirect(weekPath);
```

`isDraft` is already in scope from line 63 (`const { isEnabled: isDraft } = await draftMode();`). `redirect()` throws, so nothing below it runs. Standalone announcements return `null` from `weekPathForPost` and render normally.

- [ ] **Step 3: Verify**

Run: `npm run dev`

- `http://localhost:3000/blog/season-xxxvi-week-3-recap` → redirects to `/week/fall-2026/3`
- `http://localhost:3000/blog/this-site-built-entirely-on-a-brunswick-2000` → redirects to `/week/spring-2026/4`
- `http://localhost:3000/blog/some-lines-shouldn-t-be-crossed` → renders normally, **no redirect** (announcement, no week)

- [ ] **Step 4: Commit**

```bash
git add "src/app/blog/[slug]/page.tsx"
git commit -m "feat(blog): redirect weekly recaps to their week page"
```

---

### Task 6: Point the blog index at week pages

The index stays exactly as it looks - photo-led chronological cards. Only the destinations change, so live links do not bounce through a redirect.

**Files:**
- Modify: `src/app/blog/page.tsx`

- [ ] **Step 1: Add the import**

```tsx
import { weekPathForPost } from '@/lib/week-writeup';
```

- [ ] **Step 2: Change the featured card href**

At `src/app/blog/page.tsx:61`, replace:

```tsx
              href={`/blog/${featured.slug}`}
```

with:

```tsx
              href={weekPathForPost(featured) ?? `/blog/${featured.slug}`}
```

- [ ] **Step 3: Change the list card href**

At `src/app/blog/page.tsx:108`, replace:

```tsx
                href={`/blog/${post.slug}`}
```

with:

```tsx
                href={weekPathForPost(post) ?? `/blog/${post.slug}`}
```

- [ ] **Step 4: Verify**

Run: `npm run dev`

- `http://localhost:3000/blog` - the featured card (week 3, berry photo) links directly to `/week/fall-2026/3`; hover and confirm the status bar shows the week URL, not `/blog/...`
- The `some-lines-shouldn-t-be-crossed` card still links to `/blog/some-lines-shouldn-t-be-crossed`

- [ ] **Step 5: Commit**

```bash
git add src/app/blog/page.tsx
git commit -m "feat(blog): index links recaps straight to their week page"
```

---

### Task 7: Send the weekly email to the week page

**Files:**
- Modify: `src/app/api/evillair/email/route.ts`

The caller is `src/app/evillair/(dashboard)/page.tsx:244`, and it posts only `{ seasonID, week }`. Rather than change the caller, derive the slug in the route: `SeasonNav` already carries both `seasonID` and `slug`.

- [ ] **Step 1: Add the import**

```ts
import { getAllSeasonNavList } from '@/lib/queries';
```

- [ ] **Step 2: Build the week URL**

At `src/app/api/evillair/email/route.ts:141`, replace:

```ts
    const blogUrl = `https://splitzkrieg.com/blog/${slug}`;
```

with:

```ts
    // Recaps live on the week page now. Fall back to the blog URL if the season
    // slug cannot be resolved; that path redirects anyway, so the link still works.
    const seasonSlug = (await getAllSeasonNavList()).find(
      (s) => s.seasonID === seasonID,
    )?.slug;
    const blogUrl = seasonSlug
      ? `https://splitzkrieg.com/week/${seasonSlug}/${week}`
      : `https://splitzkrieg.com/blog/${slug}`;
```

Leave the `slug` variable above it in place - it is still the fallback.

- [ ] **Step 3: Verify without sending**

The dashboard's email button sends immediately, so do **not** click it against the live list. Instead confirm the URL construction directly:

```bash
node -e '
const nav=[{seasonID:36,slug:"fall-2026"},{seasonID:35,slug:"spring-2026"}];
const seasonID=36, week=3, slug="season-xxxvi-week-3-recap";
const s=nav.find(x=>x.seasonID===seasonID)?.slug;
console.log(s?`https://splitzkrieg.com/week/${s}/${week}`:`https://splitzkrieg.com/blog/${slug}`);
'
```

Expected: `https://splitzkrieg.com/week/fall-2026/3`

If a real end-to-end send is wanted, POST with the `to` override set to Russ's own address, never the default `splitzkrieg-bowlers@googlegroups.com`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/evillair/email/route.ts
git commit -m "feat(email): weekly email links to the week page"
```

---

### Task 8: Remove the Around the Site section

PostHog, all time since 2026-03-08: the two permanent links drew **3 clicks each** against 176 unique people who scrolled the section into view - roughly 3%, against 13-50% for every other section on the page. Russ's call is to drop it entirely.

**Files:**
- Delete: `src/components/blog/DiscoverySection.tsx`
- Modify: `src/components/blog/WeekRecap.tsx`
- Modify: `src/app/evillair/(dashboard)/blog/[id]/page.tsx`

- [ ] **Step 1: Remove the section from WeekRecap**

In `src/components/blog/WeekRecap.tsx`, delete the import:

```tsx
import { DiscoverySection } from '@/components/blog/DiscoverySection';
```

and the whole block:

```tsx
      {/* Discover more of the site */}
      <TrackVisibility section="recap-discovery" page="blog-recap">
        <DiscoverySection ... />
      </TrackVisibility>
```

Also remove the now-unused `discoveryOverrides` and `siteUpdates` props/variables **only if nothing else in the file uses them** - check with `grep -n "siteUpdates\|discoveryOverrides" src/components/blog/WeekRecap.tsx` before deleting, and update the callers if you change the signature.

- [ ] **Step 2: Delete the component**

```bash
git rm src/components/blog/DiscoverySection.tsx
```

- [ ] **Step 3: Remove the admin UI**

In `src/app/evillair/(dashboard)/blog/[id]/page.tsx`, remove:
- the three state hooks at lines ~53-55: `discoveryLinks`, `availableUpdates`, `showUpdatePicker`
- the hydration block at lines ~82-84 that parses `p.discoveryLinks`
- the `discoveryLinks:` field in the save payload at line ~154
- the entire "Around the Site links" panel starting near line 474 and running through the update-picker block

Leave the `discoveryLinks` column in the database and in `src/lib/admin/types.ts` / `blog-db.ts`. Dropping a column is a separate, riskier change and nothing breaks by leaving it unread.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` - expect no new errors.

Run: `npm run dev` and check:
- `/week/fall-2026/3` renders with no "Around the Site" section
- `/evillair/blog/16` loads, saves, and no longer shows the Around the Site panel

- [ ] **Step 5: Commit**

```bash
git add -u
git add "src/app/evillair/(dashboard)/blog/[id]/page.tsx" src/components/blog/WeekRecap.tsx
git commit -m "feat(blog): drop the Around the Site section

PostHog, all time: the two permanent links drew 3 clicks each against 176
unique people who saw the section, about 3%, versus 13-50% for every other
section on the page. The discoveryLinks DB column is left in place, unread."
```

---

### Task 9: Full verification before pushing

- [ ] **Step 1: Run the test suite**

Run: `npm run test`

Expected: all pass, including the 10 new tests in `week-writeup.test.ts`.

- [ ] **Step 2: Run the standing pre-push check**

Run: `node scripts/pre-push-check.mjs`

Expected: all four checks OK. This covers cache invariants, em dashes, data-version mismatches and the published-week marker.

- [ ] **Step 3: Walk the whole journey in the browser**

Run: `npm run dev`

- `/blog` → click the featured card → lands on `/week/fall-2026/3` with hero, expanded writeup, and full stats
- `/blog/season-xxxvi-week-3-recap` → redirects to the same page
- `/week/spring-2026/8` → writeup present but collapsed
- `/week/spring-2026/1` → no writeup block, page renders as before
- `/blog/some-lines-shouldn-t-be-crossed` → still renders as a standalone post
- No "Around the Site" section anywhere

- [ ] **Step 4: Do not deploy during a publish window**

Per `CLAUDE.md`, do not push this while Russ is mid-publish. A publish deploy already busts ~80 bowler caches plus the current season's queries. This change touches no files in `src/lib/queries/`, so it adds no cache cascade, but it should still land on its own deploy.

---

## What BlogPostLayout wraps around the recap, and what happens to it

`src/components/blog/BlogPostLayout.tsx` renders three things outside the MDX body. None of them move to the week page, and none need code changes: once Task 5 redirects recaps, they simply stop applying to recaps while continuing to work for the standalone announcement post.

**1. The Site Updates feed** (`BlogPostLayout.tsx:189-196`, fed by `getSiteUpdates()` in `blog/[slug]/page.tsx:86`). **Do not port this to the week page.**

- It is not earning its place there. Clicks on site-update destinations *from a blog post page* total 23, against 1,223 total link clicks from blog post pages: **1.9%**. The same destinations drew 641 clicks from other pages, so roughly 96% of that engagement already happens on `/resources` and the `/blog` index.
- More importantly it is **current-state content on a historical page**. A Season XXII week page carrying "Added collapsible Score Map on bowler pages, July 2026" is anachronistic, and undermines the whole reason the week page works as an archive.
- It would also add `getSiteUpdates()` to 325 pages, all of which would invalidate whenever an update is added.

It stays on `/resources` (its canonical home) and `/blog`.

**2. Prev/next post navigation** (`BlogPostLayout.tsx:128-187`). Not a loss: the week page already has prev/next **week** navigation at lines 158-220, which is the correct equivalent for a week-scoped page.

**3. The parallax hero with back-link and title.** The week page has its own header and its own hero, added in Task 3.

## Deliberately out of scope

- **Snapshot baking.** The week page is faithful because its queries are week-scoped, not because anything is frozen. Renames still flow backward. `memory/project_blog_snapshot_baking.md` tracks real baking as the eventual end state.
- **Remembering a reader's collapse preference across weeks.** A localStorage nicety, not v1.
- **Dropping the `discoveryLinks` column.** Left in place, unread.
- **The hardcoded `imgW={4032} imgH={3024}` in `BlogPostLayout.tsx:36-37`,** which stretches any non-4:3 hero. Still a real bug, still worth fixing, but it belongs to the blog post layout and this plan does not touch that component. The week page hero added in Task 3 uses `object-cover`, so it crops correctly at any aspect ratio and is not affected.
