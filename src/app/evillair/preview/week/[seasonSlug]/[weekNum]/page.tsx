import { notFound } from 'next/navigation';
import { requireAdminOrWriterPage } from '@/lib/admin/auth-page';
import { getDraftPostBySlug } from '@/lib/blog';
import { draftMatchesWeek } from '@/lib/week-writeup';
import { WeekPageBody } from '@/components/week/WeekPageBody';
import { TrackingScope } from '@/components/tracking/TrackingScope';

/**
 * Admin-only preview of an unpublished recap, rendered as its week page.
 *
 * force-dynamic because it must read the blogPosts row as it is right now.
 * Deliberately outside the (dashboard) route group: that group's layout wraps
 * children in AdminShell, and a preview wearing admin chrome is not a preview
 * of what readers see.
 *
 * OPERATIONAL EXCEPTION, deliberate: CLAUDE.md is emphatic that visitors never
 * hit the database, and Azure SQL caps us at 30 connections. This is the one
 * route that renders WeekPageBody's ~12 cachedQuery calls at REQUEST time
 * rather than build time, and .next/cache/sql/ is not reliably present in the
 * deployed function filesystem, so a preview render may query Azure SQL
 * directly. Accepted because the route is admin-gated and gets a handful of
 * hits a week. It is NOT a precedent for putting live queries on a public page.
 */
export const dynamic = 'force-dynamic';

export default async function WeekDraftPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ seasonSlug: string; weekNum: string }>;
  // Next hands back string | string[] for any query param, so narrow below
  // rather than lying about the type here.
  searchParams: Promise<{ slug?: string | string[] }>;
}) {
  await requireAdminOrWriterPage();

  const { seasonSlug, weekNum: weekNumStr } = await params;
  const { slug: rawSlug } = await searchParams;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  // Every branch below renders the same public 404, which on an admin-only
  // surface tells the operator nothing. Log which check actually failed, with
  // values. Admin-gated and already force-dynamic, so no leak and no cost.
  if (!slug) {
    console.warn(
      `[PREVIEW_404] ${JSON.stringify({ reason: 'no slug query param', seasonSlug, weekNum: weekNumStr })}`,
    );
    notFound();
  }

  const weekNum = parseInt(weekNumStr, 10);
  if (isNaN(weekNum)) {
    console.warn(
      `[PREVIEW_404] ${JSON.stringify({ reason: 'week segment is not a number', seasonSlug, weekNum: weekNumStr, slug })}`,
    );
    notFound();
  }

  const draftPost = await getDraftPostBySlug(slug);
  if (!draftPost) {
    console.warn(
      `[PREVIEW_404] ${JSON.stringify({
        reason: 'no draft post for slug (note: also returns null when the post exists but its content is empty, e.g. a freshly created post)',
        slug,
        seasonSlug,
        weekNum,
      })}`,
    );
    notFound();
  }

  // The week comes from the path and the draft comes from ?slug=. If they
  // disagree, we would render one week's stats under another week's writeup and
  // it would look entirely correct. Refuse instead. Most likely cause: the week
  // or season was edited in the editor after the Preview link was built.
  if (!draftMatchesWeek(draftPost.meta, seasonSlug, weekNum)) {
    console.warn(
      `[PREVIEW_404] ${JSON.stringify({
        reason: 'draft does not belong to this week (was the week or season edited after the Preview link was built?)',
        slug,
        routeSeasonSlug: seasonSlug,
        routeWeek: weekNum,
        postSeasonSlug: draftPost.meta.seasonSlug ?? null,
        postWeek: draftPost.meta.week ?? null,
      })}`,
    );
    notFound();
  }

  return (
    <TrackingScope enabled={false}>
      <div className="sticky top-0 z-40 bg-amber-100 border-b-2 border-amber-400 px-4 py-2 text-center">
        <p className="font-body text-sm text-navy">
          Draft preview of <strong>{draftPost.meta.title}</strong>. This is not live.
        </p>
      </div>
      <WeekPageBody seasonSlug={seasonSlug} weekNum={weekNum} draftPost={draftPost} />
    </TrackingScope>
  );
}
