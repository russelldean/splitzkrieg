/**
 * Individual week detail page.
 * Shows full matchup scores, box scores, and week stats.
 * Pre-rendered at build time with prev/next week navigation.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getAllSeasonSlugs,
  getSeasonBySlug,
  getSeasonWeeklyScores,
  getSeasonSchedule,
  getSeasonMatchResults,
  getAllSeasonNavList,
  getPairwiseH2H,
  getWeekCareerMilestones,
  getSeasonStandings,
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

export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ seasonSlug: string; weekNum: string }[]> {
  const seasonSlugs = await getAllSeasonSlugs();
  const params: { seasonSlug: string; weekNum: string }[] = [];

  for (const { slug } of seasonSlugs) {
    const season = await getSeasonBySlug(slug);
    if (!season) continue;

    const scores = await getSeasonWeeklyScores(season.seasonID);
    const schedule = await getSeasonSchedule(season.seasonID);

    const weeks = new Set<number>();
    scores.forEach(s => weeks.add(s.week));
    schedule.forEach(s => weeks.add(s.week));

    for (const week of weeks) {
      params.push({ seasonSlug: slug, weekNum: String(week) });
    }
  }

  return params;
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

  const [allScores, allSchedule, allMatchResults, allSeasons] = await Promise.all([
    getSeasonWeeklyScores(season.seasonID),
    getSeasonSchedule(season.seasonID),
    getSeasonMatchResults(season.seasonID),
    getAllSeasonNavList(),
  ]);

  // Determine all weeks for this season
  const allWeeks = new Set<number>();
  allScores.forEach(s => allWeeks.add(s.week));
  allSchedule.forEach(s => allWeeks.add(s.week));
  const sortedWeeks = Array.from(allWeeks).sort((a, b) => a - b);

  if (!allWeeks.has(weekNum)) notFound();

  // Filter to this week only
  const weekScores = allScores.filter(s => s.week === weekNum);
  const weekSchedule = allSchedule.filter(s => s.week === weekNum);
  const weekMatchResults = allMatchResults.filter(r => r.week === weekNum);

  // Get date for this week
  const matchDate = weekScores[0]?.matchDate ?? weekSchedule[0]?.matchDate ?? null;
  const dateStr = formatMatchDate(matchDate, { weekday: 'long', month: 'long', day: 'numeric' });

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
          <Link
            href="/week"
            className="text-sm font-body text-navy/65 hover:text-red-600 transition-colors"
          >
            All Weeks
          </Link>
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
      {blogPost && (<>
        <style>{`@keyframes nudge-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(197, 48, 48, 0.4); } 50% { box-shadow: 0 0 0 8px rgba(197, 48, 48, 0); } }`}</style>
        <Link
          href={`/blog/${blogPost.slug}`}
          className="group block mb-6 bg-white border-2 border-red-600/60 rounded-xl p-4 sm:p-5 hover:border-red-600 hover:shadow-md transition-all animate-[nudge-glow_2.5s_ease-in-out_infinite]"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-wide font-semibold text-red-600 font-body">
                The Weekly Email
              </p>
              <p className="text-lg font-heading text-navy">
                Read the full Week {weekNum} recap...
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shrink-0 group-hover:bg-red-700 transition-colors">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </div>
        </Link>
      </>)}

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
          <div className="mb-6">
            <WeekStats weekScores={weekScores} matchResults={weekMatchResults} careerMilestones={careerMilestones} only={['awards']} bare />
          </div>

          {/* Match Results */}
          <SectionHeading>Match Results</SectionHeading>

          {/* Match cards — click to expand individual match details */}
          <WeekMatchSummary
            weekScores={weekScores}
            schedule={weekSchedule}
            matchResults={weekMatchResults}
            week={weekNum}
          />

          {/* XP Rankings — below match details */}
          <div className="mt-6">
            <WeekStats weekScores={weekScores} matchResults={weekMatchResults} careerMilestones={careerMilestones} only={['xp']} bare />
          </div>

          {/* Weekly Highlights — starts with Milestones & Personal Bests */}
          <WeekStats weekScores={weekScores} matchResults={weekMatchResults} careerMilestones={careerMilestones} exclude={['awards', 'xp']} />
        </>
      )}

      <NextStopNudge currentPage="week" seasonSlug={seasonSlug} />
    </main>
  );
}
