/**
 * Frame by Frame: one bowler's season as a stack of cards.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getBowlerBySlug, getBowlerCareerSummary } from '@/lib/queries';
import { getLatestScoredSeasonID, getLatestScoredSeasonBowlerSlugs } from '@/lib/queries/bowlers';
import { getBowlerWrapped } from '@/lib/views/bowler-wrapped';
import { SeasonWrapped } from '@/components/bowler/wrapped/SeasonWrapped';
import { PreviewSwitcher } from '@/components/bowler/wrapped/PreviewSwitcher';

export const dynamicParams = true;

// Under the full build, prebuild the recap for everyone who bowled the latest
// season (about 135 pages). Everyone else renders on their first visit.
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  if (process.env.BUILD_ALL === '1') {
    const bowlers = await getLatestScoredSeasonBowlerSlugs();
    return bowlers.filter(b => b.slug).map(b => ({ slug: b.slug }));
  }
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const bowler = await getBowlerBySlug(slug);
  if (!bowler) return { title: 'Bowler Not Found' };
  return { title: `${bowler.bowlerName}: Frame by Frame` };
}

export default async function BowlerWrappedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Latest season with scores, so the recap still reads "this season" through the offseason.
  const [bowler, seasonID] = await Promise.all([getBowlerBySlug(slug), getLatestScoredSeasonID()]);
  if (!bowler || seasonID == null) notFound();

  const [wrapped, career] = await Promise.all([
    getBowlerWrapped(bowler.bowlerID, seasonID),
    getBowlerCareerSummary(bowler.bowlerID),
  ]);
  if (!wrapped) notFound();

  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splitzkrieg.com'}/bowler/${slug}/frame-by-frame`;

  return (
    <main className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <PreviewSwitcher current={slug} />
      <SeasonWrapped w={wrapped} career={career} shareUrl={shareUrl} />
    </main>
  );
}
