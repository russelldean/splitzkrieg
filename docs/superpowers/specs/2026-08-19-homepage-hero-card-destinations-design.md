# Homepage Hero and Card Destinations

**Date:** 2026-08-19
**Status:** Approved for planning

## Problem

The homepage has two prominent calls to action that resolve to the same URL.

- The hero bar (`src/app/page.tsx:227-233`) links to `/week/{season}/{week}` under the label "Week N Results".
- The recap card's image panel (`src/components/home/RecapSnapshotCard.tsx:24`) links to `postHref(post)`, which for a week-scoped post is `weekPathForPost()`, the identical `/week/{season}/{week}`, under the label "Read the full recap".

Verified against live data on 2026-08-19: current season is S36 (XXXVI, Fall 2026, 9 weeks), the latest scored week is 3, and the latest published post is the week 3 recap (postID 16). Both links resolve to `/week/fall-2026/3`.

The labels promise two different destinations and deliver one. Compounding this, the week page renders in the order header, hero photo, writeup, awards, match results (`WeekPageBody.tsx:233-276`), so the link labelled "Results" actually lands the reader on the writeup.

### Three defects found while scoping

1. **A non-recap post evicts the recap card.** `latestPost = allPosts[0]` (`page.tsx:53`) takes the newest post of any type. Publishing an announcement flips the `latestPost?.type === 'recap'` test at `page.tsx:330` to false, replacing the entire `RecapSnapshotCard` with `PromotedBlogCard`. The recap disappears from the homepage.

2. **Non-recap posts are invisible on mobile.** `PromotedBlogCard` is rendered inside `<div className="hidden md:block h-full">` (`page.tsx:348`). The component ships its own mobile layout (the `sm:hidden` block), so the wrapper is suppressing a design that already exists.

3. **Dead code.** `promotedPost` (`page.tsx:55`) and `showPromotedPost` (`page.tsx:188`) are computed and never referenced. `showPromotedPost` reads `promotedPost && promotedPost.type !== 'recap'`, which is the feature this spec completes. The unused `getPostBySlug` call costs one query per homepage build.

## Goals

- The hero and the card lead to genuinely different places.
- A non-recap post reaches the front page on desktop and on mobile.
- The desktop layout is visually unchanged in the common case. This is an information-architecture fix, not a redesign.

## Non-goals

- Redesigning the homepage or any card.
- Changing `postHref()`. It is shared with `PromotedBlogCard` and changing the helper would move both consumers.
- Touching the playoff, championship, or preseason hero branches.

## Design

### Rule

```js
const weekHref = `/week/${snapshot.slug}/${snapshot.weekNumber}`;

// Hero: always the results, in every regular-season case
const heroHref = weekHref + '#results';

// Card: the promoted post when it is genuinely something else
const promoted = promotedPost && postHref(promotedPost) !== weekHref
  ? promotedPost
  : null;

// Fallback is the latest RECAP, not the latest post of any type
const latestRecap = allPosts.find(p => p.type === 'recap') ?? null;
const cardPost = promoted ?? latestRecap;
```

"Promoted" means the post named by `leagueSettings.newBlogPost`, read through the existing `getNewBlogBadgeId()` (`src/lib/queries/home.ts:10-28`). The setting stores `"slug|timestamp"` and auto-expires after 14 days. Current value: `season-xxxvi-week-3-recap|1787088605808`.

The fallback deliberately changes from `allPosts[0]` to the newest recap. Without that change, defect 1 survives: an unpromoted announcement would still become `allPosts[0]` and evict the card.

### Resulting behavior

| Situation | Hero links to | Desktop card links to | Mobile |
| --- | --- | --- | --- |
| Normal week (today) | `/week/fall-2026/3#results` | `/week/fall-2026/3` (writeup) | `SeasonSnapshot` only, as today |
| Non-recap post promoted | `/week/fall-2026/3#results` | `/blog/{slug}` | `SeasonSnapshot` plus `PromotedBlogCard` |
| Recap promoted (explicitly) | `/week/fall-2026/3#results` | `/week/fall-2026/3` (writeup) | `SeasonSnapshot` only |

The recap stays reachable in every row: even when the card advertises an announcement, the hero lands on the week page whose first content block is the writeup.

### Why the card can be repurposed safely

`RecapSnapshotCard` is two halves. The right half ("Week N Highlights") is driven by the `snapshot` prop, not by `post`. Only the left image panel is post-driven. Swapping `cardPost` therefore changes the picture, the badge, and the link, and nothing else. The layout survives all three rows above.

### Mobile rule

Per the decision on 2026-08-19: mobile shows the promoted card **only when a non-recap promoted post exists**. In the normal week the mobile hero bar already links to the week page, so a recap card there would be a third door to the same room. An announcement has no other entry point on the homepage, so it needs one.

Implementation is to render `PromotedBlogCard` outside the `hidden md:block` wrapper, gated on `promoted !== null`.

## Components to change

| File | Change |
| --- | --- |
| `src/components/week/WeekPageBody.tsx` | Wrap the Match Results `TrackVisibility` (line 276) in `<div id="results" className="scroll-mt-20">`. `TrackVisibility` accepts only `section`, `page`, `className`, so it cannot carry the `id` itself. |
| `src/app/page.tsx` | Append `#results` to the regular-season branch of the hero ternary (line 233). Replace `latestPost` with `latestRecap` and `cardPost` per the rule. Wire `promoted`. Delete `showPromotedPost` (line 188). Restructure the mobile branch of the block at lines 330-358. |
| `src/components/home/RecapSnapshotCard.tsx` | Make the badge label and CTA type-aware. Call `postImage()` and drop the `{image && ...}` guard at line 22. |
| `src/components/home/PromotedBlogCard.tsx` | Call `postImage()` and drop both `{image && ...}` guards (lines 20 and 51) so neither the mobile nor desktop block can render empty. |
| `src/lib/blog.ts` | Add `DEFAULT_POST_IMAGE` and the `postImage()` helper. |

### Anchor convention

`id` plus `scroll-mt-20` to clear the sticky header at `layout.tsx:58`. This matches existing usage in `PlayoffH2H.tsx:67`, `TeamTimeline.tsx:86`, `SiteUpdates.tsx:33`, and `SeasonAccordion.tsx:51`.

### Label rules

`RecapSnapshotCard.tsx:39-41` currently hardcodes `Week {post.week} Recap` and "Read the full recap". A promoted announcement has no `week`, so today that would render "Week undefined Recap".

| `post.type` | Badge | CTA |
| --- | --- | --- |
| `recap` | `Week {post.week} Recap` | `Read the full recap` |
| anything else | `New Post` | `Read the post` |

"New Post" is reused deliberately: it is the wording `PromotedBlogCard` already uses for its badge, so the two cards stay consistent.

### Imageless fallback

Both cards gate their image panel on `post.cardImage || post.heroImage` (`RecapSnapshotCard.tsx:22`, `PromotedBlogCard.tsx:11`). When neither is set the panel, and with it the only link, disappears silently.

Today the week 3 recap has `heroImage: /berry-week3.jpg` and `cardImage: null`, so the fallback resolves and nothing is broken. But posts with neither image exist in the table, so this is reachable.

Resolution: render the panel regardless, falling back to an existing house photo rather than a flat colour block. A real photo keeps the card looking like the rest of the site instead of looking broken.

Define the fallback once so the choice of picture is a one-line change:

```ts
// src/lib/blog.ts (or alongside postHref in week-writeup.ts)
export const DEFAULT_POST_IMAGE = '/bowling-balls-return.jpg';

export function postImage(post: PostMeta): string {
  return post.cardImage || post.heroImage || DEFAULT_POST_IMAGE;
}
```

Both cards then call `postImage(post)` and drop their `{image && ...}` guards, since the expression can no longer be empty.

`bowling-balls-return.jpg` is chosen because it is 1200x800, so it crops cleanly to both the desktop panel (roughly 45% width, `min-h-[180px]`) and the mobile strip (`h-32`, full width); it is sharp, colourful, and unmistakably bowling; and it contains no text and no identifiable faces, so it never reads as being about a specific person or night.

It is already the parallax hero on `/seasons`, which is acceptable: a fallback is a repeat by definition, and it does not collide with either homepage hero image (`village-lanes-chairs.jpg` on desktop, `village-lanes-lanes.jpg` on mobile), so it will never sit directly beneath a copy of itself.

Alternatives considered and rejected: `village-lanes-action.jpg` is square and low quality, and crops badly to a wide strip. A navy gradient block, the original proposal, was rejected because it reads as a missing image rather than a deliberate one.

No new asset is added to `public/`.

## Error handling and edge cases

- **`seasonSnapshot` is null** (no current season). The hero block is already gated on `seasonSnapshot` at line 229 and does not render, so no `#results` link is produced. The card branch must tolerate a null snapshot, which it does today via the else branch.
- **No recap exists yet** (preseason, or a fresh season with no posts). `latestRecap` is null and `promoted` is null, so `cardPost` is null and the card is skipped. The `preseason` prop on `RecapSnapshotCard` continues to handle the "Coming Soon" state.
- **Promoted slug does not resolve** to a real post. `getPostBySlug` returns undefined, `promoted` is null, and the card falls back to the recap.
- **Badge expiry is baked at build time.** `getNewBlogBadgeId()` compares against `Date.now()` inside a build-time query, so the 14 day expiry is evaluated when the site builds, not when it is read. This is pre-existing behavior and is not changed here, but it means a badge can outlive its TTL on a static page until the next deploy.
- **Divergent week numbers.** The hero derives from scores and the card from published posts, so they can point at different weeks if a recap is published before its scores are imported. That is correct behavior and the design preserves it.

## Testing

`src/lib/week-writeup.test.ts` already covers `postHref` and `weekPathForPost`. Extend with:

- `cardPost` selection: promoted-and-different returns the promoted post; promoted-and-same returns the recap; nothing promoted returns the latest recap; an unpromoted announcement that is `allPosts[0]` still returns the recap (defect 1 regression).
- Label selection: a recap yields the week badge, a non-recap yields "New Post".
- `postImage()`: prefers `cardImage`, falls back to `heroImage`, then to `DEFAULT_POST_IMAGE`, and never returns an empty string.

Manual checks on `npm run dev`:

- Hero click lands on Match Results, not the top of the page, with the heading clear of the sticky header.
- Card click lands on the writeup.
- Mobile at 375px in the normal week is unchanged from today.
- Promote a non-recap post, confirm it appears on both desktop and mobile.

## Deploy notes

- **No cache impact.** No SQL text changes, so no `cachedQuery` hashes move and no channels bust. Week pages re-render against a warm disk cache with no Azure SQL load.
- Russ confirmed on 2026-08-19 that this is outside a publish window, so publish-week discipline does not block it.
- This is a visible change. `content/updates.ts` should be updated as part of the work.

## Open questions

None. Decisions on mobile behavior, label text, and the imageless fallback are settled above.
