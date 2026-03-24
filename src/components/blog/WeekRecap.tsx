/**
 * All-in-one blog recap component.
 * Condensed version of the weekly page:
 *   1. Awards (Bowler/Team of Week)
 *   2. Match scoreboard
 *   3. Compact side-by-side division standings
 *   4. Season leaderboards (men's/women's scratch avg, hcp avg -- through week N)
 *   5. Milestones & Personal Bests
 *   6. Keep Exploring section
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
    <div className="mb-3">
      <h3 className="font-heading text-lg text-navy/80 mb-1">{title}</h3>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy/[0.06] font-body text-sm font-medium text-navy/80 hover:bg-red-600 hover:text-white transition-colors"
      >
        {linkText}
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </Link>
    </div>
  );
}

function ExploreLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="group block bg-white border border-navy/10 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-red-600/30 transition-all"
    >
      <span className="font-heading text-base text-navy group-hover:text-red-600 transition-colors">
        {title}
      </span>
      <span className="block font-body text-sm text-navy/65 mt-0.5 leading-snug">
        {description}
      </span>
    </Link>
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
    <div className="week-recap space-y-6">
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
        <SectionHeader title="Weekly Results" href={`/week/${seasonSlug}/${weekNum}`} linkText="See full box scores and head-to-head results" />
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
        <SectionHeader title="Standings" href={`/season/${seasonSlug}`} linkText="Full season page with team averages and XP breakdown" />
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
        <SectionHeader title="Leaderboards" href={`/stats/${seasonSlug}`} linkText="Sortable stats for every bowler this season" />
        <LeaderboardSnapshot seasonSlug={seasonSlug} week={weekNum} />
      </div>

      {/* Milestones & Personal Bests */}
      <div>
        <SectionHeader title="Milestones & Personal Bests" href="/milestones" linkText="See who's approaching their next career milestone" />
        <WeekStats
          weekScores={weekScores}
          matchResults={weekMatchResults}
          careerMilestones={careerMilestones}
          only={['records']}
          bare
          compact
        />
      </div>

      {/* Keep Exploring */}
      <div>
        <div className="h-px bg-gradient-to-r from-transparent via-navy/15 to-transparent mb-6" />
        <h3 className="font-heading text-lg text-navy/80 mb-1">Keep Exploring</h3>
        <p className="font-body text-sm text-navy/65 mb-3">
          There's a lot hiding in here. A few places to start:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ExploreLink
            href="/stats/all-time/game-profiles"
            title="Your Game Profile"
            description="Are you a Fast Starter, Late Bloomer, or Flatliner? Find your archetype."
          />
          <ExploreLink
            href="/stats/all-time"
            title="All-Time Leaderboards"
            description="Career stats across all 35 seasons. Sort by any column and find your rank."
          />
          <ExploreLink
            href={`/season/${seasonSlug}`}
            title="Your Team's Page"
            description="Full roster history, head-to-head records, and every teammate you've ever had."
          />
          <ExploreLink
            href="/milestones"
            title="Milestone Tracker"
            description="Who just hit a career landmark? Who's one big night away from theirs?"
          />
        </div>
      </div>

      {/* Next League Night */}
      {(() => {
        const nextWeekSchedule = allSchedule.find(s => s.week === weekNum + 1);
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
