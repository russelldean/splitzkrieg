/**
 * Static season page.
 *
 * All season pages are pre-rendered at build time via generateStaticParams.
 * dynamicParams = false ensures unknown slugs return 404 immediately.
 *
 * Restructured: Focused on standings, race chart, records.
 * Leaderboards + full stats moved to /stats.
 * Weekly results replaced with compact week list linking to /week/[slug]/[num].
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getAllSeasonSlugs,
  getSeasonBySlug,
  getSeasonStandings,
  getSeasonRecords,
  getSeasonHeroStats,
  getSeasonWeeklyScores,
  getSeasonSchedule,
  getStandingsRaceData,
  getAllSeasonNavList,
  getSeasonWeekSummaries,
} from '@/lib/queries';
import { SeasonHero } from '@/components/season/SeasonHero';
import { Standings } from '@/components/season/Standings';
import { SeasonRecordsSection } from '@/components/season/SeasonRecordsSection';
import { StandingsRaceChart } from '@/components/season/StandingsRaceChart';
import { CompactWeekList } from '@/components/season/CompactWeekList';
import { SeasonNav } from '@/components/season/SeasonNav';

// Unknown slugs return 404 -- never attempt to render or hit the DB at runtime.
export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getAllSeasonSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const season = await getSeasonBySlug(slug);
  if (!season) return { title: 'Season Not Found | Splitzkrieg' };

  const heroStats = await getSeasonHeroStats(season.seasonID);
  const avgStr = heroStats?.leagueAverage?.toFixed(1) ?? 'N/A';
  const bowlers = heroStats?.totalBowlers ?? 0;

  const title = `Season ${season.romanNumeral} \u2014 ${season.period} ${season.year} | Splitzkrieg`;
  const description = `${season.period} ${season.year} \u2014 ${bowlers} bowlers, ${avgStr} league average. Splitzkrieg Bowling League.`;

  return {
    title,
    description,
    openGraph: {
      title: `Season ${season.romanNumeral} \u2014 ${season.period} ${season.year} | Splitzkrieg Bowling`,
      description,
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/season/${slug}`,
      siteName: 'Splitzkrieg Bowling League',
      type: 'website',
    },
  };
}

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const season = await getSeasonBySlug(slug);
  if (!season) notFound();

  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/season/${slug}`;

  const [standings, records, heroStats, weeklyScores, schedule, raceData, allSeasons, weekSummaries] = await Promise.all([
    getSeasonStandings(season.seasonID),
    getSeasonRecords(season.seasonID),
    getSeasonHeroStats(season.seasonID),
    getSeasonWeeklyScores(season.seasonID),
    getSeasonSchedule(season.seasonID),
    getStandingsRaceData(season.seasonID),
    getAllSeasonNavList(),
    getSeasonWeekSummaries(season.seasonID),
  ]);

  const hasDivisions = standings.some((row) => row.divisionName !== null);
  const hasScheduleData = schedule.length > 0;

  // Determine total weeks from max week in scores or schedule
  const maxScoreWeek = weeklyScores.length > 0
    ? Math.max(...weeklyScores.map(s => s.week))
    : 0;
  const maxScheduleWeek = schedule.length > 0
    ? Math.max(...schedule.map(s => s.week))
    : 0;
  const totalWeeks = Math.max(maxScoreWeek, maxScheduleWeek);

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <SeasonHero season={season} heroStats={heroStats} shareUrl={shareUrl} />

      {/* Prev/next season navigation */}
      <SeasonNav current={season} allSeasons={allSeasons} />

      {/* Section jump links */}
      {hasScheduleData && (
        <nav className="mt-6 flex flex-wrap gap-2 text-xs font-body">
          {standings.length > 0 && <a href="#standings" className="text-navy/50 hover:text-red-600 transition-colors px-2 py-1 rounded bg-navy/[0.03]">Standings</a>}
          {raceData.length > 0 && <a href="#race" className="text-navy/50 hover:text-red-600 transition-colors px-2 py-1 rounded bg-navy/[0.03]">Race Chart</a>}
          <a href="#weekly" className="text-navy/50 hover:text-red-600 transition-colors px-2 py-1 rounded bg-navy/[0.03]">Weekly Results</a>
          {records && <a href="#records" className="text-navy/50 hover:text-red-600 transition-colors px-2 py-1 rounded bg-navy/[0.03]">Records</a>}
          <Link href="/stats" className="text-navy/50 hover:text-red-600 transition-colors px-2 py-1 rounded bg-navy/[0.03]">
            Leaderboards &rarr;
          </Link>
        </nav>
      )}

      <div className="mt-8 space-y-12">
        <Standings standings={standings} hasDivisions={hasDivisions} />

        {hasScheduleData && raceData.length > 0 && (
          <StandingsRaceChart raceData={raceData} standings={standings} />
        )}

        {/* Compact week list — replaces full weekly results */}
        {totalWeeks > 0 ? (
          <CompactWeekList
            weekSummaries={weekSummaries}
            seasonSlug={slug}
            totalWeeks={totalWeeks}
          />
        ) : (
          <div className="bg-navy/[0.02] rounded-lg px-6 py-4">
            <p className="font-body text-sm text-navy/50 italic">
              This is an archival season page. Weekly results are available from Season XXVI onwards.
            </p>
          </div>
        )}

        <SeasonRecordsSection records={records} />
      </div>
    </main>
  );
}
