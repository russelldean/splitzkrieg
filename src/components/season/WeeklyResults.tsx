'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { WeeklyMatchScore, SeasonScheduleWeek, WeeklyMatchupResult } from '@/lib/queries';
import { organizeByWeek, indexMatchResults, getMatchups, findMatchMVP } from '@/lib/week-utils';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { formatMatchDate } from '@/lib/bowling-time';
import { TeamName } from './TeamBoxScore';
import { TeamBoxScore } from './TeamBoxScore';
import { MatchupSummary, WeeklySummaryTable } from './MatchupCards';

interface Props {
  weeklyScores: WeeklyMatchScore[];
  schedule: SeasonScheduleWeek[];
  matchResults: WeeklyMatchupResult[];
  totalWeeks: number;
  /** When true, skip outer heading/accordion and summary table (for embedding in a collapsible wrapper). */
  detailOnly?: boolean;
}

/** Get the date for a given week from scores or schedule. */
function getWeekDate(
  scores: WeeklyMatchScore[],
  schedule: SeasonScheduleWeek[],
  week: number
): string | null {
  const scoreDate = scores.find(s => s.week === week)?.matchDate;
  if (scoreDate) return scoreDate;
  const schedDate = schedule.find(s => s.week === week)?.matchDate;
  return schedDate ?? null;
}

/** Detect forfeit: all bowlers for a team are penalty rows. */
function isForfeitTeam(bowlers: WeeklyMatchScore[]): boolean {
  return bowlers.length > 0 && bowlers.every(b => b.isPenalty);
}

const GHOST_TEAM_NAME = 'Ghost Team';
const GHOST_TEAM_SLUG = 'ghost-team';

export function WeeklyResults({ weeklyScores, schedule, matchResults, totalWeeks, detailOnly }: Props) {
  const weekData = useMemo(() => organizeByWeek(weeklyScores), [weeklyScores]);
  const mrIndex = useMemo(() => indexMatchResults(matchResults), [matchResults]);

  // All week numbers that have either scores or schedule
  const allWeeks = useMemo(() => {
    const weeks = new Set<number>();
    weeklyScores.forEach(s => weeks.add(s.week));
    schedule.forEach(s => weeks.add(s.week));
    for (let w = 1; w <= totalWeeks; w++) weeks.add(w);
    return Array.from(weeks).sort((a, b) => a - b);
  }, [weeklyScores, schedule, totalWeeks]);

  // Weeks that have scores
  const weeksWithScores = useMemo(
    () => new Set(weeklyScores.map(s => s.week)),
    [weeklyScores]
  );

  const [openWeeks, setOpenWeeks] = useState<Set<number>>(() => {
    // Single-week view (totalWeeks === 0): start fully expanded
    if (totalWeeks === 0) return new Set(allWeeks);
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

  // --- Detail-only mode: just render box scores for each week, no chrome ---
  if (detailOnly) {
    return (
      <div className="space-y-6">
        {allWeeks.map(week => {
          const hasScores = weeksWithScores.has(week);
          const matchups = getMatchups(schedule, week);
          const teamScores = weekData.get(week);
          if (!hasScores) return null;

          if (matchups.length > 0) {
            return matchups.map((matchup, idx) => {
              const homeBowlers = teamScores?.get(matchup.homeTeamID) ?? [];
              const awayBowlers = teamScores?.get(matchup.awayTeamID) ?? [];
              const homeForfeit = isForfeitTeam(homeBowlers);
              const awayForfeit = isForfeitTeam(awayBowlers);
              const homeTeamName = homeForfeit ? GHOST_TEAM_NAME : matchup.homeTeamName;
              const awayTeamName = awayForfeit ? GHOST_TEAM_NAME : matchup.awayTeamName;
              const homeTeamSlug = homeForfeit ? GHOST_TEAM_SLUG : matchup.homeTeamSlug;
              const awayTeamSlug = awayForfeit ? GHOST_TEAM_SLUG : matchup.awayTeamSlug;
              const mvpID = findMatchMVP(homeBowlers, awayBowlers);
              const mr = mrIndex.get(`${week}-${matchup.homeTeamID}-${matchup.awayTeamID}`);
              return (
                <div key={`${week}-${idx}`} id={`match-${idx}`} className="border border-navy/5 rounded-lg p-3 scroll-mt-4">
                  {mr ? (
                    <MatchupSummary
                      mr={mr}
                      homeTeamName={homeTeamName}
                      awayTeamName={awayTeamName}
                      homeTeamSlug={homeTeamSlug}
                      awayTeamSlug={awayTeamSlug}
                    />
                  ) : (
                    <div className="flex items-center gap-2 mb-2 text-sm font-heading text-navy/60">
                      <Link href={`/team/${homeTeamSlug}`} className="hover:text-red-600">
                        {homeTeamName}
                      </Link>
                      <span className="text-navy/30">vs</span>
                      <Link href={`/team/${awayTeamSlug}`} className="hover:text-red-600">
                        {awayTeamName}
                      </Link>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-3">
                    {homeBowlers.length > 0 && (
                      <TeamBoxScore teamName={homeTeamName} teamSlug={homeTeamSlug} bowlers={homeBowlers} mvpBowlerID={mvpID} />
                    )}
                    {awayBowlers.length > 0 && (
                      <TeamBoxScore teamName={awayTeamName} teamSlug={awayTeamSlug} bowlers={awayBowlers} mvpBowlerID={mvpID} />
                    )}
                  </div>
                </div>
              );
            });
          } else if (teamScores) {
            return (
              <div key={week} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from(teamScores.entries()).map(([teamID, bowlers]) => (
                  <div key={teamID} className="border border-navy/5 rounded-lg p-3">
                    <TeamBoxScore teamName={bowlers[0].teamName} teamSlug={bowlers[0].teamSlug} bowlers={bowlers} />
                  </div>
                ))}
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  }

  // --- Full mode: heading, accordion, summary tables ---
  return (
    <section id="weekly">
      <div className="flex items-center justify-between mb-2">
        <div>
          <SectionHeading className="mb-0">Weekly Results</SectionHeading>
          <p className="font-body text-sm text-navy/65">
            Match-by-match scores for every bowling night.
          </p>
        </div>
        <button
          onClick={toggleAll}
          className="text-sm font-body text-navy/65 hover:text-red-600 transition-colors px-3 py-2 -mr-3"
        >
          {allOpen ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      <div className="space-y-1">
        {allWeeks.map(week => {
          const hasScores = weeksWithScores.has(week);
          const matchups = getMatchups(schedule, week);
          const date = getWeekDate(weeklyScores, schedule, week);
          const dateStr = formatMatchDate(date);
          const teamScores = weekData.get(week);
          const matchCount = matchups.length || (teamScores ? Math.ceil(teamScores.size / 2) : 0);

          return (
            <div key={week} className="border border-navy/10 rounded-lg shadow-sm overflow-hidden">
              <button
                onClick={() => toggleWeek(week)}
                className="w-full flex justify-between items-center px-4 py-3 bg-navy/[0.02] hover:bg-navy/[0.05] transition-colors"
              >
                <span className="font-heading text-lg text-navy">
                  Week {week}
                  {dateStr && (
                    <span className="text-navy/65 font-body text-sm ml-2">{dateStr}</span>
                  )}
                  {!hasScores && !dateStr && (
                    <span className="text-navy/60 font-body text-sm ml-2 italic">Upcoming</span>
                  )}
                </span>
                <span className="text-navy/65 text-sm">
                  {hasScores ? `${matchCount} matches` : `${matchups.length} matchups`}{' '}
                  {openWeeks.has(week) ? '\u25B2' : '\u25BC'}
                </span>
              </button>

              {openWeeks.has(week) && (
                <div className="px-4 py-3 space-y-4">
                  {hasScores && matchups.length > 0 && (
                    <WeeklySummaryTable
                      matchups={matchups}
                      mrIndex={mrIndex}
                      weekData={weekData}
                      week={week}
                    />
                  )}
                  {hasScores && matchups.length > 0 ? (
                    // Scores WITH schedule matchups -- show as "Home vs Away"
                    matchups.map((matchup, idx) => {
                      const homeBowlers = teamScores?.get(matchup.homeTeamID) ?? [];
                      const awayBowlers = teamScores?.get(matchup.awayTeamID) ?? [];
                      const homeForfeit = isForfeitTeam(homeBowlers);
                      const awayForfeit = isForfeitTeam(awayBowlers);
                      const homeTeamName = homeForfeit ? GHOST_TEAM_NAME : matchup.homeTeamName;
                      const awayTeamName = awayForfeit ? GHOST_TEAM_NAME : matchup.awayTeamName;
                      const homeTeamSlug = homeForfeit ? GHOST_TEAM_SLUG : matchup.homeTeamSlug;
                      const awayTeamSlug = awayForfeit ? GHOST_TEAM_SLUG : matchup.awayTeamSlug;
                      const mvpID = findMatchMVP(homeBowlers, awayBowlers);
                      const mr = mrIndex.get(`${week}-${matchup.homeTeamID}-${matchup.awayTeamID}`);
                      return (
                        <div key={idx} className="border border-navy/5 rounded-lg p-3">
                          {mr ? (
                            <MatchupSummary
                              mr={mr}
                              homeTeamName={homeTeamName}
                              awayTeamName={awayTeamName}
                              homeTeamSlug={homeTeamSlug}
                              awayTeamSlug={awayTeamSlug}
                            />
                          ) : (
                            <div className="flex items-center gap-2 mb-2 text-sm font-heading text-navy/60">
                              <Link href={`/team/${homeTeamSlug}`} className="hover:text-red-600">
                                <TeamName name={homeTeamName} />
                              </Link>
                              <span className="text-navy/30">vs</span>
                              <Link href={`/team/${awayTeamSlug}`} className="hover:text-red-600">
                                <TeamName name={awayTeamName} />
                              </Link>
                            </div>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {homeBowlers.length > 0 && (
                              <TeamBoxScore
                                teamName={homeTeamName}
                                teamSlug={homeTeamSlug}
                                bowlers={homeBowlers}
                                mvpBowlerID={mvpID}
                              />
                            )}
                            {awayBowlers.length > 0 && (
                              <TeamBoxScore
                                teamName={awayTeamName}
                                teamSlug={awayTeamSlug}
                                bowlers={awayBowlers}
                                mvpBowlerID={mvpID}
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
                        <div key={idx} className="flex items-center gap-2 text-sm font-body text-navy/65">
                          <Link href={`/team/${matchup.homeTeamSlug}`} className="text-navy hover:text-red-600">
                            <TeamName name={matchup.homeTeamName} />
                          </Link>
                          <span className="text-navy/30">vs</span>
                          <Link href={`/team/${matchup.awayTeamSlug}`} className="text-navy hover:text-red-600">
                            <TeamName name={matchup.awayTeamName} />
                          </Link>
                        </div>
                      ))}
                      {matchups.length === 0 && (
                        <p className="text-sm text-navy/60 italic">Schedule not yet available.</p>
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
