/**
 * All-in-one blog recap component.
 * Condensed-headline format with inline exit ramps:
 *   1. RecapCallout (new feature announcement, optional)
 *   2. Awards (Bowler/Team of Week, unchanged)
 *   3. Weekly Results (condensed summary + ExitRamp)
 *   4. Standings (CompactStandingsPreview + ExitRamp)
 *   5. Leaderboards (CompactLeaderboardPreview + ExitRamp)
 *   6. Milestones & Personal Bests (WeekStats records + ExitRamp)
 *   7. DiscoverySection (replaces Keep Exploring)
 *   8. Next League Night
 */
import {
  getSeasonBySlug,
  getSeasonWeeklyScores,
  getSeasonSchedule,
  getSeasonMatchResults,
  getWeekCareerMilestones,
} from '@/lib/queries';
import { getMatchResultsSummary, getStandingsSnapshot } from '@/lib/queries/blog';
import { WeekStats } from '@/components/season/WeekStats';
import { ExitRamp } from '@/components/tracking/ExitRamp';
import { TrackVisibility } from '@/components/tracking/TrackVisibility';
import { RecapCallout } from '@/components/blog/RecapCallout';
import { DiscoverySection } from '@/components/blog/DiscoverySection';
import { getSiteUpdates } from '@/lib/queries/updates';
import { getDb } from '@/lib/db';
import { CompactStandingsPreview } from '@/components/blog/CompactStandingsPreview';
import { CompactLeaderboardPreview } from '@/components/blog/CompactLeaderboardPreview';
import Link from 'next/link';

interface WeekRecapProps {
  season: string;
  seasonSlug: string;
  week: number | string;
  callout?: { headline: string; description: string; href?: string; linkText?: string };
}

export async function WeekRecap({ season, seasonSlug, week, callout }: WeekRecapProps) {
  const weekNum = typeof week === 'string' ? parseInt(week, 10) : week;
  const seasonData = await getSeasonBySlug(seasonSlug);
  if (!seasonData || isNaN(weekNum)) return null;

  const [allScores, allSchedule, allMatchResults, standings, careerMilestones, siteUpdates, weekMatchDetails] = await Promise.all([
    getSeasonWeeklyScores(seasonData.seasonID),
    getSeasonSchedule(seasonData.seasonID),
    getSeasonMatchResults(seasonData.seasonID),
    getStandingsSnapshot(seasonData.seasonID, weekNum),
    getWeekCareerMilestones(seasonData.seasonID, weekNum),
    getSiteUpdates(),
    getMatchResultsSummary(seasonData.seasonID, weekNum),
  ]);

  const weekScores = allScores.filter(s => s.week === weekNum);
  const weekMatchResults = allMatchResults.filter(r => r.week === weekNum);

  // Fetch custom discovery link overrides for this post — no isPublished filter
  // so draft previews reflect in-progress edits. Posts are unique per (seasonSlug, week).
  let discoveryOverrides: Array<{ text: string; href: string; description?: string }> | null = null;
  try {
    const db = await getDb();
    const dlResult = await db.request()
      .input('seasonSlug', seasonSlug)
      .input('week', weekNum)
      .query<{ discoveryLinks: string | null }>(`SELECT TOP 1 discoveryLinks FROM blogPosts WHERE seasonSlug = @seasonSlug AND week = @week ORDER BY isPublished DESC, id DESC`);
    const raw = dlResult.recordset[0]?.discoveryLinks;
    if (raw) discoveryOverrides = JSON.parse(raw);
  } catch { /* ignore */ }

  // Find Cloud 9 matches (one team won all 9 available points)
  const cloud9Matches = weekMatchDetails.filter(r => r.team1TotalPts === 9 || r.team2TotalPts === 9);

  return (
    <div className="week-recap space-y-6">
      {/* New Feature Callout */}
      <RecapCallout callout={callout} />

      {/* Bowler & Team of the Week */}
      <WeekStats
        weekScores={weekScores}
        matchResults={weekMatchResults}
        careerMilestones={careerMilestones}
        only={['awards']}
        bare
        compact
      />

      {/* Weekly Results — Cloud 9 */}
      <TrackVisibility section="recap-results" page="blog-recap">
        <div>
          <h3 className="font-heading text-lg text-navy/80 mb-1">Weekly Results</h3>
          <p className="font-body text-sm text-navy/65 mb-2">
            {cloud9Matches.length === 0
              ? 'No teams on Cloud 9 this week.'
              : `${cloud9Matches.length} team${cloud9Matches.length !== 1 ? 's' : ''} on Cloud 9.`}
          </p>
          {cloud9Matches.length > 0 && (
            <div className="mb-3 space-y-2">
              {cloud9Matches.map((m, i) => {
                // Winner (higher pts) always on left
                const flip = m.team2TotalPts > m.team1TotalPts;
                const leftName = flip ? m.team2Name : m.team1Name;
                const leftSlug = flip ? m.team2Slug : m.team1Slug;
                const leftPts = flip ? m.team2TotalPts : m.team1TotalPts;
                const leftSeries = flip ? m.team2Series : m.team1Series;
                const rightName = flip ? m.team1Name : m.team2Name;
                const rightSlug = flip ? m.team1Slug : m.team2Slug;
                const rightPts = flip ? m.team1TotalPts : m.team2TotalPts;
                const rightSeries = flip ? m.team1Series : m.team2Series;
                return (
                  <div key={i} className="bg-white border border-navy/10 rounded-lg shadow-sm px-4 py-3">
                    <div className="flex items-center justify-between gap-2 font-body text-sm">
                      <div className="flex-1 min-w-0 truncate font-semibold">
                        <Link href={`/team/${leftSlug}`} className="text-navy hover:text-red-600 transition-colors">
                          {leftName}
                        </Link>
                      </div>
                      <div className="flex items-center gap-3 tabular-nums text-xs text-navy/60 shrink-0">
                        <span className="font-bold text-navy">{leftPts}</span>
                        <span className="text-navy/30">-</span>
                        <span>{rightPts}</span>
                      </div>
                      <div className="flex-1 min-w-0 truncate text-right">
                        <Link href={`/team/${rightSlug}`} className="text-navy hover:text-red-600 transition-colors">
                          {rightName}
                        </Link>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1 font-body text-xs text-navy/60">
                      <span>{leftSeries?.toLocaleString()}</span>
                      <span>Series</span>
                      <span>{rightSeries?.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <ExitRamp
            href={`/week/${seasonSlug}/${weekNum}`}
            section="results"
            linkText="Full Weekly Report"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-lg bg-red-600 font-body text-sm font-semibold text-white hover:bg-red-700 transition-colors shadow-sm"
          />
        </div>
      </TrackVisibility>

      {/* Standings (condensed) */}
      <TrackVisibility section="recap-standings" page="blog-recap">
        <div>
          <h3 className="font-heading text-lg text-navy/80 mb-1">Standings</h3>
          <p className="font-body text-sm text-navy/65 mb-2">If the season ended today, playoff teams are:</p>
          <CompactStandingsPreview standings={standings} weekNumber={weekNum} />
          <div className="mt-2">
            <ExitRamp href={`/season/${seasonSlug}`} section="standings" linkText="Full standings and XP breakdown" />
          </div>
        </div>
      </TrackVisibility>

      {/* Leaderboards (condensed) */}
      <TrackVisibility section="recap-leaderboards" page="blog-recap">
        <div>
          <h3 className="font-heading text-lg text-navy/80 mb-1">Leaderboards</h3>
          <CompactLeaderboardPreview seasonSlug={seasonSlug} week={weekNum} />
          <div className="mt-2">
            <ExitRamp href={`/stats/${seasonSlug}`} section="leaderboards" linkText="All season leaderboards" />
          </div>
        </div>
      </TrackVisibility>

      {/* Milestones & Personal Bests (condensed) */}
      <TrackVisibility section="recap-milestones" page="blog-recap">
        <div>
          <h3 className="font-heading text-lg text-navy/80 mb-1">Milestones & Personal Bests</h3>
          <WeekStats
            weekScores={weekScores}
            matchResults={weekMatchResults}
            careerMilestones={careerMilestones}
            only={['records']}
            bare
            compact
          />
          <div className="mt-2">
            <ExitRamp href="/milestones" section="milestones" linkText="All milestones and personal bests" />
          </div>
        </div>
      </TrackVisibility>

      {/* Discover more of the site */}
      <TrackVisibility section="recap-discovery" page="blog-recap">
        <DiscoverySection seasonSlug={seasonSlug} updates={siteUpdates} asOfDate={allSchedule.find(s => s.week === weekNum)?.matchDate ?? undefined} overrides={discoveryOverrides} />
      </TrackVisibility>

      {/* Next League Night */}
      {(() => {
        const allScheduleData = allSchedule;
        const nextWeekSchedule = allScheduleData.find(s => s.week === weekNum + 1);
        if (!nextWeekSchedule?.matchDate) return null;
        const date = new Date(nextWeekSchedule.matchDate);
        const formatted = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
        return (
          <p className="font-body text-navy/80 text-center text-lg mt-4">
            Next League Night is {formatted}.
          </p>
        );
      })()}

      {/* Bottom CTA — repeat the weekly report link */}
      <div className="text-center pt-2">
        <ExitRamp
          href={`/week/${seasonSlug}/${weekNum}`}
          section="results-bottom"
          linkText="Full Weekly Report"
          className="inline-flex items-center gap-1.5 px-5 py-3 min-h-[44px] rounded-lg bg-red-600 font-body text-sm font-semibold text-white hover:bg-red-700 transition-colors shadow-sm"
        />
      </div>
    </div>
  );
}
