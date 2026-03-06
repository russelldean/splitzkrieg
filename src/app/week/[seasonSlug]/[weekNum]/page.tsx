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
} from '@/lib/queries';
import { WeeklyResults } from '@/components/season/WeeklyResults';
import { WeekMatchSummary } from '@/components/season/WeekMatchSummary';
import { WeekStats } from '@/components/season/WeekStats';
import { CollapsibleSection } from '@/components/CollapsibleSection';

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

  const title = `Week ${weekNum} — Season ${season.romanNumeral} | Splitzkrieg`;
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
  const dateStr = matchDate
    ? new Date(matchDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  // Prev/next week navigation
  const weekIdx = sortedWeeks.indexOf(weekNum);
  const prevWeek = weekIdx > 0 ? sortedWeeks[weekIdx - 1] : null;
  const nextWeek = weekIdx < sortedWeeks.length - 1 ? sortedWeeks[weekIdx + 1] : null;

  // Cross-season prev/next: if at first/last week, link to adjacent season
  const seasonIdx = allSeasons.findIndex(s => s.seasonID === season.seasonID);
  const olderSeason = seasonIdx < allSeasons.length - 1 ? allSeasons[seasonIdx + 1] : null;
  const newerSeason = seasonIdx > 0 ? allSeasons[seasonIdx - 1] : null;

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Breadcrumb + navigation */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm font-body text-navy/50 mb-3">
          <Link href="/seasons" className="hover:text-red-600 transition-colors">Seasons</Link>
          <span className="text-navy/30">/</span>
          <Link href={`/season/${seasonSlug}`} className="hover:text-red-600 transition-colors">
            Season {season.romanNumeral}
          </Link>
          <span className="text-navy/30">/</span>
          <span className="text-navy/70">Week {weekNum}</span>
        </div>

        {/* Week header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl text-navy">
              Week {weekNum}
            </h1>
            <p className="font-body text-sm text-navy/50 mt-1">
              Season {season.romanNumeral} &middot; {season.period} {season.year}
              {dateStr && <> &middot; {dateStr}</>}
            </p>
          </div>
        </div>

        {/* Prev/Next arrows */}
        <div className="flex items-center justify-between mt-4">
          <div>
            {prevWeek ? (
              <Link
                href={`/week/${seasonSlug}/${prevWeek}`}
                className="flex items-center gap-1 text-sm font-body text-navy/50 hover:text-red-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Week {prevWeek}
              </Link>
            ) : olderSeason ? (
              <Link
                href={`/season/${olderSeason.slug}`}
                className="flex items-center gap-1 text-sm font-body text-navy/40 hover:text-red-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Season {olderSeason.romanNumeral}
              </Link>
            ) : <span />}
          </div>
          <Link
            href={`/season/${seasonSlug}#weekly`}
            className="text-sm font-body text-navy/50 hover:text-red-600 transition-colors"
          >
            All Weeks
          </Link>
          <div>
            {nextWeek ? (
              <Link
                href={`/week/${seasonSlug}/${nextWeek}`}
                className="flex items-center gap-1 text-sm font-body text-navy/50 hover:text-red-600 transition-colors"
              >
                Week {nextWeek}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ) : newerSeason ? (
              <Link
                href={`/season/${newerSeason.slug}`}
                className="flex items-center gap-1 text-sm font-body text-navy/40 hover:text-red-600 transition-colors"
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

      {/* Cross-links */}
      <div className="mt-8 pt-6 border-t border-navy/10 flex flex-wrap gap-4">
        <Link
          href={`/season/${seasonSlug}`}
          className="text-sm font-body text-navy/50 hover:text-red-600 transition-colors"
        >
          Season {season.romanNumeral} Standings
        </Link>
        <Link
          href="/stats"
          className="text-sm font-body text-navy/50 hover:text-red-600 transition-colors"
        >
          Season Leaderboards
        </Link>
      </div>
    </main>
  );
}
