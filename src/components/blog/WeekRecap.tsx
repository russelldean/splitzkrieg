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
  getSeasonStandings,
  getWeekCareerMilestones,
} from '@/lib/queries';
import { WeekStats } from '@/components/season/WeekStats';
import { ExitRamp } from '@/components/tracking/ExitRamp';
import { TrackVisibility } from '@/components/tracking/TrackVisibility';
import { RecapCallout } from '@/components/blog/RecapCallout';
import { DiscoverySection } from '@/components/blog/DiscoverySection';
import { getSiteUpdates } from '@/lib/queries/updates';
import { CompactStandingsPreview } from '@/components/blog/CompactStandingsPreview';
import { CompactLeaderboardPreview } from '@/components/blog/CompactLeaderboardPreview';

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

  const [allScores, allSchedule, allMatchResults, standings, careerMilestones, siteUpdates] = await Promise.all([
    getSeasonWeeklyScores(seasonData.seasonID),
    getSeasonSchedule(seasonData.seasonID),
    getSeasonMatchResults(seasonData.seasonID),
    getSeasonStandings(seasonData.seasonID),
    getWeekCareerMilestones(seasonData.seasonID, weekNum),
    getSiteUpdates(),
  ]);

  const weekScores = allScores.filter(s => s.week === weekNum);
  const weekMatchResults = allMatchResults.filter(r => r.week === weekNum);

  // Compute condensed results summary
  const matchCount = weekMatchResults.length;
  const sweepCount = weekMatchResults.filter(r => {
    const t1Total = (r.team1GamePts ?? 0) + (r.team1BonusPts ?? 0);
    const t2Total = (r.team2GamePts ?? 0) + (r.team2BonusPts ?? 0);
    return t1Total === 4 || t2Total === 4;
  }).length;

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

      {/* Weekly Results (condensed) */}
      <TrackVisibility section="recap-results" page="blog-recap">
        <div>
          <h3 className="font-heading text-lg text-navy/80 mb-1">Weekly Results</h3>
          <p className="font-body text-sm text-navy/65 mb-2">
            {matchCount} match{matchCount !== 1 ? 'es' : ''} bowled.{sweepCount > 0 ? ` ${sweepCount} sweep${sweepCount !== 1 ? 's' : ''}.` : ''}
          </p>
          <ExitRamp href={`/week/${seasonSlug}/${weekNum}`} section="results" linkText="Full match results" />
        </div>
      </TrackVisibility>

      {/* Standings (condensed) */}
      <TrackVisibility section="recap-standings" page="blog-recap">
        <div>
          <h3 className="font-heading text-lg text-navy/80 mb-1">Standings</h3>
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
        <DiscoverySection seasonSlug={seasonSlug} updates={siteUpdates} />
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
    </div>
  );
}
