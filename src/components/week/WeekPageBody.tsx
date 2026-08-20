import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
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
import { getStandingsSnapshot } from '@/lib/queries/blog';
import { WeekMatchSummary } from '@/components/season/WeekMatchSummary';
import { WeekSchedulePreview } from '@/components/season/WeekSchedulePreview';
import { WeekStats } from '@/components/season/WeekStats';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { CompactStandingsPreview } from '@/components/blog/CompactStandingsPreview';
import { LeaderboardSnapshot } from '@/components/blog/LeaderboardSnapshot';
import { strikeX } from '@/components/ui/StrikeX';
import { TrailNav } from '@/components/ui/TrailNav';
import { NextStopNudge } from '@/components/ui/NextStopNudge';
import { formatMatchDate } from '@/lib/bowling-time';
import { toDateKey } from '@/lib/week-utils';
import { getPostForWeek, getPostContentForWeek, type DraftPostOverride, type PostMeta } from '@/lib/blog';
import { getSeasonsWithPlayoffData } from '@/lib/queries/playoffs/page';
import { TrackVisibility } from '@/components/tracking/TrackVisibility';
import { WeekWriteup } from '@/components/week/WeekWriteup';
import { WeekAdminBar } from '@/components/week/WeekAdminBar';
import { ScrollToHash } from '@/components/ui/ScrollToHash';
import { shouldExpandWriteup } from '@/lib/week-writeup';

/**
 * Everything the week page renders.
 *
 * Lives here rather than in the route so two routes can render it: the public
 * week page (static, published data) and the admin draft preview (dynamic,
 * unpublished data). The public route must never read Next's draft mode API,
 * which is dynamic and would deopt all ~325 week pages to per-request rendering.
 */
export async function WeekPageBody({
  seasonSlug,
  weekNum,
  draftPost,
}: {
  seasonSlug: string;
  weekNum: number;
  draftPost?: DraftPostOverride;
}) {
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
  // Normalize to a canonical key: matchDate is a Date object here (mssql), so a
  // raw Set would treat each row's Date as distinct.
  const distinctDates = Array.from(
    new Set(
      [...weekSchedule, ...weekScores]
        .map((r) => toDateKey(r.matchDate))
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

  // Standings frozen as of this week (NOT current/cumulative getSeasonStandings, which
  // has no week param). Only rendered in the non-future branch below, so gated the same
  // way as the neighbouring conditional fetches on this page.
  const weekStandings = isFutureWeek ? [] : await getStandingsSnapshot(season.seasonID, weekNum);

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

  // A draft override replaces the published post entirely, so the preview shows
  // the draft's hero image and writeup rather than whatever is already live.
  // Both values come from one branch, so a draft can never pair its own meta
  // with the published writeup, and the draft path issues no blog query at all.
  let blogPost: PostMeta | undefined;
  let writeupContent: string | undefined;
  if (draftPost) {
    blogPost = draftPost.meta;
    writeupContent = draftPost.content;
  } else {
    blogPost = await getPostForWeek(season.romanNumeral, weekNum);
    writeupContent = blogPost
      ? await getPostContentForWeek(season.romanNumeral, weekNum)
      : undefined;
  }
  const currentSeasonSlug = await getCurrentSeasonSlug();

  // Cross-season prev/next: if at first/last week, link to adjacent season
  const seasonIdx = allSeasons.findIndex(s => s.seasonID === season.seasonID);
  const olderSeason = seasonIdx < allSeasons.length - 1 ? allSeasons[seasonIdx + 1] : null;
  const newerSeason = seasonIdx > 0 ? allSeasons[seasonIdx - 1] : null;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Holds a #results deep link on target while the rest of this page
          renders. Without it the router scrolls once, too early, and the
          content above the anchor then pushes the anchor out of view. Named
          explicitly so it leaves #match-N to WeekMatchSummary, which does its
          own expand-and-scroll for shareable match links. */}
      <ScrollToHash id="results" />

      <TrailNav current="/week" seasonSlug={seasonSlug} seasonRoman={season.romanNumeral} position="top" />

      {/* Admin shortcut to this week's writeup. Current season only: nobody is
          going back to write a recap for a season that finished years ago.
          Renders nothing for a normal visitor, and nothing on the server, so
          the static build for all ~325 week pages is unaffected. */}
      {seasonSlug === currentSeasonSlug && !draftPost && (
        <WeekAdminBar seasonSlug={seasonSlug} week={weekNum} />
      )}
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
          <span className="font-body text-base font-semibold text-navy">
            Week {weekNum}
          </span>
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

      {/* Hero photo from the week's post */}
      {(blogPost?.heroImage ?? blogPost?.cardImage) && (
        <div className="relative mb-4 h-40 sm:h-52 rounded-xl overflow-hidden shadow-md ring-1 ring-navy/10">
          <Image
            src={(blogPost.heroImage ?? blogPost.cardImage)!}
            alt=""
            fill
            className="object-cover"
            style={{ objectPosition: `center ${(blogPost.heroFocalY ?? 0.5) * 100}%` }}
            sizes="(max-width: 1024px) 100vw, 960px"
          />
        </div>
      )}

      {/* Russ's writeup for the night */}
      {blogPost && writeupContent && (
        <WeekWriteup
          content={writeupContent}
          title={blogPost.title}
          excerpt={blogPost.excerpt}
          weekNum={weekNum}
          defaultOpen={shouldExpandWriteup(seasonSlug, currentSeasonSlug)}
        />
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
          {/* Bowler & Team of the Week, top-level awards */}
          <TrackVisibility section="awards" page="week">
            <div className="mb-6">
              <WeekStats weekScores={weekScores} matchResults={weekMatchResults} careerMilestones={careerMilestones} only={['awards']} bare />
            </div>
          </TrackVisibility>

          {/* Match Results. The id is the homepage hero's deep-link target: the
              writeup sits above this block, so an unanchored link would land the
              reader on the prose under a heading that says "Results". */}
          <div id="results" className="scroll-mt-20">
            <TrackVisibility section="match-results" page="week">
              <SectionHeading>Match Results</SectionHeading>

              {/* Match cards, click to expand individual match details */}
              <WeekMatchSummary
                weekScores={weekScores}
                schedule={weekSchedule}
                matchResults={weekMatchResults}
                week={weekNum}
              />
            </TrackVisibility>
          </div>

          {/* XP Rankings, below match details */}
          <TrackVisibility section="xp-rankings" page="week">
            <div className="mt-6">
              <WeekStats weekScores={weekScores} matchResults={weekMatchResults} careerMilestones={careerMilestones} only={['xp']} bare />
            </div>
          </TrackVisibility>

          {/* Weekly Highlights, starts with Milestones & Personal Bests */}
          <TrackVisibility section="highlights" page="week">
            <WeekStats weekScores={weekScores} matchResults={weekMatchResults} careerMilestones={careerMilestones} exclude={['awards', 'xp']} />
          </TrackVisibility>

          {/* Standings as of this week */}
          <TrackVisibility section="standings-snapshot" page="week">
            <div className="mt-6">
              <SectionHeading>Standings</SectionHeading>
              <p className="font-body text-sm text-navy/65 mb-2">
                If the season ended today, playoff teams are:
              </p>
              <CompactStandingsPreview standings={weekStandings} weekNumber={weekNum} />
            </div>
          </TrackVisibility>

          {/* Leaderboards as of this week */}
          <TrackVisibility section="leaderboards-snapshot" page="week">
            <div className="mt-6">
              <SectionHeading>Leaderboards</SectionHeading>
              <LeaderboardSnapshot seasonSlug={seasonSlug} week={weekNum} />
            </div>
          </TrackVisibility>
        </>
      )}

      <NextStopNudge currentPage="week" seasonSlug={seasonSlug} />

      {(() => {
        const nextWeekSchedule = allSchedule.find((s) => s.week === weekNum + 1);
        if (!nextWeekSchedule?.matchDate) return null;
        const date = new Date(nextWeekSchedule.matchDate);
        const formatted = date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          timeZone: 'UTC',
        });
        return (
          <p className="font-body text-navy/80 text-center text-lg mt-6">
            Next League Night is {formatted}.
          </p>
        );
      })()}
    </main>
  );
}
