import { notFound } from 'next/navigation';
import { requireAdminOrWriterPage } from '@/lib/admin/auth';
import { getDraftPostBySlug } from '@/lib/blog';
import { draftMatchesWeek } from '@/lib/week-writeup';
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

  const weekNum = parseInt(weekNumStr, 10);
  if (isNaN(weekNum)) notFound();

  const draftPost = await getDraftPostBySlug(slug);
  if (!draftPost) notFound();

  // The week comes from the path and the draft comes from ?slug=. If they
  // disagree, we would render one week's stats under another week's writeup and
  // it would look entirely correct. Refuse instead.
  if (!draftMatchesWeek(draftPost.meta, seasonSlug, weekNum)) notFound();

  return (
    <>
      <div className="bg-amber-100 border-b-2 border-amber-400 px-4 py-2 text-center">
        <p className="font-body text-sm text-navy">
          Draft preview of <strong>{draftPost.meta.title}</strong>. This is not live.
        </p>
      </div>
      <WeekPageBody
        seasonSlug={seasonSlug}
        weekNum={weekNum}
        draftPost={draftPost}
        trackingEnabled={false}
      />
    </>
  );
}
