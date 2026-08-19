# Week Page Draft Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the blog editor's Preview button show the real week page, so a draft recap is proofed in the layout readers actually get.

**Architecture:** Extract the week page's body into a `<WeekPageBody>` component that takes an optional `draftPost` override. The public route keeps rendering it with published data and stays fully static. A new admin-only, force-dynamic preview route renders the same component with the unpublished post injected. The draft API endpoint sends week-scoped posts there instead of `/blog/<slug>`. Once nothing renders them, `WeekRecap` and `CompactLeaderboardPreview` are deleted.

**Tech Stack:** Next.js 16 App Router (RSC), TypeScript, vitest, Azure SQL via `mssql`.

**Spec:** `docs/superpowers/specs/2026-08-19-week-page-draft-preview-design.md`

**Critical constraint:** The public week route must NEVER read `draftMode()`. It is a dynamic API, and reading it risks opting all ~325 week pages into per-request rendering, which breaks the prebuilt serving model ("visitors never hit the DB") and points Azure SQL at live traffic.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/week-writeup.ts` (modify) | Gains `draftDestinationForPost`: pure routing decision for where a draft preview should land |
| `src/lib/week-writeup.test.ts` (modify) | Tests for the above |
| `src/lib/blog.ts` (modify) | Gains `getDraftPostBySlug`: the unpublished-post fetch, moved out of the blog route so two routes can share it |
| `src/components/week/WeekPageBody.tsx` (create) | Everything the week page renders, plus optional `draftPost` override |
| `src/app/week/[seasonSlug]/[weekNum]/page.tsx` (modify) | Thin wrapper: keeps `generateStaticParams` / `generateMetadata`, renders `<WeekPageBody>` |
| `src/lib/admin/auth.ts` (modify) | Gains `requireAdminOrWriterPage()` so a page outside the dashboard group can still be gated |
| `src/app/evillair/(dashboard)/layout.tsx` (modify) | Uses the shared page guard instead of its own inline copy |
| `src/app/evillair/preview/week/[seasonSlug]/[weekNum]/page.tsx` (create) | Admin preview route, `force-dynamic`, injects the draft post. Outside the `(dashboard)` group so it does NOT get admin chrome |
| `src/app/api/evillair/draft/route.ts` (modify) | Redirects week-scoped drafts to the preview route |
| `src/app/blog/[slug]/page.tsx` (modify) | Uses shared `getDraftPostBySlug`; redirects week-scoped drafts to the preview route |
| `src/lib/mdx-components.tsx` (modify) | `WeekRecap` becomes a permanent no-op registration |
| `src/components/week/WeekWriteup.tsx` (modify) | Drops its now-redundant local `WeekRecap` override |
| `src/components/blog/WeekRecap.tsx` (delete) | Dead once the preview renders the week page |
| `src/components/blog/CompactLeaderboardPreview.tsx` (delete) | Only ever rendered by `WeekRecap` |

**Do NOT delete `src/components/blog/CompactStandingsPreview.tsx`.** The week page renders it directly at `page.tsx:338`.

---

## Task 1: Pure routing decision for draft previews

**Files:**
- Modify: `src/lib/week-writeup.ts`
- Test: `src/lib/week-writeup.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/week-writeup.test.ts`:

```typescript
describe('draftDestinationForPost', () => {
  const recap: PostMeta = {
    title: 'Season XXXVI - Week 3 Recap',
    date: '2026-08-17',
    slug: 'season-xxxvi-week-3-recap',
    excerpt: '',
    type: 'recap',
    seasonSlug: 'fall-2026',
    week: 3,
  };

  it('sends a week-scoped draft to the admin preview route', () => {
    expect(draftDestinationForPost(recap)).toBe(
      '/evillair/preview/week/fall-2026/3?slug=season-xxxvi-week-3-recap'
    );
  });

  it('encodes a slug that needs escaping', () => {
    expect(draftDestinationForPost({ ...recap, slug: 'week 3 & 4' })).toBe(
      '/evillair/preview/week/fall-2026/3?slug=week%203%20%26%204'
    );
  });

  it('sends an announcement to its own blog page', () => {
    const announcement: PostMeta = {
      title: "Some lines shouldn't be crossed.",
      date: '2026-05-01',
      slug: 'some-lines',
      excerpt: '',
      type: 'announcement',
    };
    expect(draftDestinationForPost(announcement)).toBe('/blog/some-lines');
  });

  it('falls back to the blog page when the week is missing', () => {
    expect(draftDestinationForPost({ ...recap, week: undefined })).toBe(
      '/blog/season-xxxvi-week-3-recap'
    );
  });

  it('falls back to the blog page when the season slug is missing', () => {
    expect(draftDestinationForPost({ ...recap, seasonSlug: undefined })).toBe(
      '/blog/season-xxxvi-week-3-recap'
    );
  });
});
```

Add `draftDestinationForPost` to the existing import at the top of the file, and add `PostMeta` as a type import:

```typescript
import { shouldExpandWriteup, weekPathForPost, postHref, excerptWorthShowing, draftDestinationForPost } from './week-writeup';
import type { PostMeta } from './blog';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/week-writeup.test.ts`
Expected: FAIL, `draftDestinationForPost is not a function` (or an import error naming it).

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/week-writeup.ts`:

```typescript
/**
 * Where the editor's Preview button should land for a given post.
 *
 * Week-scoped posts preview on the week page, because that is what readers get
 * once the post is published. Announcements have no week page, so they keep
 * previewing on their own blog URL.
 *
 * The slug rides along as a query param: the preview route is keyed on season
 * and week, and looking up "the post for this week" would find the PUBLISHED
 * one, which is exactly the thing a draft is replacing.
 */
export function draftDestinationForPost(post: PostMeta): string {
  const weekPath = weekPathForPost(post);
  if (!weekPath) return `/blog/${post.slug}`;
  return `/evillair/preview${weekPath}?slug=${encodeURIComponent(post.slug)}`;
}
```

Note `weekPathForPost` already returns `/week/<seasonSlug>/<week>` or null, so prefixing with `/evillair/preview` yields `/evillair/preview/week/<seasonSlug>/<week>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/week-writeup.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/week-writeup.ts src/lib/week-writeup.test.ts
git commit -m "feat(blog): pure routing decision for where a draft previews"
```

---

## Task 2: Share the unpublished-post fetch

**Files:**
- Modify: `src/lib/blog.ts`
- Modify: `src/app/blog/[slug]/page.tsx:16-36`

No new test: this is a move of existing code with no behavior change, covered by `tsc` and the existing preview flow.

- [ ] **Step 1: Add the shared fetch to `src/lib/blog.ts`**

Append:

```typescript
/**
 * A post by slug regardless of publish state, for draft preview.
 *
 * Deliberately NOT cached: it must reflect the row as it is right now, and it
 * must never populate a cache key that a published page could later read.
 */
export async function getDraftPostBySlug(
  slug: string,
): Promise<{ meta: PostMeta; content: string } | null> {
  const post = await getBlogPostBySlug(slug);
  if (!post || !post.content) return null;
  return {
    meta: {
      title: post.title,
      date: post.publishedAt?.split('T')[0] ?? new Date().toISOString().split('T')[0],
      slug: post.slug,
      excerpt: post.excerpt ?? '',
      type: post.type ?? 'announcement',
      ...(post.seasonRomanNumeral ? { season: post.seasonRomanNumeral } : {}),
      ...(post.seasonSlug ? { seasonSlug: post.seasonSlug } : {}),
      ...(post.week != null ? { week: post.week } : {}),
      ...(post.heroImage ? { heroImage: post.heroImage } : {}),
      ...(post.heroFocalY != null ? { heroFocalY: post.heroFocalY } : {}),
      ...(post.cardImage ? { cardImage: post.cardImage } : {}),
      ...(post.cardFocalY != null ? { cardFocalY: post.cardFocalY } : {}),
    },
    content: post.content,
  };
}
```

`getBlogPostBySlug` is already imported at the top of `src/lib/blog.ts`.

- [ ] **Step 2: Delete the local copy in the blog route**

In `src/app/blog/[slug]/page.tsx`, delete the whole local `getPreviewPost` function (lines 15-36, the JSDoc comment through the closing brace) and import the shared one instead. Change:

```typescript
import { getAllPosts, getPostBySlug, getAdjacentPosts, getPostContent } from '@/lib/blog';
```

to:

```typescript
import { getAllPosts, getPostBySlug, getAdjacentPosts, getPostContent, getDraftPostBySlug } from '@/lib/blog';
```

Then change the one call site (around line 73) from `getPreviewPost(slug)` to `getDraftPostBySlug(slug)`.

Remove the now-unused `getBlogPostBySlug` import from that file.

- [ ] **Step 3: Verify nothing broke**

Run: `npx tsc --noEmit`
Expected: no output (clean).

Run: `npx eslint 'src/app/blog/[slug]/page.tsx' src/lib/blog.ts`
Expected: no errors. An unused-import error here means step 2 missed one.

- [ ] **Step 4: Commit**

```bash
git add src/lib/blog.ts 'src/app/blog/[slug]/page.tsx'
git commit -m "refactor(blog): share the draft post fetch between routes"
```

---

## Task 3: Extract the week page body

**Files:**
- Create: `src/components/week/WeekPageBody.tsx`
- Modify: `src/app/week/[seasonSlug]/[weekNum]/page.tsx`

This is a mechanical move. Do not change any rendering logic.

- [ ] **Step 1: Create the component file**

Create `src/components/week/WeekPageBody.tsx` with this header:

```typescript
import { notFound } from 'next/navigation';
import type { PostMeta } from '@/lib/blog';

/** A draft post to render INSTEAD of the published post for this week. */
export interface DraftPostOverride {
  meta: PostMeta;
  content: string;
}

/**
 * Everything the week page renders.
 *
 * Lives here rather than in the route so two routes can render it: the public
 * week page (static, published data) and the admin draft preview (dynamic,
 * unpublished data). The public route must never read draftMode(), which is a
 * dynamic API and would deopt all ~325 week pages to per-request rendering.
 */
export async function WeekPageBody({
  seasonSlug,
  weekNum,
  draftPost,
}: {
  seasonSlug: string;
  weekNum: number;
  draftPost?: DraftPostOverride;
}) {
```

Then move the ENTIRE body of the current `WeekPage` component from
`src/app/week/[seasonSlug]/[weekNum]/page.tsx` lines 98-372 into it, starting
from `const season = await getSeasonBySlug(seasonSlug);`.

Skip the first two lines of the old body (`const { seasonSlug, weekNum: weekNumStr } = await params;` and `const weekNum = parseInt(weekNumStr, 10);`). The component now receives both as props.

Move every import the body needs from the route file's import block (lines 1-39) into the new file. The route file keeps only what `generateStaticParams` and `generateMetadata` still use.

- [ ] **Step 2: Apply the draft override**

In the moved body, find these lines (was `page.tsx:173-176`):

```typescript
  const blogPost = await getPostForWeek(season.romanNumeral, weekNum);
  const writeupContent = blogPost
    ? await getPostContentForWeek(season.romanNumeral, weekNum)
    : undefined;
```

Replace with:

```typescript
  // A draft override replaces the published post entirely, so the preview shows
  // the draft's hero image and writeup rather than whatever is already live.
  const blogPost = draftPost?.meta ?? await getPostForWeek(season.romanNumeral, weekNum);
  const writeupContent = draftPost
    ? draftPost.content
    : blogPost
      ? await getPostContentForWeek(season.romanNumeral, weekNum)
      : undefined;
```

- [ ] **Step 3: Reduce the route to a wrapper**

In `src/app/week/[seasonSlug]/[weekNum]/page.tsx`, replace the whole `export default async function WeekPage` (lines 93-372) with:

```typescript
export default async function WeekPage({
  params,
}: {
  params: Promise<{ seasonSlug: string; weekNum: string }>;
}) {
  const { seasonSlug, weekNum: weekNumStr } = await params;
  return <WeekPageBody seasonSlug={seasonSlug} weekNum={parseInt(weekNumStr, 10)} />;
}
```

Add the import:

```typescript
import { WeekPageBody } from '@/components/week/WeekPageBody';
```

Keep `export const dynamicParams = true;`, `generateStaticParams`, and `generateMetadata` exactly as they are.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint 'src/app/week/[seasonSlug]/[weekNum]/page.tsx' src/components/week/WeekPageBody.tsx`
Expected: no errors. Unused imports left in the route file will show up here.

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Verify the page still renders identically**

With `npm run dev` running:

```bash
curl -s http://localhost:3000/week/fall-2026/3 | grep -c 'Leaderboards'
```

Expected: at least 1. Also confirm HTTP 200 for weeks 1, 2, and 3:

```bash
for w in 1 2 3; do curl -s -o /dev/null -w "week $w: %{http_code}\n" "http://localhost:3000/week/fall-2026/$w"; done
```

Expected: `200` for all three.

- [ ] **Step 6: Confirm the public route stays static-safe**

```bash
grep -rn "draftMode" 'src/app/week/[seasonSlug]/[weekNum]/page.tsx' src/components/week/WeekPageBody.tsx
```

Expected: NO output. Any hit is a build-model regression and must be removed.

- [ ] **Step 7: Commit**

```bash
git add src/components/week/WeekPageBody.tsx 'src/app/week/[seasonSlug]/[weekNum]/page.tsx'
git commit -m "refactor(week): extract the page body so a preview route can reuse it"
```

---

## Task 4: The admin preview route

**Files:**
- Modify: `src/lib/admin/auth.ts`
- Modify: `src/app/evillair/(dashboard)/layout.tsx:13-23`
- Create: `src/app/evillair/preview/week/[seasonSlug]/[weekNum]/page.tsx`

**Why the route is NOT in the `(dashboard)` group:** that group's layout wraps
every child in `<AdminShell>`, the admin nav chrome. A preview wearing admin
chrome is not a preview of what readers see. Route groups do not affect URLs, so
the path is `/evillair/preview/week/...` either way. Leaving the group costs the
layout's auth, which is why Step 1 extracts a shared guard.

- [ ] **Step 1: Extract the page-level auth guard**

Append to `src/lib/admin/auth.ts`:

```typescript
/**
 * Require an authenticated admin or writer for a PAGE (not an API route).
 *
 * The API guards above take a NextRequest; a server component has to read
 * cookies() instead. Shared so a page outside the (dashboard) route group can
 * be gated without inheriting that group's AdminShell chrome.
 */
export async function requireAdminOrWriterPage(): Promise<TokenPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin-token')?.value;
  if (!token) redirect('/evillair/login');

  const payload = await verifyToken(token);
  if (!payload || (payload.role !== 'admin' && payload.role !== 'writer')) {
    redirect('/evillair/login');
  }

  return payload;
}
```

Add these imports to the top of `src/lib/admin/auth.ts`:

```typescript
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
```

- [ ] **Step 2: Point the dashboard layout at the shared guard**

In `src/app/evillair/(dashboard)/layout.tsx`, replace the body of `AdminLayout`:

```typescript
  const cookieStore = await cookies();
  const token = cookieStore.get('admin-token')?.value;

  if (!token) {
    redirect('/evillair/login');
  }

  const payload = await verifyToken(token);
  if (!payload || (payload.role !== 'admin' && payload.role !== 'writer')) {
    redirect('/evillair/login');
  }

  return <AdminShell role={payload.role}>{children}</AdminShell>;
```

with:

```typescript
  const payload = await requireAdminOrWriterPage();
  return <AdminShell role={payload.role}>{children}</AdminShell>;
```

Replace the `cookies`, `redirect`, and `verifyToken` imports with:

```typescript
import { requireAdminOrWriterPage } from '@/lib/admin/auth';
```

- [ ] **Step 3: Verify the dashboard still gates**

Run: `npx tsc --noEmit`
Expected: no output.

With `npm run dev` running, in a shell with no admin cookie:

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3000/evillair/blog
```

Expected: a 307 or 308 to `/evillair/login`. A `200` means the guard broke and you must stop and fix it before continuing.

- [ ] **Step 4: Create the preview route**

Create `src/app/evillair/preview/week/[seasonSlug]/[weekNum]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { requireAdminOrWriterPage } from '@/lib/admin/auth';
import { getDraftPostBySlug } from '@/lib/blog';
import { WeekPageBody } from '@/components/week/WeekPageBody';

/**
 * Admin-only preview of an unpublished recap, rendered as its week page.
 *
 * force-dynamic because it must read the blogPosts row as it is right now.
 * Deliberately outside the (dashboard) route group: that group's layout wraps
 * children in AdminShell, and a preview wearing admin chrome is not a preview
 * of what readers see.
 */
export const dynamic = 'force-dynamic';

export default async function WeekDraftPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ seasonSlug: string; weekNum: string }>;
  searchParams: Promise<{ slug?: string }>;
}) {
  await requireAdminOrWriterPage();

  const { seasonSlug, weekNum: weekNumStr } = await params;
  const { slug } = await searchParams;
  if (!slug) notFound();

  const draftPost = await getDraftPostBySlug(slug);
  if (!draftPost) notFound();

  const weekNum = parseInt(weekNumStr, 10);
  if (isNaN(weekNum)) notFound();

  return (
    <>
      <div className="bg-amber-100 border-b-2 border-amber-400 px-4 py-2 text-center">
        <p className="font-body text-sm text-navy">
          Draft preview of <strong>{draftPost.meta.title}</strong>. This is not live.
        </p>
      </div>
      <WeekPageBody seasonSlug={seasonSlug} weekNum={weekNum} draftPost={draftPost} />
    </>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: no output.

With `npm run dev` running and no admin cookie:

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" \
  "http://localhost:3000/evillair/preview/week/fall-2026/3?slug=season-xxxvi-week-3-recap"
```

Expected: a redirect to `/evillair/login`. A `200` means the route is unguarded and leaks unpublished content.

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin/auth.ts 'src/app/evillair/(dashboard)/layout.tsx' 'src/app/evillair/preview/week/[seasonSlug]/[weekNum]/page.tsx'
git commit -m "feat(admin): preview an unpublished recap as its week page"
```

---

## Task 5: Repoint the draft endpoint and the blog route

**Files:**
- Modify: `src/app/api/evillair/draft/route.ts:18-26`
- Modify: `src/app/blog/[slug]/page.tsx` (the redirect guard)

- [ ] **Step 1: Repoint the draft endpoint**

In `src/app/api/evillair/draft/route.ts`, replace:

```typescript
  if (slug) {
    return NextResponse.redirect(new URL(`/blog/${slug}`, request.url));
  }
```

with:

```typescript
  if (slug) {
    // Week-scoped posts preview as their week page, which is what readers get.
    const post = await getDraftPostBySlug(slug);
    const destination = post ? draftDestinationForPost(post.meta) : `/blog/${slug}`;
    return NextResponse.redirect(new URL(destination, request.url));
  }
```

Add the imports:

```typescript
import { getDraftPostBySlug } from '@/lib/blog';
import { draftDestinationForPost } from '@/lib/week-writeup';
```

- [ ] **Step 2: Repoint the blog route's draft branch**

In `src/app/blog/[slug]/page.tsx`, replace:

```typescript
  const weekPath = weekPathForPost(meta);
  if (weekPath && !isDraft) redirect(weekPath);
```

with:

```typescript
  // Weekly recaps now live on the week page. Old /blog/<slug> links are in every
  // weekly email ever sent, so they must keep resolving.
  // A draft of a week-scoped post goes to the admin preview route, which renders
  // the week page: previewing the old blog layout would proof a layout nobody
  // ever sees.
  const weekPath = weekPathForPost(meta);
  if (weekPath) redirect(isDraft ? draftDestinationForPost(meta) : weekPath);
```

Add `draftDestinationForPost` to the existing `@/lib/week-writeup` import.

Delete the now-stale comment block above the old guard if it duplicates the new one.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/evillair/draft/route.ts 'src/app/blog/[slug]/page.tsx'
git commit -m "feat(admin): send draft previews of recaps to the week page"
```

---

## Task 6: Delete the dead layout

**Files:**
- Modify: `src/lib/mdx-components.tsx`
- Modify: `src/components/week/WeekWriteup.tsx:30-33`
- Delete: `src/components/blog/WeekRecap.tsx`
- Delete: `src/components/blog/CompactLeaderboardPreview.tsx`

**Read this before starting:** all 9 recap posts have `<WeekRecap ... />` in their stored content, and MDX throws on an unregistered component. The NAME must stay registered forever. Only the implementation is deleted.

- [ ] **Step 1: Make the registration a no-op**

In `src/lib/mdx-components.tsx`, delete the import of `WeekRecap` from `@/components/blog/WeekRecap`, and change the map entry from `WeekRecap,` to:

```typescript
  // Every stored recap body ends with <WeekRecap />. The week page renders the
  // real stats itself, so the tag is a no-op, but the NAME must stay registered:
  // MDX throws on an unknown component and every recap page would break.
  WeekRecap: () => null,
```

- [ ] **Step 2: Drop the redundant local override**

In `src/components/week/WeekWriteup.tsx`, replace:

```typescript
  const components = {
    ...mdxComponents,
    WeekRecap: () => null,
  };
```

with:

```typescript
  const components = mdxComponents;
```

and update the JSDoc paragraph above the function that explains the override, since the stub is now global.

- [ ] **Step 3: Delete the files**

```bash
git rm src/components/blog/WeekRecap.tsx src/components/blog/CompactLeaderboardPreview.tsx
```

- [ ] **Step 4: Verify nothing references them**

```bash
grep -rn "WeekRecap\|CompactLeaderboardPreview" src/ | grep -v "WeekRecap: () => null" | grep -v "<WeekRecap"
```

Expected: only comments. Any remaining import is a build break.

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Verify a recap page still renders**

With `npm run dev` running:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/week/fall-2026/3
```

Expected: `200`. A 500 here means the MDX stub is wrong. Check Step 1.

- [ ] **Step 6: Commit**

```bash
git add -u
git commit -m "refactor(blog): delete the recap layout the preview no longer uses"
```

---

## Task 7: Full verification

- [ ] **Step 1: Run the suite and the project checks**

```bash
npm test
node scripts/pre-push-check.mjs
npx tsc --noEmit
```

Expected: all tests pass, all pre-push checks pass, no type errors.

- [ ] **Step 2: Confirm the static invariant holds**

```bash
grep -rn "draftMode" src/app/week/ src/components/week/
```

Expected: NO output.

- [ ] **Step 3: Manual check (requires Russ, admin login needed)**

Agents cannot log in; do not attempt to type the admin password.

1. Open the blog editor for an unpublished draft.
2. Hit Preview.
3. Confirm it lands on `/evillair/preview/week/<season>/<n>?slug=<slug>`, shows the amber "Draft preview" banner, and renders the week page with the Leaderboards section.
4. Confirm the draft's hero image and writeup appear, not the published week's.
5. Preview an announcement and confirm it still opens on `/blog/<slug>`.
6. Log out and confirm `/evillair/preview/week/fall-2026/3?slug=x` redirects to `/evillair/login`.
7. Confirm the preview does NOT show the admin sidebar chrome; it should look like the public week page with an amber banner on top.

- [ ] **Step 4: Remind Russ to update `content/updates.ts`**

The preview flow changed and `/blog/<slug>` draft behavior changed. Both are user-visible to the admin.

---

## Notes for the implementer

- **Never** run `vercel --prod --force`, bump `DB_CACHE_VERSION`, or add `/* vN */` comments to queries used by `generateStaticParams`.
- Skip `next build` locally; it overwhelms Azure SQL. Verify via `npm run dev`.
- No em dashes anywhere, including comments.
- `.published-week` is `s36-w3`. If Russ starts a publish-week while this is in flight, stop and let the publish settle first.
