/**
 * Static bowler profile page.
 *
 * All bowler pages are pre-rendered at build time via generateStaticParams.
 * dynamicParams = false ensures unknown slugs return 404 immediately --
 * the DB is never queried at runtime.
 *
 * Phase 2: Complete bowler profile with all five sections:
 * Hero header, personal records, average progression chart, season stats table, game log.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getAllBowlerSlugs,
  getBowlerBySlug,
  getBowlerCareerSummary,
  getBowlerSeasonStats,
  getBowlerGameLog,
} from '@/lib/queries';
import { BowlerHero } from '@/components/bowler/BowlerHero';
import { PersonalRecordsPanel } from '@/components/bowler/PersonalRecordsPanel';
import { SeasonStatsTable } from '@/components/bowler/SeasonStatsTable';
import { AverageProgressionChart } from '@/components/bowler/AverageProgressionChart';
import { GameLog } from '@/components/bowler/GameLog';
import type { TeamStat } from '@/components/bowler/TeamBreakdown';

// Unknown slugs return 404 -- never attempt to render or hit the DB at runtime.
export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getAllBowlerSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const bowler = await getBowlerBySlug(slug);
  if (!bowler) return { title: 'Bowler Not Found | Splitzkrieg' };

  // React.cache on getBowlerCareerSummary deduplicates this call
  // (same bowlerID will be called again in the page component)
  const summary = await getBowlerCareerSummary(bowler.bowlerID);
  const avgStr = summary?.careerAverage?.toFixed(1) ?? 'N/A';
  const games = summary?.totalGamesBowled ?? 0;
  const seasons = summary?.seasonsPlayed ?? 0;

  return {
    title: `${bowler.bowlerName} | Splitzkrieg`,
    description: `${bowler.bowlerName} \u2014 ${avgStr} career average \u00b7 ${games} games across ${seasons} seasons. Splitzkrieg Bowling League.`,
    openGraph: {
      title: `${bowler.bowlerName} | Splitzkrieg Bowling`,
      description: `Career average: ${avgStr} \u00b7 ${games} games bowled`,
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/bowler/${slug}`,
      siteName: 'Splitzkrieg Bowling League',
      type: 'profile',
    },
  };
}

export default async function BowlerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bowler = await getBowlerBySlug(slug);
  if (!bowler) notFound();

  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/bowler/${slug}`;

  // Parallel build-time data fetching
  const [careerSummary, seasonStats, gameLog] = await Promise.all([
    getBowlerCareerSummary(bowler.bowlerID),
    getBowlerSeasonStats(bowler.bowlerID),
    getBowlerGameLog(bowler.bowlerID),
  ]);

  // Derive team breakdown from season stats
  const teamMap = new Map<string, { teamName: string; teamSlug: string | null; nights: number }>();
  for (const s of seasonStats) {
    const key = s.teamSlug ?? s.teamName ?? 'Unknown';
    const existing = teamMap.get(key);
    if (existing) {
      existing.nights += s.nightsBowled;
    } else {
      teamMap.set(key, { teamName: s.teamName ?? 'Unknown', teamSlug: s.teamSlug, nights: s.nightsBowled });
    }
  }
  const totalNights = seasonStats.reduce((sum, s) => sum + s.nightsBowled, 0);
  const teams: TeamStat[] = Array.from(teamMap.values())
    .sort((a, b) => b.nights - a.nights)
    .map(t => ({
      teamName: t.teamName,
      teamSlug: t.teamSlug,
      nights: t.nights,
      pct: totalNights > 0 ? Math.round((t.nights / totalNights) * 100) : 0,
    }));

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <BowlerHero careerSummary={careerSummary} shareUrl={shareUrl} teams={teams} />

      <div className="mt-8 space-y-8">
        <PersonalRecordsPanel careerSummary={careerSummary} />

        {seasonStats.length >= 3 && (
          <AverageProgressionChart seasons={seasonStats} />
        )}

        <SeasonStatsTable seasons={seasonStats} />

        <GameLog gameLog={gameLog} />
      </div>
    </main>
  );
}
