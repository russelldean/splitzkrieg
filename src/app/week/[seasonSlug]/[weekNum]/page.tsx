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
} from '@/lib/queries';
import { WeeklyResults } from '@/components/season/WeeklyResults';
import { WeekMatchSummary } from '@/components/season/WeekMatchSummary';
import { WeekSchedulePreview } from '@/components/season/WeekSchedulePreview';
import { WeekStats } from '@/components/season/WeekStats';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { strikeX } from '@/components/ui/StrikeX';
import { TrailNav } from '@/components/ui/TrailNav';
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
  const dateStr = formatMatchDate(matchDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Detect future week (has schedule but no scores)
  const isFutureWeek = weekSchedule.length > 0 && weekScores.length === 0;

  // Fetch H2H summaries for future week matchups
  const h2hSummaries = isFutureWeek
    ? await getPairwiseH2H(
        weekSchedule.map(s => ({ team1ID: s.homeTeamID, team2ID: s.awayTeamID }))
      )
    : [];

  // Prev/next week navigation
  const weekIdx = sortedWeeks.indexOf(weekNum);
  const prevWeek = weekIdx > 0 ? sortedWeeks[weekIdx - 1] : null;
  const nextWeek = weekIdx < sortedWeeks.length - 1 ? sortedWeeks[weekIdx + 1] : null;

  // Check for blog post cross-link
  const blogPost = getPostForWeek(season.romanNumeral, weekNum);

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
      {blogPost && (
        <Link
          href={`/blog/${blogPost.slug}`}
          className="flex items-center gap-2 px-4 py-3 mb-6 rounded-lg bg-cream border border-navy/10 hover:border-red-600/30 transition-colors group"
        >
          <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <span className="font-body text-sm text-navy/70 group-hover:text-red-600 transition-colors">
            Read the Week {weekNum} recap on the blog
          </span>
          <svg className="w-3 h-3 text-navy/40 group-hover:text-red-600 ml-auto transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      )}

      {isFutureWeek ? (
        /* Future week: show schedule with H2H records */
        <WeekSchedulePreview schedule={weekSchedule} h2hSummaries={h2hSummaries} />
      ) : (
        <>
          {/* Match summary scoreboard */}
          <WeekMatchSummary
            weekScores={weekScores}
            schedule={weekSchedule}
            matchResults={weekMatchResults}
            week={weekNum}
          />

          {/* Detailed match results — collapsed by default */}
          <div className="mt-6">
            <CollapsibleSection title="Full Match Details">
              <WeeklyResults
                weeklyScores={weekScores}
                schedule={weekSchedule}
                matchResults={weekMatchResults}
                totalWeeks={0}
                detailOnly
              />
            </CollapsibleSection>
          </div>

          {/* Weekly Highlights */}
          <WeekStats weekScores={weekScores} matchResults={weekMatchResults} />
        </>
      )}

      <TrailNav current="/week" seasonSlug={seasonSlug} seasonRoman={season.romanNumeral} />
    </main>
  );
}
