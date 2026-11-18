/**
 * Static season page.
 *
 * Only the current season is pre-rendered at build time via generateStaticParams.
 * Historical seasons render on demand (dynamicParams = true); this page already
 * notFound()s unknown slugs, so on-demand rendering stays safe.
 *
 * Restructured: Focused on standings, race chart, records.
 * Leaderboards + full stats moved to /stats.
 * Weekly results replaced with compact week list linking to /week/[slug]/[num].
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getSeasonBySlug,
  getSeasonStandings,
  getSeasonDivisionRoster,
  getSeasonHeroStats,
  getSeasonPlayoffBracket,
  getPlayoffTeamIDs,
  getSeasonWeeklyScoresLite,
  getSeasonSchedule,
  getStandingsRaceData,
  getAllSeasonNavList,
  getSeasonWeekSummaries,
  getCurrentSeasonID,
  getCurrentSeasonSlug,
  getAllSeasonSlugs,
} from '@/lib/queries';
import { TrailNav } from '@/components/ui/TrailNav';
import { NextStopNudge } from '@/components/ui/NextStopNudge';
import { SeasonHero } from '@/components/season/SeasonHero';
import { Standings } from '@/components/season/Standings';
import { SeasonHighlights } from '@/components/season/SeasonHighlights';
import { CompactWeekList } from '@/components/season/CompactWeekList';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { SeasonNav } from '@/components/season/SeasonNav';
import { TrackVisibility } from '@/components/tracking/TrackVisibility';

// Historical slugs render on demand; unknown slugs still 404 via the page body.
export const dynamicParams = true;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  // BUILD_ALL=1 prebuilds every season (full static build); default prebuilds
  // only the current season and renders historical on demand.
  if (process.env.BUILD_ALL === '1') {
    const seasons = await getAllSeasonSlugs();
    return seasons.map((s) => ({ slug: s.slug }));
  }
  const slug = await getCurrentSeasonSlug();
  return slug ? [{ slug }] : [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const season = await getSeasonBySlug(slug);
  if (!season) return { title: 'Season Not Found' };

  const heroStats = await getSeasonHeroStats(season.seasonID);
  const avgStr = heroStats?.leagueAverage?.toFixed(1) ?? 'N/A';
  const bowlers = heroStats?.totalBowlers ?? 0;

  const title = `Season ${season.romanNumeral} - ${season.period} ${season.year}`;
  const description = `${season.period} ${season.year} - ${bowlers} bowlers, ${avgStr} league average. Splitzkrieg Bowling League.`;

  return {
    title,
    description,
    openGraph: {
      title: `Season ${season.romanNumeral} - ${season.period} ${season.year} | Splitzkrieg Bowling`,
      description,
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splitzkrieg.com'}/season/${slug}`,
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

  const [standings, heroStats, bracket, weeklyScores, schedule, raceData, allSeasons, weekSummaries, playoffTeams, currentSeasonID] = await Promise.all([
    getSeasonStandings(season.seasonID),
    getSeasonHeroStats(season.seasonID),
    getSeasonPlayoffBracket(season.seasonID),
    getSeasonWeeklyScoresLite(season.seasonID),
    getSeasonSchedule(season.seasonID),
    getStandingsRaceData(season.seasonID),
    getAllSeasonNavList(),
    getSeasonWeekSummaries(season.seasonID),
    getPlayoffTeamIDs(season.seasonID),
    getCurrentSeasonID(),
  ]);

  const isCurrentSeason = season.seasonID === currentSeasonID;
  // The schedule card comes down once the final has a winner: the season is over.
  const seasonComplete = bracket != null && !bracket.final.pending;

  // Preseason: standings are scores-driven and empty until week 1. Fall back to
  // the division roster (zeroed records) so teams still show grouped by division.
  const preseasonRoster = standings.length === 0
    ? await getSeasonDivisionRoster(season.seasonID)
    : [];
  const usePreseason = standings.length === 0 && preseasonRoster.length > 0;
  const displayStandings = usePreseason ? preseasonRoster : standings;

  const hasDivisions = displayStandings.some((row) => row.divisionName !== null);
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

      {isCurrentSeason && !seasonComplete && (
        <a
          href="/schedule.html"
          className="group mt-4 flex items-center gap-4 rounded-xl border border-navy/10 bg-white px-5 py-4 shadow-sm transition-all hover:border-red-600/40 hover:shadow-md"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-600/10 text-red-600 transition-colors group-hover:bg-red-600 group-hover:text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-heading text-base text-navy transition-colors group-hover:text-red-600">
              Season {season.romanNumeral} Schedule
            </div>
            <div className="font-body text-sm text-navy/65">
              Divisions, weekly matchups &amp; how to pay
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1 font-body text-sm font-medium text-navy/65 transition-colors group-hover:text-red-600">
            <span className="hidden sm:inline">View</span>
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </span>
        </a>
      )}

      {isCurrentSeason && (
        <Link
          href={`/season/${slug}/badges`}
          prefetch={false}
          className={`group ${seasonComplete ? 'mt-4' : 'mt-3'} flex items-center gap-4 rounded-xl border border-navy/10 bg-white px-5 py-4 shadow-sm transition-all hover:border-red-600/40 hover:shadow-md`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-600/10 text-red-600 transition-colors group-hover:bg-red-600 group-hover:text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-heading text-base text-navy transition-colors group-hover:text-red-600">
              Season {season.romanNumeral} Badge Wall
            </div>
            <div className="font-body text-sm text-navy/65">
              Every badge earned this season, from weekly highs to champions
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1 font-body text-sm font-medium text-navy/65 transition-colors group-hover:text-red-600">
            <span className="hidden sm:inline">View</span>
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </span>
        </Link>
      )}

      {/* Prev/next season navigation */}
      <SeasonNav current={season} allSeasons={allSeasons} />

      {season.notes && (
        <div className="mt-4 px-4 py-3 rounded-lg bg-navy/[0.03] border border-navy/10">
          <p className="font-body text-sm text-navy/65 italic">
            Note: {season.notes}
          </p>
        </div>
      )}

      <div className="mt-8 space-y-12">
        <TrackVisibility section="standings" page="season">
          <Standings standings={displayStandings} hasDivisions={hasDivisions} playoffTeams={playoffTeams} seasonID={season.seasonID} weekNumber={maxScoreWeek || null} showDelta={isCurrentSeason} raceData={raceData} preseason={usePreseason} />
        </TrackVisibility>

        {/* Compact week list — replaces full weekly results */}
        <TrackVisibility section="week-list" page="season">
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
        </TrackVisibility>

        <TrackVisibility section="records" page="season">
          <div id="records">
            <SeasonHighlights weeklyScores={weeklyScores} />
          </div>
        </TrackVisibility>
      </div>

      <NextStopNudge currentPage="season" seasonSlug={slug} />
    </main>
  );
}
