/**
 * Individual week detail page.
 * Shows full matchup scores, box scores, and week stats.
 * Only the current season's weeks are pre-rendered at build time; historical
 * weeks render on demand (dynamicParams = true), with prev/next week navigation.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
  getSeasonBySlug,
  getWeekScores,
  getSeasonWeekNumbers,
  getSeasonSchedule,
  getSeasonMatchResults,
  getAllSeasonNavList,
  getPairwiseH2H,
  getWeekCareerMilestones,
  getSeasonStandings,
  getCurrentSeasonSlug,
} from '@/lib/queries';
import { WeekMatchSummary } from '@/components/season/WeekMatchSummary';
import { WeekSchedulePreview } from '@/components/season/WeekSchedulePreview';
import { WeekStats } from '@/components/season/WeekStats';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { strikeX } from '@/components/ui/StrikeX';
import { TrailNav } from '@/components/ui/TrailNav';
import { NextStopNudge } from '@/components/ui/NextStopNudge';
import { formatMatchDate } from '@/lib/bowling-time';
import { getPostForWeek } from '@/lib/blog';
import { getSeasonsWithPlayoffData } from '@/lib/queries/playoffs/page';
import { TrackVisibility } from '@/components/tracking/TrackVisibility';

export const dynamicParams = true;

export async function generateStaticParams(): Promise<{ seasonSlug: string; weekNum: string }[]> {
  // BUILD_ALL=1 prebuilds every season's weeks (full static build); default
  // prebuilds only the current season and renders historical weeks on demand.
  if (process.env.BUILD_ALL === '1') {
    const seasons = await getAllSeasonNavList();
    const params: { seasonSlug: string; weekNum: string }[] = [];
    for (const s of seasons) {
      const weeks = await getSeasonWeekNumbers(s.seasonID);
      for (const w of weeks) {
        params.push({ seasonSlug: s.slug, weekNum: String(w) });
      }
    }
    return params;
  }

  // Prebuild only the current season's weeks; historical weeks render on demand.
  const currentSlug = await getCurrentSeasonSlug();
  if (!currentSlug) return [];

  const season = await getSeasonBySlug(currentSlug);
  if (!season) return [];

  const scoreWeeks = await getSeasonWeekNumbers(season.seasonID);
  const schedule = await getSeasonSchedule(season.seasonID);

  const weeks = new Set<number>();
  scoreWeeks.forEach((w) => weeks.add(w));
  schedule.forEach((s) => weeks.add(s.week));

  return Array.from(weeks).map((week) => ({
    seasonSlug: currentSlug,
    weekNum: String(week),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seasonSlug: string; weekNum: string }>;
}): Promise<Metadata> {
  const { seasonSlug, weekNum } = await params;
  const season = await getSeasonBySlug(seasonSlug);
  if (!season) return { title: 'Week Not Found | Splitzkrieg' };

  const title = `Week ${weekNum} - Season ${season.romanNumeral} | Splitzkrieg`;
  const description = `Week ${weekNum} results for ${season.period} ${season.year} (Season ${season.romanNumeral}). Splitzkrieg Bowling League.`;

  return { title, description };
}

export default async function WeekPage({
  params,
}: {
  params: Promise<{ seasonSlug: string; weekNum: string }>;
}) {
  const { seasonSlug, weekNum: weekNumStr } = await params;
  const weekNum = parseInt(weekNumStr, 10);
  const season = await getSeasonBySlug(seasonSlug);
  if (!season || isNaN(weekNum)) notFound();

  const [weekScores, scoreWeeks, allSchedule, allMatchResults, allSeasons, playoffRounds] = await Promise.all([
    getWeekScores(season.seasonID, weekNum),
    getSeasonWeekNumbers(season.seasonID),
    getSeasonSchedule(season.seasonID),
    getSeasonMatchResults(season.seasonID),
    getAllSeasonNavList(),
    getSeasonsWithPlayoffData(),
  ]);
  const hasPlayoffR1 = playoffRounds.some(p => p.seasonID === season.seasonID && p.round === 1);

  // Determine all weeks for this season (score weeks + schedule weeks)
  const allWeeks = new Set<number>();
  scoreWeeks.forEach(w => allWeeks.add(w));
  allSchedule.forEach(s => allWeeks.add(s.week));
  const sortedWeeks = Array.from(allWeeks).sort((a, b) => a - b);

  if (!allWeeks.has(weekNum)) notFound();

  // weekScores is already scoped to this week; schedule/match results filtered here
  const weekSchedule = allSchedule.filter(s => s.week === weekNum);
  const weekMatchResults = allMatchResults.filter(r => r.week === weekNum);

  // Date(s) for this week. A split week spans more than one date -> show both.
  const distinctDates = Array.from(
    new Set(
      [...weekSchedule, ...weekScores]
        .map((r) => r.matchDate)
        .filter((d): d is string => d != null),
    ),
  ).sort();
  const dateStr =
    distinctDates.length > 1
      ? distinctDates.map((d) => formatMatchDate(d, { month: 'short', day: 'numeric' })).join(' & ')
      : formatMatchDate(distinctDates[0] ?? null, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });

  // Detect future week (has schedule but no scores, and season is current)
  const isFutureWeek = weekSchedule.length > 0 && weekScores.length === 0;
  // Detect archived week with missing data (no scores, not a future week)
  const isMissingData = weekScores.length === 0 && !isFutureWeek;

  // Fetch career milestones achieved this week (e.g., 50,000 career pins)
  const careerMilestones = isFutureWeek ? [] : await getWeekCareerMilestones(season.seasonID, weekNum);

  // Fetch H2H summaries and standings for future week matchups
  const [h2hSummaries, standings] = isFutureWeek
    ? await Promise.all([
        getPairwiseH2H(
          weekSchedule.map(s => ({ team1ID: s.homeTeamID, team2ID: s.awayTeamID }))
        ),
        getSeasonStandings(season.seasonID),
      ])
    : [[], []];

  // Prev/next week navigation
  const weekIdx = sortedWeeks.indexOf(weekNum);
  const prevWeek = weekIdx > 0 ? sortedWeeks[weekIdx - 1] : null;
  const nextWeek = weekIdx < sortedWeeks.length - 1 ? sortedWeeks[weekIdx + 1] : null;

  // Check for blog post cross-link
  const blogPost = await getPostForWeek(season.romanNumeral, weekNum);

  // Cross-season prev/next: if at first/last week, link to adjacent season
  const seasonIdx = allSeasons.findIndex(s => s.seasonID === season.seasonID);
  const olderSeason = seasonIdx < allSeasons.length - 1 ? allSeasons[seasonIdx + 1] : null;
  const newerSeason = seasonIdx > 0 ? allSeasons[seasonIdx - 1] : null;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <TrailNav current="/week" seasonSlug={seasonSlug} seasonRoman={season.romanNumeral} position="top" />
      <div className="mb-6">
        {/* Week header */}
        <div className="pb-5 border-b border-red-600/20">
          <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy">
            Season {strikeX(season.romanNumeral)}
          </h1>
          <p className="font-body text-sm text-navy/55 mt-1">
            Week {weekNum} &middot; {season.period} {season.year}
            {dateStr && <> &middot; {dateStr}</>}
          </p>
        </div>

        {/* Prev/Next arrows */}
        <div className="flex items-center justify-between mt-4">
          <div>
            {prevWeek ? (
              <Link
                href={`/week/${seasonSlug}/${prevWeek}`}
                className="flex items-center gap-1 text-sm font-body text-navy/65 hover:text-red-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Week {prevWeek}
              </Link>
            ) : olderSeason ? (
              <Link
                href={`/season/${olderSeason.slug}`}
                className="flex items-center gap-1 text-sm font-body text-navy/65 hover:text-red-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Season {olderSeason.romanNumeral}
              </Link>
            ) : <span />}
          </div>
          <span />
          <div>
            {nextWeek ? (
              <Link
                href={`/week/${seasonSlug}/${nextWeek}`}
                className="flex items-center gap-1 text-sm font-body text-navy/65 hover:text-red-600 transition-colors"
              >
                Week {nextWeek}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ) : hasPlayoffR1 ? (
              <Link
                href={`/playoffs/${seasonSlug}/1`}
                className="flex items-center gap-1 text-sm font-body text-navy/65 hover:text-red-600 transition-colors"
              >
                Semifinals
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ) : newerSeason ? (
              <Link
                href={`/season/${newerSeason.slug}`}
                className="flex items-center gap-1 text-sm font-body text-navy/65 hover:text-red-600 transition-colors"
              >
                Season {newerSeason.romanNumeral}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ) : <span />}
          </div>
        </div>
      </div>

      {/* Blog cross-link */}
      {blogPost && (
        <Link
          href={`/blog/${blogPost.slug}`}
          className="group block mb-4 rounded-xl overflow-hidden shadow-md ring-1 ring-navy/10 hover:shadow-lg transition-shadow"
        >
          <div className="relative h-36 sm:h-44">
            {(blogPost.cardImage || blogPost.heroImage) ? (
              <Image
                src={(blogPost.cardImage || blogPost.heroImage)!}
                alt={blogPost.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                style={{ objectPosition: `center ${(Math.min(1, (blogPost.cardFocalY ?? blogPost.heroFocalY ?? 0.5) + 0.1) * 100)}%` }}
                sizes="(max-width: 1024px) 100vw, 960px"
              />
            ) : (
              <div className="absolute inset-0 bg-navy" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
              <p className="text-xs uppercase tracking-wide font-semibold text-red-400 font-body mb-1">
                The Weekly Email
              </p>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-lg sm:text-xl font-heading text-white group-hover:text-red-300 transition-colors">
                  Read the full Week {weekNum} recap
                </p>
                <span className="font-body text-sm text-white/70 group-hover:text-white transition-colors whitespace-nowrap flex-shrink-0">
                  &rarr;
                </span>
              </div>
            </div>
          </div>
        </Link>
      )}

      {isMissingData ? (
        <div className="px-4 py-3 rounded-lg bg-navy/[0.03] border border-navy/10">
          <p className="font-body text-sm text-navy/65 italic">
            Note: Week {weekNum} data missing from archive.
          </p>
        </div>
      ) : isFutureWeek ? (
        /* Future week: show schedule with H2H records */
        <WeekSchedulePreview schedule={weekSchedule} h2hSummaries={h2hSummaries} standings={standings} />
      ) : (
        <>
          {/* Bowler & Team of the Week — top-level awards */}
          <TrackVisibility section="awards" page="week">
            <div className="mb-6">
              <WeekStats weekScores={weekScores} matchResults={weekMatchResults} careerMilestones={careerMilestones} only={['awards']} bare />
            </div>
          </TrackVisibility>

          {/* Match Results */}
          <TrackVisibility section="match-results" page="week">
            <SectionHeading>Match Results</SectionHeading>

            {/* Match cards — click to expand individual match details */}
            <WeekMatchSummary
              weekScores={weekScores}
              schedule={weekSchedule}
              matchResults={weekMatchResults}
              week={weekNum}
            />
          </TrackVisibility>

          {/* XP Rankings — below match details */}
          <TrackVisibility section="xp-rankings" page="week">
            <div className="mt-6">
              <WeekStats weekScores={weekScores} matchResults={weekMatchResults} careerMilestones={careerMilestones} only={['xp']} bare />
            </div>
          </TrackVisibility>

          {/* Weekly Highlights — starts with Milestones & Personal Bests */}
          <TrackVisibility section="highlights" page="week">
            <WeekStats weekScores={weekScores} matchResults={weekMatchResults} careerMilestones={careerMilestones} exclude={['awards', 'xp']} />
          </TrackVisibility>
        </>
      )}

      <NextStopNudge currentPage="week" seasonSlug={seasonSlug} />
    </main>
  );
}
