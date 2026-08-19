# Draft preview shows the real week page

Date: 2026-08-19
Status: approved, not yet implemented

## Problem

Previewing an unpublished recap shows a layout no reader will ever see.

The editor's Preview button opens `/api/evillair/draft?slug=x`, which sets the
draft cookie and redirects to `/blog/x`. That page deliberately skips its
week-page redirect while in draft mode:

```ts
// src/app/blog/[slug]/page.tsx
if (weekPath && !isDraft) redirect(weekPath);
```

so it renders `BlogPostLayout` plus the post's MDX. All 9 recap posts embed
`<WeekRecap />`, which renders `CompactLeaderboardPreview`. Published readers,
by contrast, get redirected to `/week/<seasonSlug>/<n>`, where `WeekWriteup`
stubs `WeekRecap` to `() => null` and the page renders `LeaderboardSnapshot`
instead.

Two components, two layouts, and the one being approved is not the one that
ships. Since the leaderboard eligibility fix (`da31a02`) the numbers differ too:
the week page ramps its minimum games with `getMinGamesForWeek`, while
`CompactLeaderboardPreview` still uses a flat 3-night floor, so at weeks 1 and 2
the preview's boards are empty while the published page is populated.

## Constraint that drives the design

`draftMode()` is a dynamic API. Reading it inside the public week page risks
opting all ~325 week pages into per-request rendering, which would break the
prebuilt serving model ("visitors never hit the DB") and point Azure SQL at
live traffic. The design therefore keeps `draftMode()` out of the public route
entirely rather than relying on Next.js keeping the route static.

## Design

### 1. Extract the week page body

New `src/components/week/WeekPage.tsx` holding everything the current route
component renders, including its own data fetching. Signature:

```ts
export async function WeekPage({
  seasonSlug,
  weekNum,
  draftPost,
}: {
  seasonSlug: string;
  weekNum: number;
  draftPost?: { meta: BlogPost; content: string };
}): Promise<JSX.Element>
```

`draftPost` is the only new behavior: when present it replaces the
`getPostForWeek` / `getPostContentForWeek` lookups. Everything else is
unchanged.

`src/app/week/[seasonSlug]/[weekNum]/page.tsx` keeps `dynamicParams`,
`generateStaticParams`, and `generateMetadata`, and its component body becomes a
call to `<WeekPage seasonSlug weekNum />` with no `draftPost`. It never reads
`draftMode()`, so it stays static.

### 2. Admin preview route

New `src/app/evillair/preview/week/[seasonSlug]/[weekNum]/page.tsx` with
`export const dynamic = 'force-dynamic'`.

It sits OUTSIDE the `(dashboard)` route group on purpose. That group's layout
wraps every child in `<AdminShell>`, the admin nav chrome, and a preview wearing
admin chrome is not a preview of what readers see. Route groups do not affect
URLs, so the path is `/evillair/preview/week/...` either way; the only thing
being avoided is the layout.

The cost of leaving the group is losing its auth. So the token check moves into
a shared `requireAdminOrWriterPage()` in `src/lib/admin/auth.ts`, used by both
`(dashboard)/layout.tsx` and this route. It reads the `admin-token` cookie,
verifies it, and redirects to `/evillair/login` for a missing or non-admin
token, exactly as the layout does today.

It loads the post with `getBlogPostBySlug` (no `isPublished` filter) and renders
`<WeekPage seasonSlug weekNum draftPost={...} />`.

The route takes the post slug as a `?slug=` search param so it can preview a
draft whose week already has a published post. Without it the route could only
find the published post for that week, which is the thing being replaced.

### 3. Repoint the draft endpoint

`src/app/api/evillair/draft/route.ts` currently always redirects to
`/blog/<slug>`. It gains a lookup: if the post has both `seasonSlug` and `week`,
redirect to
`/evillair/preview/week/<seasonSlug>/<week>?slug=<slug>` instead. Announcements
keep going to `/blog/<slug>` unchanged.

`/blog/[slug]` keeps its draft branch as a fallback for a hand-typed URL, but
the redirect guard changes so a week-scoped post in draft mode redirects to the
preview route rather than rendering the old layout.

### 4. Delete the dead layout

Once nothing renders it:

- delete `src/components/blog/WeekRecap.tsx`
- delete `src/components/blog/CompactLeaderboardPreview.tsx`

`CompactStandingsPreview` is NOT deleted; the week page renders it directly.

### The MDX trap

All 9 recap posts have `<WeekRecap ... />` stored in their content, and MDX
throws on an unregistered component. Removing `WeekRecap` from
`src/lib/mdx-components.tsx` would break every recap page.

So the map keeps the name registered permanently as a no-op:

```ts
WeekRecap: () => null,
```

and `WeekWriteup`'s local override is removed as redundant. Only the
implementation files are deleted, never the registration.

## Testing

- `getNextStop`-style pure logic: the draft-endpoint destination choice is
  extracted as a pure function (post -> preview path or blog path) and unit
  tested, covering week-scoped posts, announcements, and posts missing a
  seasonSlug or week.
- Existing `week-writeup.test.ts` covers `weekPathForPost`, which the redirect
  guard reuses.
- Manual: preview an unpublished draft and confirm it renders the week page with
  `LeaderboardSnapshot`; confirm an announcement still previews on `/blog`.
- Confirm the public week page is still statically prebuilt (no `draftMode()`
  import anywhere in its module graph).

## Out of scope

- `getMinGamesForWeek` for `CompactLeaderboardPreview`: moot once deleted.
- Teaching the week page to render arbitrary post content on non-recap posts.
- The `heroImage` 4:3 distortion in `BlogPostLayout`.
