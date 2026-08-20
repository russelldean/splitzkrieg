# Homepage Hero and Card Destinations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the homepage hero and the recap card lead to genuinely different destinations, and let a non-recap post reach the front page on both desktop and mobile.

**Architecture:** All decision logic moves into pure, unit-tested helpers in a new `src/lib/home-cards.ts`. The homepage server component calls those helpers and passes results down as props. The week page gains an `id="results"` anchor so the hero can deep-link past the writeup to the match results.

**Tech Stack:** Next.js (App Router, React Server Components), TypeScript, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-homepage-hero-card-destinations-design.md`

---

## Deviation from the spec

The spec proposed putting `DEFAULT_POST_IMAGE` and `postImage()` in `src/lib/blog.ts`. Do not do that. `blog.ts` imports `@/lib/admin/blog-db`, which imports `mssql` and `@/lib/db` (`blog-db.ts:7-9`). A runtime import of `blog.ts` from a unit test would drag the SQL driver into the test process.

`src/lib/week-writeup.test.ts` gets away with `import type { PostMeta } from './blog'` only because type-only imports are erased at compile time.

So all pure helpers live in a new `src/lib/home-cards.ts`, which imports nothing but the `PostMeta` type. Everything else in the spec stands.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/home-cards.ts` (create) | Pure decision logic: which post the card shows, what its labels say, which image it uses. No I/O, no React. |
| `src/lib/home-cards.test.ts` (create) | Unit tests for the above. |
| `src/components/week/WeekPageBody.tsx` (modify) | Add the `#results` anchor target. |
| `src/app/page.tsx` (modify) | Compute hero href and card post from the helpers, wire the mobile gate, delete dead code. |
| `src/components/home/RecapSnapshotCard.tsx` (modify) | Type-aware labels, guaranteed image. |
| `src/components/home/PromotedBlogCard.tsx` (modify) | Guaranteed image. |
| `content/updates.ts` (modify) | User-facing changelog entry. |

---

### Task 1: Pure helpers for card selection, labels, and image

**Files:**
- Create: `src/lib/home-cards.ts`
- Test: `src/lib/home-cards.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/home-cards.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { selectCardPost, cardLabels, postImage, DEFAULT_POST_IMAGE } from './home-cards';
import type { PostMeta } from './blog';

const recap = (over: Partial<PostMeta> = {}): PostMeta => ({
  title: 'Season XXXVI - Week 3 Recap',
  date: '2026-08-18',
  slug: 'season-xxxvi-week-3-recap',
  excerpt: 'Season XXXVI Week 3 recap',
  type: 'recap',
  season: 'XXXVI',
  seasonSlug: 'fall-2026',
  week: 3,
  heroImage: '/berry-week3.jpg',
  ...over,
});

const announcement = (over: Partial<PostMeta> = {}): PostMeta => ({
  title: 'Some Lines Should Not Be Crossed',
  date: '2026-08-19',
  slug: 'some-lines-shouldn-t-be-crossed',
  excerpt: 'An announcement',
  type: 'announcement',
  heroImage: '/flatliners3.webp',
  ...over,
});

const WEEK_HREF = '/week/fall-2026/3';

describe('selectCardPost', () => {
  it('returns the promoted post when it differs from the week page', () => {
    const a = announcement();
    const r = recap();
    expect(selectCardPost({ posts: [a, r], promoted: a, weekHref: WEEK_HREF })).toBe(a);
  });

  it('falls back to the recap when the promoted post IS the week page', () => {
    const r = recap();
    expect(selectCardPost({ posts: [r], promoted: r, weekHref: WEEK_HREF })).toBe(r);
  });

  it('returns the latest recap when nothing is promoted', () => {
    const a = announcement();
    const r = recap();
    expect(selectCardPost({ posts: [a, r], promoted: null, weekHref: WEEK_HREF })).toBe(r);
  });

  it('does not let an unpromoted announcement evict the recap', () => {
    // Regression: page.tsx used allPosts[0], so the newest post of ANY type won.
    const a = announcement();
    const r = recap();
    const posts = [a, r]; // announcement is newest
    expect(selectCardPost({ posts, promoted: null, weekHref: WEEK_HREF })).toBe(r);
  });

  it('returns the newest recap when several exist', () => {
    const newer = recap({ slug: 'wk3', week: 3 });
    const older = recap({ slug: 'wk2', week: 2 });
    expect(selectCardPost({ posts: [newer, older], promoted: null, weekHref: WEEK_HREF })).toBe(newer);
  });

  it('returns null when there is no recap and nothing promoted', () => {
    expect(selectCardPost({ posts: [announcement()], promoted: null, weekHref: WEEK_HREF })).toBeNull();
  });

  it('returns the promoted post when there is no week page at all', () => {
    const a = announcement();
    expect(selectCardPost({ posts: [a], promoted: a, weekHref: null })).toBe(a);
  });
});

describe('cardLabels', () => {
  it('labels a recap with its week number', () => {
    expect(cardLabels(recap())).toEqual({ badge: 'Week 3 Recap', cta: 'Read the full recap' });
  });

  it('labels a non-recap as a new post', () => {
    expect(cardLabels(announcement())).toEqual({ badge: 'New Post', cta: 'Read the post' });
  });

  it('does not render "Week undefined" for a recap with no week', () => {
    expect(cardLabels(recap({ week: undefined })).badge).toBe('New Post');
  });
});

describe('postImage', () => {
  it('prefers cardImage', () => {
    expect(postImage(recap({ cardImage: '/turkeys.jpg' }))).toBe('/turkeys.jpg');
  });

  it('falls back to heroImage', () => {
    expect(postImage(recap({ cardImage: undefined }))).toBe('/berry-week3.jpg');
  });

  it('falls back to the default when neither is set', () => {
    expect(postImage(recap({ cardImage: undefined, heroImage: undefined }))).toBe(DEFAULT_POST_IMAGE);
  });

  it('never returns an empty string', () => {
    expect(postImage(recap({ cardImage: '', heroImage: '' }))).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/home-cards.test.ts`

Expected: FAIL, with a resolution error such as `Failed to load url ./home-cards`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/home-cards.ts`:

```ts
import type { PostMeta } from './blog';
import { postHref } from './week-writeup';

/**
 * Fallback picture for a post with no cardImage and no heroImage.
 *
 * A real house photo rather than a flat colour block: an empty panel reads as a
 * broken image, and the panel carries the card's only link, so it must always
 * render. Chosen because it is 1200x800 (crops cleanly to both the desktop panel
 * and the h-32 mobile strip), contains no text and no identifiable faces, and is
 * not either homepage hero, so it can never sit directly beneath a copy of itself.
 */
export const DEFAULT_POST_IMAGE = '/bowling-balls-return.jpg';

/** The picture for a post's card panel. Never empty. */
export function postImage(post: PostMeta): string {
  return post.cardImage || post.heroImage || DEFAULT_POST_IMAGE;
}

/**
 * Which post the homepage card should advertise.
 *
 * The hero bar always points at the week page, so the card is only worth giving
 * to a promoted post when that post is somewhere ELSE. When the promoted post is
 * this week's recap, the two would be the same link, so the card falls back to
 * recap behaviour and the anchor on the hero keeps them distinct instead.
 *
 * The fallback is the latest RECAP, not the latest post of any type. Using
 * `posts[0]` let an unpromoted announcement evict the recap card entirely.
 */
export function selectCardPost(opts: {
  posts: PostMeta[];
  promoted: PostMeta | null;
  weekHref: string | null;
}): PostMeta | null {
  const { posts, promoted, weekHref } = opts;
  if (promoted && (weekHref === null || postHref(promoted) !== weekHref)) {
    return promoted;
  }
  return posts.find((p) => p.type === 'recap' && p.week != null) ?? null;
}

/**
 * Badge and call-to-action text for the card's image panel.
 *
 * "New Post" matches the badge PromotedBlogCard already uses, so the two cards
 * agree. Guarded on `week` as well as `type` because a recap without a week
 * would otherwise render the string "Week undefined Recap".
 */
export function cardLabels(post: PostMeta): { badge: string; cta: string } {
  if (post.type === 'recap' && post.week != null) {
    return { badge: `Week ${post.week} Recap`, cta: 'Read the full recap' };
  }
  return { badge: 'New Post', cta: 'Read the post' };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/home-cards.test.ts`

Expected: PASS, 14 tests (7 for `selectCardPost`, 3 for `cardLabels`, 4 for `postImage`).

- [ ] **Step 5: Run the full suite to check nothing regressed**

Run: `npm test`

Expected: PASS, including the pre-existing `src/lib/week-writeup.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/home-cards.ts src/lib/home-cards.test.ts
git commit -m "feat(home): pure helpers for card post selection, labels, and image"
```

---

### Task 2: Anchor target on the week page

**Files:**
- Modify: `src/components/week/WeekPageBody.tsx:276-287`

There is no unit test for this task. It is a single JSX wrapper with no logic, and the week page is a server component rendered from live query data. It is covered by the manual check in Task 6.

- [ ] **Step 1: Add the anchor wrapper**

`TrackVisibility` accepts only `section`, `page`, `children`, and `className` (`src/components/tracking/TrackVisibility.tsx:7-12`), so it cannot carry the `id` itself. Wrap it.

Find this block:

```tsx
          {/* Match Results */}
          <TrackVisibility section="match-results" page="week">
            <SectionHeading>Match Results</SectionHeading>

            {/* Match cards, click to expand individual match details */}
            <WeekMatchSummary
              weekScores={weekScores}
              schedule={weekSchedule}
              matchResults={weekMatchResults}
              week={weekNum}
            />
          </TrackVisibility>
```

Replace it with:

```tsx
          {/* Match Results. The id is the homepage hero's deep-link target: the
              writeup sits above this block, so an unanchored link would land the
              reader on the prose under a heading that says "Results". */}
          <div id="results" className="scroll-mt-20">
            <TrackVisibility section="match-results" page="week">
              <SectionHeading>Match Results</SectionHeading>

              {/* Match cards, click to expand individual match details */}
              <WeekMatchSummary
                weekScores={weekScores}
                schedule={weekSchedule}
                matchResults={weekMatchResults}
                week={weekNum}
              />
            </TrackVisibility>
          </div>
```

`scroll-mt-20` clears the sticky header at `src/app/layout.tsx:58`. This matches the existing convention in `PlayoffH2H.tsx:67`, `TeamTimeline.tsx:86`, `SiteUpdates.tsx:33`, and `SeasonAccordion.tsx:51`.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/week/WeekPageBody.tsx
git commit -m "feat(week): add #results anchor for homepage deep-link"
```

---

### Task 3: RecapSnapshotCard uses the helpers

**Files:**
- Modify: `src/components/home/RecapSnapshotCard.tsx:1-45`

- [ ] **Step 1: Update the imports**

Find:

```tsx
import { postHref } from '@/lib/week-writeup';
```

Replace with:

```tsx
import { postHref } from '@/lib/week-writeup';
import { cardLabels, postImage } from '@/lib/home-cards';
```

- [ ] **Step 2: Replace the image variable**

Find:

```tsx
export function RecapSnapshotCard({ post, snapshot, preseason = false }: Props) {
  const image = post.cardImage || post.heroImage;
```

Replace with:

```tsx
export function RecapSnapshotCard({ post, snapshot, preseason = false }: Props) {
  const image = postImage(post);
  const labels = cardLabels(post);
```

- [ ] **Step 3: Drop the image guard and use the labels**

Find this block (starting at the `{image && (` line):

```tsx
        {/* Left: recap image + link */}
        {image && (
          <Link
            href={postHref(post)}
            className="relative block md:flex-1 h-40 md:h-auto md:min-h-[180px] overflow-hidden group"
          >
```

Replace with:

```tsx
        {/* Left: post image + link. Not gated on an image existing: postImage()
            always resolves, and this panel carries the card's only link. */}
        <Link
          href={postHref(post)}
          className="relative block md:flex-1 h-40 md:h-auto md:min-h-[180px] overflow-hidden group"
        >
```

Then find the badge and call-to-action:

```tsx
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-body uppercase tracking-wider bg-red-600 text-white mb-1">
                Week {post.week} Recap
              </span>
              <div className="font-heading text-sm text-white group-hover:text-red-300 transition-colors">
                Read the full recap &rarr;
              </div>
            </div>
          </Link>
        )}
```

Replace with:

```tsx
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-body uppercase tracking-wider bg-red-600 text-white mb-1">
                {labels.badge}
              </span>
              <div className="font-heading text-sm text-white group-hover:text-red-300 transition-colors">
                {labels.cta} &rarr;
              </div>
            </div>
          </Link>
```

Note the removed `)}` on the last line: the `{image && (` wrapper is gone, so its closing parenthesis and brace must go too.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: no errors. If you see "')' expected" you left a stray `)}` from the removed guard.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/RecapSnapshotCard.tsx
git commit -m "feat(home): type-aware labels and guaranteed image on recap card"
```

---

### Task 4: PromotedBlogCard uses the image helper

**Files:**
- Modify: `src/components/home/PromotedBlogCard.tsx:1-60`

This component has two image guards, one in the mobile block and one in the desktop block. Both must go.

- [ ] **Step 1: Update the imports and the image variable**

Find:

```tsx
import { postHref } from '@/lib/week-writeup';

interface Props {
  post: PostMeta;
}

export function PromotedBlogCard({ post }: Props) {
  const image = post.cardImage || post.heroImage;
```

Replace with:

```tsx
import { postHref } from '@/lib/week-writeup';
import { postImage } from '@/lib/home-cards';

interface Props {
  post: PostMeta;
}

export function PromotedBlogCard({ post }: Props) {
  const image = postImage(post);
```

- [ ] **Step 2: Remove the mobile image guard**

Find:

```tsx
      <div className="relative sm:hidden">
        {image && (
          <div className="relative w-full h-32 overflow-hidden">
```

Replace with:

```tsx
      <div className="relative sm:hidden">
        <div className="relative w-full h-32 overflow-hidden">
```

Then find the end of that same mobile block:

```tsx
            </div>
          </div>
        )}
      </div>
```

Replace with:

```tsx
            </div>
        </div>
      </div>
```

- [ ] **Step 3: Remove the desktop image guard**

Find:

```tsx
      <div className="hidden sm:flex flex-row bg-white h-full">
        {image && (
          <div className="relative w-48 flex-shrink-0 overflow-hidden">
            <Image
              src={image}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="192px"
            />
          </div>
        )}
```

Replace with:

```tsx
      <div className="hidden sm:flex flex-row bg-white h-full">
        <div className="relative w-48 flex-shrink-0 overflow-hidden">
          <Image
            src={image}
            alt={post.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="192px"
          />
        </div>
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/PromotedBlogCard.tsx
git commit -m "feat(home): guaranteed image on promoted blog card"
```

---

### Task 5: Wire the homepage

**Files:**
- Modify: `src/app/page.tsx:19` (import), `:53-55`, `:188`, `:227-233`, `:330-358`

- [ ] **Step 1: Drop the now-unused import**

`getPostBySlug` internally calls `getAllPosts()` (`src/lib/blog.ts:57-62`), which this page already awaits into `allPosts`. Looking the promoted post up in `allPosts` removes a redundant round trip.

Find:

```tsx
import { getPostBySlug, getAllPosts } from '@/lib/blog';
```

Replace with:

```tsx
import { getAllPosts } from '@/lib/blog';
import { selectCardPost } from '@/lib/home-cards';
```

- [ ] **Step 2: Replace the post selection block**

Find:

```tsx
  // Latest blog post for desktop sidebar; promoted post if badge active
  const latestPost = allPosts[0] ?? null;
  const promotedSlug = blogBadgeId?.split('|')[0] ?? null;
  const promotedPost = promotedSlug ? await getPostBySlug(promotedSlug) : undefined;
```

Replace with:

```tsx
  // The post the NEW badge points at, if the badge is live. getNewBlogBadgeId
  // returns "slug|timestamp" and already applies the 14 day expiry.
  const promotedSlug = blogBadgeId?.split('|')[0] ?? null;
  const promotedPost = promotedSlug
    ? allPosts.find((p) => p.slug === promotedSlug) ?? null
    : null;
```

- [ ] **Step 3: Delete the dead code**

Find and delete this line entirely:

```tsx
  const showPromotedPost = promotedPost && promotedPost.type !== 'recap';
```

It has never been referenced anywhere in the file.

- [ ] **Step 4: Compute the week href, hero href, and card post**

Immediately after the deleted line (just before `return (`), insert:

```tsx
  // The hero always points at the results. The card points at the promoted post
  // when that is somewhere other than this same week page. See
  // docs/superpowers/specs/2026-08-19-homepage-hero-card-destinations-design.md
  const weekHref = seasonSnapshot
    ? `/week/${seasonSnapshot.slug}/${seasonSnapshot.weekNumber}`
    : null;
  const cardPost = selectCardPost({ posts: allPosts, promoted: promotedPost, weekHref });
  // Mobile only surfaces the card when it is NOT the weekly recap: the mobile
  // hero bar already links to the week page, so a recap card there is a third
  // door to the same room. A non-recap post has no other entry point.
  const mobilePromoted = cardPost && cardPost.type !== 'recap' ? cardPost : null;
```

- [ ] **Step 5: Anchor the hero link**

Find, inside the hero block:

```tsx
              : !seasonStarted
                ? `/schedule.html`
                : `/week/${seasonSnapshot.slug}/${seasonSnapshot.weekNumber}`;
```

Replace with:

```tsx
              : !seasonStarted
                ? `/schedule.html`
                : `/week/${seasonSnapshot.slug}/${seasonSnapshot.weekNumber}#results`;
```

Only this branch changes. The championship, playoffs, and preseason branches above it are untouched.

- [ ] **Step 6: Restructure the card block**

Find the whole block that begins with `{/* === Blog + Snapshot === */}` and ends with the closing `)}` before `{/* === FULL WIDTH: Instagram strip (visual break) === */}`.

Replace it with:

```tsx
        {/* === Blog + Snapshot === */}
        {cardPost && seasonSnapshot ? (
          <>
            {/* Desktop: combined post + snapshot card */}
            <div className="hidden md:block">
              <TrackVisibility section="recap-snapshot" page="home">
                <RecapSnapshotCard post={cardPost} snapshot={seasonSnapshot} preseason={!seasonStarted} />
              </TrackVisibility>
            </div>
            {/* Mobile: snapshot, plus the promoted post when it is not the recap */}
            <div className="md:hidden space-y-5">
              {mobilePromoted && (
                <TrackVisibility section="promoted-blog" page="home">
                  <PromotedBlogCard post={mobilePromoted} />
                </TrackVisibility>
              )}
              <TrackVisibility section="season-snapshot" page="home">
                <SeasonSnapshot snapshot={seasonSnapshot} />
              </TrackVisibility>
            </div>
          </>
        ) : (
          <TrackVisibility section="season-snapshot" page="home">
            <SeasonSnapshot snapshot={seasonSnapshot} />
          </TrackVisibility>
        )}
```

- [ ] **Step 7: Check for now-unused imports**

Run: `npm run lint`

Expected: no errors. `PromotedBlogCard` is still used (mobile branch). If lint reports `SeasonSnapshot` or any other import as unused, you removed a usage you should not have. Re-read Step 6.

- [ ] **Step 8: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 9: Run the full suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(home): split hero and card destinations, surface promoted posts on mobile"
```

---

### Task 6: Manual verification

**Files:** none modified.

Do not skip this. Tasks 2 through 5 have no automated coverage of rendered output.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev:fresh`

`dev:fresh` rather than `dev` because it clears `.next/cache/sql`, so the homepage reads current data instead of a stale cached snapshot.

- [ ] **Step 2: Check the hero deep-link**

Open `http://localhost:3000`. Click the hero bar labelled "Week 3 Results".

Expected: lands on `/week/fall-2026/3#results`, scrolled to the "Match Results" heading, with that heading fully visible below the sticky header and not tucked behind it.

- [ ] **Step 3: Check the card link**

Go back. Click the recap card image panel.

Expected: lands at the top of `/week/fall-2026/3`, showing the hero photo and the writeup. Badge reads "Week 3 Recap", call to action reads "Read the full recap".

- [ ] **Step 4: Check mobile in the normal week**

Open dev tools, set the viewport to 375px wide, and reload the homepage.

Expected: identical to before this change. Season snapshot only, no promoted card, because `cardPost.type === 'recap'` so `mobilePromoted` is null.

- [ ] **Step 5: Check the promoted non-recap path**

Temporarily point the badge at the announcement. In `/evillair`, promote the post `some-lines-shouldn-t-be-crossed`, or set it directly:

```sql
UPDATE leagueSettings
SET settingValue = 'some-lines-shouldn-t-be-crossed|' + CAST(CAST(DATEDIFF(s, '1970-01-01', GETUTCDATE()) AS BIGINT) * 1000 AS VARCHAR(20))
WHERE settingKey = 'newBlogPost';
```

Restart with `npm run dev:fresh` and reload.

Expected on desktop: the card image panel now shows the announcement, badge reads "New Post", call to action reads "Read the post", and it links to `/blog/some-lines-shouldn-t-be-crossed`. The hero still links to `/week/fall-2026/3#results`. The right half still reads "Week 3 Highlights".

Expected at 375px: `PromotedBlogCard` now appears above the season snapshot.

- [ ] **Step 6: Restore the badge**

This is required. Leaving the badge pointed at the announcement would ship that state.

```sql
UPDATE leagueSettings
SET settingValue = 'season-xxxvi-week-3-recap|1787088605808'
WHERE settingKey = 'newBlogPost';
```

Reload and confirm the homepage is back to the recap card and the mobile view is snapshot-only.

- [ ] **Step 7: Check the imageless fallback**

The week 3 recap has `heroImage: /berry-week3.jpg`, so the fallback does not trigger naturally. Force it once: in `src/lib/home-cards.ts`, temporarily change `postImage` to `return DEFAULT_POST_IMAGE;`, reload the homepage, confirm the card renders `bowling-balls-return.jpg` with the badge and call to action legible over it, then revert the change.

Confirm with `git diff src/lib/home-cards.ts` that the file is clean before continuing.

---

### Task 7: Changelog and final checks

**Files:**
- Modify: `content/updates.ts`

- [ ] **Step 1: Add the entries**

Entries are one-line objects matching the `Update` interface at the top of the file. Insert both of these as the first two entries in the `updates` array, immediately after `const updates: Update[] = [`:

```ts
  { date: '2026-08-19', text: 'Week results bar now jumps straight to match results, while the recap card opens the writeup', tag: 'feat' },
  { date: '2026-08-19', text: 'Non-recap blog posts now appear on the homepage on phones, not just desktop', tag: 'fix' },
```

Leave the `lastUpdated` constant alone. It is a marker for finding new git entries, not a display value, and the existing entries have drifted from it already. Ask Russ before changing it.

Do not use em dashes. `scripts/pre-push-check.mjs:54-61` fails the push on either the U+2014 character or the `&mdash;` entity anywhere in `src/` or `content/`. Use a comma or a full stop instead.

- [ ] **Step 2: Run the pre-push check**

Run: `node scripts/pre-push-check.mjs`

Expected: PASS. This covers cache invariants, the em dash rule, `.data-versions.json` staging, and the published-week marker.

- [ ] **Step 3: Run the cache invariant check**

Run: `node scripts/check-cache-invariants.mjs`

Expected: PASS. No query text changed in this work, so no `cachedQuery` hash moves and nothing busts. If this reports bust counts above zero, something in `src/lib/queries/` was edited by mistake.

- [ ] **Step 4: Run the full suite one more time**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add content/updates.ts
git commit -m "docs(updates): note the homepage link split"
```

- [ ] **Step 6: Report, do not push**

Do not push. Report to Russ what landed, what the manual checks showed, and let him choose the deploy window.

---

## Notes carried from the spec

- **No cache impact.** No SQL text changes, so no `cachedQuery` hashes move and no channels bust. Week pages re-render against a warm disk cache with no Azure SQL load.
- **Publish-week discipline.** Russ confirmed on 2026-08-19 that this is outside a publish window. If that changes before this lands, hold it.
- **Out of scope, worth its own ticket.** `getNewBlogBadgeId()` compares against `Date.now()` inside a build-time query (`src/lib/queries/home.ts:22`), so the badge's 14 day expiry is evaluated at build time and a badge can outlive its TTL on a static page until the next deploy. Pre-existing. Not addressed here.
