/**
 * All-in-one blog recap component.
 * Condensed version of the weekly page:
 *   1. Awards (Bowler/Team of Week)
 *   2. Match scoreboard
 *   3. Compact side-by-side division standings
 *   4. Season leaderboards (men's/women's scratch avg, hcp avg — through week N)
 *   5. Milestones & Personal Bests
 */
import Link from 'next/link';
import {
  getSeasonBySlug,
  getSeasonWeeklyScores,
  getSeasonSchedule,
  getSeasonMatchResults,
  getSeasonStandings,
  getWeekCareerMilestones,
} from '@/lib/queries';
import { WeekMatchSummary } from '@/components/season/WeekMatchSummary';
import { WeekStats } from '@/components/season/WeekStats';
import { Standings } from '@/components/season/Standings';
import { LeaderboardSnapshot } from '@/components/blog/LeaderboardSnapshot';

function SectionHeader({ title, href, linkText }: { title: string; href: string; linkText: string }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="font-heading text-lg text-navy/80">{title}</h3>
      <Link href={href} className="text-sm font-body text-navy/50 hover:text-red-600 transition-colors">
        {linkText} &rarr;
      </Link>
    </div>
  );
}

interface WeekRecapProps {
  season: string;
  seasonSlug: string;
  week: number | string;
}

export async function WeekRecap({ season, seasonSlug, week }: WeekRecapProps) {
  const weekNum = typeof week === 'string' ? parseInt(week, 10) : week;
  const seasonData = await getSeasonBySlug(seasonSlug);
  if (!seasonData || isNaN(weekNum)) return null;

  const [allScores, allSchedule, allMatchResults, standings, careerMilestones] = await Promise.all([
    getSeasonWeeklyScores(seasonData.seasonID),
    getSeasonSchedule(seasonData.seasonID),
    getSeasonMatchResults(seasonData.seasonID),
    getSeasonStandings(seasonData.seasonID),
    getWeekCareerMilestones(seasonData.seasonID, weekNum),
  ]);

  const weekScores = allScores.filter(s => s.week === weekNum);
  const weekSchedule = allSchedule.filter(s => s.week === weekNum);
  const weekMatchResults = allMatchResults.filter(r => r.week === weekNum);
  const hasDivisions = standings.some(row => row.divisionName !== null);

  return (
    <div className="space-y-6">
      {/* Bowler & Team of the Week */}
      <WeekStats
        weekScores={weekScores}
        matchResults={weekMatchResults}
        careerMilestones={careerMilestones}
        only={['awards']}
        bare
        compact
      />

      {/* Weekly Results */}
      <div>
        <SectionHeader title="Weekly Results" href={`/week/${seasonSlug}/${weekNum}`} linkText={`Week ${weekNum} details`} />
        <WeekMatchSummary
          weekScores={weekScores}
          schedule={weekSchedule}
          matchResults={weekMatchResults}
          week={weekNum}
          compact
        />
      </div>

      {/* Standings */}
      <div>
        <SectionHeader title="Standings" href={`/season/${seasonSlug}`} linkText={`Season ${season} details`} />
        <Standings
          standings={standings}
          hasDivisions={hasDivisions}
          weekNumber={weekNum}
          seasonID={seasonData.seasonID}
          compact
        />
      </div>

      {/* Leaderboards */}
      <div>
        <SectionHeader title="Leaderboards" href={`/stats/${seasonSlug}`} linkText={`Season ${season} full stats`} />
        <LeaderboardSnapshot seasonSlug={seasonSlug} week={weekNum} />
      </div>

      {/* Milestones & Personal Bests */}
      <div>
        <SectionHeader title="Milestones & Personal Bests" href="/milestones" linkText="Milestone tracker" />
        <WeekStats
          weekScores={weekScores}
          matchResults={weekMatchResults}
          careerMilestones={careerMilestones}
          only={['records']}
          bare
          compact
        />
      </div>

      {/* Next League Night */}
      {(() => {
        const nextWeekSchedule = allSchedule.find(s => s.week === weekNum + 1);
        if (!nextWeekSchedule?.matchDate) return null;
        const date = new Date(nextWeekSchedule.matchDate);
        const formatted = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
        return (
          <p className="font-body text-navy/80 text-center text-lg mt-4">
            See you on {formatted}.
          </p>
        );
      })()}
    </div>
  );
}
