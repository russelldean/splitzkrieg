'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { WeeklyMatchScore, SeasonScheduleWeek } from '@/lib/queries';
import { scoreColorClass } from '@/lib/score-utils';

interface Props {
  weeklyScores: WeeklyMatchScore[];
  schedule: SeasonScheduleWeek[];
  totalWeeks: number;
}

/** Group scores by week, then by team within each week. */
function organizeByWeek(scores: WeeklyMatchScore[]) {
  const weekMap = new Map<number, Map<number, WeeklyMatchScore[]>>();
  for (const row of scores) {
    if (!weekMap.has(row.week)) weekMap.set(row.week, new Map());
    const teamMap = weekMap.get(row.week)!;
    if (!teamMap.has(row.teamID)) teamMap.set(row.teamID, []);
    teamMap.get(row.teamID)!.push(row);
  }
  return weekMap;
}

/** Get matchups from schedule for a given week. */
function getMatchups(schedule: SeasonScheduleWeek[], week: number) {
  return schedule.filter(s => s.week === week);
}

/** Get the date for a given week from scores or schedule. */
function getWeekDate(
  scores: WeeklyMatchScore[],
  schedule: SeasonScheduleWeek[],
  week: number
): string | null {
  // Try scores first
  const scoreDate = scores.find(s => s.week === week)?.matchDate;
  if (scoreDate) return scoreDate;
  // Try schedule
  const schedDate = schedule.find(s => s.week === week)?.matchDate;
  return schedDate ?? null;
}

/** Sum a team's game scores for a given game number. */
function teamGameTotal(bowlers: WeeklyMatchScore[], gameKey: 'game1' | 'game2' | 'game3'): number {
  return bowlers.reduce((sum, b) => sum + (b[gameKey] ?? 0), 0);
}

function teamSeriesTotal(bowlers: WeeklyMatchScore[]): number {
  return bowlers.reduce((sum, b) => sum + (b.scratchSeries ?? 0), 0);
}

function TeamBoxScore({
  teamName,
  teamSlug,
  bowlers,
}: {
  teamName: string;
  teamSlug: string;
  bowlers: WeeklyMatchScore[];
}) {
  const g1Total = teamGameTotal(bowlers, 'game1');
  const g2Total = teamGameTotal(bowlers, 'game2');
  const g3Total = teamGameTotal(bowlers, 'game3');
  const seriesTot = teamSeriesTotal(bowlers);

  return (
    <div>
      <Link
        href={`/team/${teamSlug}`}
        className="font-heading text-sm text-navy hover:text-red-600 transition-colors"
      >
        {teamName}
      </Link>
      <table className="w-full text-sm font-body mt-1">
        <thead>
          <tr className="border-b border-navy/10">
            <th className="text-left px-2 py-1 text-navy/40 font-normal text-xs w-[40%]">Bowler</th>
            <th className="text-right px-2 py-1 text-navy/40 font-normal text-xs">G1</th>
            <th className="text-right px-2 py-1 text-navy/40 font-normal text-xs">G2</th>
            <th className="text-right px-2 py-1 text-navy/40 font-normal text-xs">G3</th>
            <th className="text-right px-2 py-1 text-navy/40 font-normal text-xs">Series</th>
          </tr>
        </thead>
        <tbody>
          {bowlers.map((b) => {
            const isDebut = b.incomingAvg === null;
            return (
              <tr key={b.bowlerID} className="border-b border-navy/5">
                <td className="px-2 py-1">
                  <Link
                    href={`/bowler/${b.bowlerSlug}`}
                    className="text-navy hover:text-red-600 underline-offset-2 hover:underline text-xs sm:text-sm"
                  >
                    {b.bowlerName}
                  </Link>
                  {isDebut && (
                    <span className="ml-1.5 text-[10px] font-heading text-red-600/70 bg-red-600/10 px-1 py-0.5 rounded uppercase tracking-wider">
                      Debut
                    </span>
                  )}
                </td>
                <td className={`px-2 py-1 text-right tabular-nums text-xs sm:text-sm ${scoreColorClass(b.game1)}`}>
                  {b.game1 ?? '\u2014'}
                </td>
                <td className={`px-2 py-1 text-right tabular-nums text-xs sm:text-sm ${scoreColorClass(b.game2)}`}>
                  {b.game2 ?? '\u2014'}
                </td>
                <td className={`px-2 py-1 text-right tabular-nums text-xs sm:text-sm ${scoreColorClass(b.game3)}`}>
                  {b.game3 ?? '\u2014'}
                </td>
                <td className="px-2 py-1 text-right tabular-nums font-semibold text-xs sm:text-sm">
                  {b.scratchSeries ?? '\u2014'}
                </td>
              </tr>
            );
          })}
          <tr className="bg-navy/[0.03]">
            <td className="px-2 py-1 text-xs font-heading text-navy/60">Team Total</td>
            <td className="px-2 py-1 text-right tabular-nums font-semibold text-xs">{g1Total}</td>
            <td className="px-2 py-1 text-right tabular-nums font-semibold text-xs">{g2Total}</td>
            <td className="px-2 py-1 text-right tabular-nums font-semibold text-xs">{g3Total}</td>
            <td className="px-2 py-1 text-right tabular-nums font-bold text-xs">{seriesTot}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function WeeklyResults({ weeklyScores, schedule, totalWeeks }: Props) {
  const weekData = useMemo(() => organizeByWeek(weeklyScores), [weeklyScores]);

  // All week numbers that have either scores or schedule
  const allWeeks = useMemo(() => {
    const weeks = new Set<number>();
    weeklyScores.forEach(s => weeks.add(s.week));
    schedule.forEach(s => weeks.add(s.week));
    // Ensure all weeks up to totalWeeks are represented
    for (let w = 1; w <= totalWeeks; w++) weeks.add(w);
    return Array.from(weeks).sort((a, b) => a - b);
  }, [weeklyScores, schedule, totalWeeks]);

  // Weeks that have scores
  const weeksWithScores = useMemo(
    () => new Set(weeklyScores.map(s => s.week)),
    [weeklyScores]
  );

  const [openWeeks, setOpenWeeks] = useState<Set<number>>(() => {
    // Open the most recent week with scores by default
    const playedWeeks = Array.from(weeksWithScores).sort((a, b) => b - a);
    return new Set(playedWeeks.length > 0 ? [playedWeeks[0]] : []);
  });

  const allOpen = openWeeks.size === allWeeks.length;

  function toggleAll() {
    setOpenWeeks(allOpen ? new Set() : new Set(allWeeks));
  }

  function toggleWeek(week: number) {
    setOpenWeeks(prev => {
      const next = new Set(prev);
      next.has(week) ? next.delete(week) : next.add(week);
      return next;
    });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="font-heading text-2xl text-navy">Weekly Results</h2>
          <p className="font-body text-sm text-navy/50">
            Match-by-match scores for every bowling night.
          </p>
        </div>
        <button
          onClick={toggleAll}
          className="text-sm font-body text-navy/50 hover:text-red-600 transition-colors"
        >
          {allOpen ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      <div className="space-y-1">
        {allWeeks.map(week => {
          const hasScores = weeksWithScores.has(week);
          const matchups = getMatchups(schedule, week);
          const date = getWeekDate(weeklyScores, schedule, week);
          const dateStr = date
            ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : null;
          const teamScores = weekData.get(week);
          const matchCount = matchups.length || (teamScores ? Math.ceil(teamScores.size / 2) : 0);

          return (
            <div key={week} className="border border-navy/10 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleWeek(week)}
                className="w-full flex justify-between items-center px-4 py-3 bg-navy/[0.02] hover:bg-navy/[0.05] transition-colors"
              >
                <span className="font-heading text-lg text-navy">
                  Week {week}
                  {dateStr && (
                    <span className="text-navy/40 font-body text-sm ml-2">{dateStr}</span>
                  )}
                  {!hasScores && (
                    <span className="text-navy/30 font-body text-sm ml-2 italic">Upcoming</span>
                  )}
                </span>
                <span className="text-navy/40 text-sm">
                  {hasScores ? `${matchCount} matches` : `${matchups.length} matchups`}{' '}
                  {openWeeks.has(week) ? '\u25B2' : '\u25BC'}
                </span>
              </button>

              {openWeeks.has(week) && (
                <div className="px-4 py-3 space-y-4">
                  {hasScores && matchups.length > 0 ? (
                    // Scores WITH schedule matchups -- show as "Home vs Away"
                    matchups.map((matchup, idx) => {
                      const homeBowlers = teamScores?.get(matchup.homeTeamID) ?? [];
                      const awayBowlers = teamScores?.get(matchup.awayTeamID) ?? [];
                      return (
                        <div key={idx} className="border border-navy/5 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2 text-sm font-heading text-navy/60">
                            <Link href={`/team/${matchup.homeTeamSlug}`} className="hover:text-red-600">
                              {matchup.homeTeamName}
                            </Link>
                            <span className="text-navy/30">vs</span>
                            <Link href={`/team/${matchup.awayTeamSlug}`} className="hover:text-red-600">
                              {matchup.awayTeamName}
                            </Link>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {homeBowlers.length > 0 && (
                              <TeamBoxScore
                                teamName={matchup.homeTeamName}
                                teamSlug={matchup.homeTeamSlug}
                                bowlers={homeBowlers}
                              />
                            )}
                            {awayBowlers.length > 0 && (
                              <TeamBoxScore
                                teamName={matchup.awayTeamName}
                                teamSlug={matchup.awayTeamSlug}
                                bowlers={awayBowlers}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : hasScores && teamScores ? (
                    // Scores WITHOUT schedule data -- group by team only
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Array.from(teamScores.entries()).map(([teamID, bowlers]) => (
                        <div key={teamID} className="border border-navy/5 rounded-lg p-3">
                          <TeamBoxScore
                            teamName={bowlers[0].teamName}
                            teamSlug={bowlers[0].teamSlug}
                            bowlers={bowlers}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Future week -- show schedule matchups
                    <div className="space-y-2">
                      {matchups.map((matchup, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm font-body text-navy/50">
                          <Link href={`/team/${matchup.homeTeamSlug}`} className="text-navy hover:text-red-600">
                            {matchup.homeTeamName}
                          </Link>
                          <span className="text-navy/30">vs</span>
                          <Link href={`/team/${matchup.awayTeamSlug}`} className="text-navy hover:text-red-600">
                            {matchup.awayTeamName}
                          </Link>
                        </div>
                      ))}
                      {matchups.length === 0 && (
                        <p className="text-sm text-navy/30 italic">Schedule not yet available.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
