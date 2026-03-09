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
  getSeasonHeroStats,
  getSeasonPlayoffBracket,
  getPlayoffTeamIDs,
  getSeasonWeeklyScores,
  getSeasonSchedule,
  getStandingsRaceData,
  getAllSeasonNavList,
  getSeasonWeekSummaries,
} from '@/lib/queries';
import { TrailNav } from '@/components/ui/TrailNav';
import { SeasonHero } from '@/components/season/SeasonHero';
import { Standings } from '@/components/season/Standings';
import { SeasonHighlights } from '@/components/season/SeasonHighlights';
import { StandingsRaceChart } from '@/components/season/StandingsRaceChart';
import { CompactWeekList } from '@/components/season/CompactWeekList';
import { CollapsibleSection } from '@/components/CollapsibleSection';
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

  const [standings, heroStats, bracket, weeklyScores, schedule, raceData, allSeasons, weekSummaries, playoffTeams] = await Promise.all([
    getSeasonStandings(season.seasonID),
    getSeasonHeroStats(season.seasonID),
    getSeasonPlayoffBracket(season.seasonID),
    getSeasonWeeklyScores(season.seasonID),
    getSeasonSchedule(season.seasonID),
    getStandingsRaceData(season.seasonID),
    getAllSeasonNavList(),
    getSeasonWeekSummaries(season.seasonID),
    getPlayoffTeamIDs(season.seasonID),
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
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <TrailNav current="/seasons" seasonSlug={slug} seasonRoman={season.romanNumeral} position="top" />

      <SeasonHero season={season} heroStats={heroStats} bracket={bracket} />

      {/* Prev/next season navigation */}
      <SeasonNav current={season} allSeasons={allSeasons} />

      <div className="mt-8 space-y-12">
        <Standings standings={standings} hasDivisions={hasDivisions} playoffTeams={playoffTeams} seasonID={season.seasonID} weekNumber={maxScoreWeek || null} />

        {hasScheduleData && raceData.length > 0 && (
          <CollapsibleSection title="Standings Race">
            <StandingsRaceChart raceData={raceData} standings={standings} />
          </CollapsibleSection>
        )}

        {/* Compact week list — replaces full weekly results */}
        {totalWeeks > 0 ? (
          <CompactWeekList
            weekSummaries={weekSummaries}
            schedule={schedule}
            seasonSlug={slug}
            totalWeeks={totalWeeks}
          />
        ) : (
          <div className="bg-navy/[0.02] rounded-lg px-6 py-4">
            <p className="font-body text-sm text-navy/65 italic">
              This is an archival season page. Weekly results are available from Season XXVI onwards.
            </p>
          </div>
        )}

        <div id="records">
          <SeasonHighlights weeklyScores={weeklyScores} />
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-navy/10 text-center">
        <p className="font-body text-sm text-navy/65">
          Looking for individual stats and playoff standings?{' '}
          <Link href={`/stats/${slug}`} className="text-red-600 hover:text-red-700 transition-colors font-medium">
            View Season Stats &rarr;
          </Link>
        </p>
      </div>

      <TrailNav current="/seasons" seasonSlug={slug} seasonRoman={season.romanNumeral} />
    </main>
  );
}
