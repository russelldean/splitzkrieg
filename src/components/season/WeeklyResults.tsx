'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { WeeklyMatchScore, SeasonScheduleWeek, WeeklyMatchupResult } from '@/lib/queries';
import { organizeByWeek, indexMatchResults, getMatchups, findMatchMVP } from '@/lib/week-utils';

/** Color class for a game score relative to the bowler's incoming average. */
function avgColorClass(score: number | null, avg: number | null): string {
  if (score === null || avg === null) return '';
  return score >= avg ? 'text-green-600' : 'text-red-600/70';
}

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

/** Sum a team's game scores for a given game number. */
function teamGameTotal(bowlers: WeeklyMatchScore[], gameKey: 'game1' | 'game2' | 'game3'): number {
  return bowlers.reduce((sum, b) => sum + (b[gameKey] ?? 0), 0);
}

function teamSeriesTotal(bowlers: WeeklyMatchScore[]): number {
  return bowlers.reduce((sum, b) => sum + (b.scratchSeries ?? 0), 0);
}

function teamHcpSeriesTotal(bowlers: WeeklyMatchScore[]): number {
  return bowlers.reduce((sum, b) => sum + (b.handSeries ?? 0), 0);
}

function teamTurkeyTotal(bowlers: WeeklyMatchScore[]): number {
  return bowlers.reduce((sum, b) => sum + (b.turkeys ?? 0), 0);
}


/** Weekly scoreboard: one row per matchup with total pts + bowler of the match. */
function WeeklySummaryTable({
  matchups,
  mrIndex,
  weekData,
  week,
}: {
  matchups: SeasonScheduleWeek[];
  mrIndex: Map<string, WeeklyMatchupResult>;
  weekData: Map<number, Map<number, WeeklyMatchScore[]>>;
  week: number;
}) {
  const teamScores = weekData.get(week);
  const rows = matchups.map((matchup) => {
    const mr = mrIndex.get(`${week}-${matchup.homeTeamID}-${matchup.awayTeamID}`);
    const homeBowlers = teamScores?.get(matchup.homeTeamID) ?? [];
    const awayBowlers = teamScores?.get(matchup.awayTeamID) ?? [];
    const mvpID = findMatchMVP(homeBowlers, awayBowlers);
    const mvpBowler = [...homeBowlers, ...awayBowlers].find(b => b.bowlerID === mvpID);
    const t1Pts = mr ? (mr.team1GamePts ?? 0) + (mr.team1BonusPts ?? 0) : null;
    const t2Pts = mr ? (mr.team2GamePts ?? 0) + (mr.team2BonusPts ?? 0) : null;
    return { matchup, t1Pts, t2Pts, mvpBowler };
  });

  if (rows.every(r => r.t1Pts === null)) return null;

  return (
    <div className="mb-4 overflow-x-auto">
      <table className="w-full text-sm font-body">
        <thead>
          <tr className="border-b border-navy/10 text-navy/50 text-xs">
            <th className="text-left font-normal py-1.5 pl-2">Home</th>
            <th className="text-center font-normal py-1.5 w-[100px]">Score</th>
            <th className="text-right font-normal py-1.5">Away</th>
            <th className="text-left font-normal py-1.5 pl-4">Bowler of the Match</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ matchup, t1Pts, t2Pts, mvpBowler }, idx) => {
            const homeWon = t1Pts != null && t2Pts != null && t1Pts > t2Pts;
            const awayWon = t1Pts != null && t2Pts != null && t2Pts > t1Pts;
            return (
              <tr key={idx} className="border-b border-navy/5">
                <td className={`py-1.5 pl-2 ${homeWon ? 'font-semibold text-navy' : 'text-navy/70'}`}>
                  <Link href={`/team/${matchup.homeTeamSlug}`} className="hover:text-red-600 transition-colors">
                    {matchup.homeTeamName}
                  </Link>
                </td>
                <td className="text-center tabular-nums py-1.5">
                  <span className={homeWon ? 'font-semibold text-navy' : 'text-navy/70'}>{t1Pts ?? '-'}</span>
                  <span className="text-navy/30 mx-1">–</span>
                  <span className={awayWon ? 'font-semibold text-navy' : 'text-navy/70'}>{t2Pts ?? '-'}</span>
                </td>
                <td className={`text-right py-1.5 ${awayWon ? 'font-semibold text-navy' : 'text-navy/70'}`}>
                  <Link href={`/team/${matchup.awayTeamSlug}`} className="hover:text-red-600 transition-colors">
                    {matchup.awayTeamName}
                  </Link>
                </td>
                <td className="pl-4 py-1.5 text-amber-800">
                  {mvpBowler ? (
                    <Link href={`/bowler/${mvpBowler.bowlerSlug}`} className="hover:text-red-600 transition-colors">
                      {mvpBowler.bowlerName}
                      <span className="text-navy/50 ml-1 text-xs">{mvpBowler.handSeries}</span>
                    </Link>
                  ) : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Matchup summary bar showing team hcp totals, wins, XP, total pts. */
function MatchupSummary({
  mr,
  homeTeamName,
  awayTeamName,
  homeTeamSlug,
  awayTeamSlug,
}: {
  mr: WeeklyMatchupResult;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamSlug: string;
  awayTeamSlug: string;
}) {
  const t1Total = (mr.team1GamePts ?? 0) + (mr.team1BonusPts ?? 0);
  const t2Total = (mr.team2GamePts ?? 0) + (mr.team2BonusPts ?? 0);

  return (
    <div className="bg-navy/[0.03] rounded-lg px-3 py-2 mb-3">
      <table className="w-full text-xs font-body">
        <thead>
          <tr className="text-navy/50">
            <th className="text-left font-normal py-0.5 w-[30%]"></th>
            <th className="text-right font-normal py-0.5 pl-2 border-l border-navy/10">G1</th>
            <th className="text-right font-normal py-0.5 pl-2 border-l border-navy/10">G2</th>
            <th className="text-right font-normal py-0.5 pl-2 border-l border-navy/10">G3</th>
            <th className="text-right font-normal py-0.5">Hcp Series</th>
            <th className="text-right font-normal py-0.5">Wins</th>
            <th className="text-right font-normal py-0.5">XP</th>
            <th className="text-right font-normal py-0.5 font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-navy">
            <td className="py-0.5">
              <Link href={`/team/${homeTeamSlug}`} className="hover:text-red-600 transition-colors">
                {homeTeamName}
              </Link>
            </td>
            <td className={`text-right tabular-nums py-0.5 pl-2 border-l border-navy/10 ${gameWinClass(mr.team1Game1, mr.team2Game1)}`}>{mr.team1Game1 ?? '-'}</td>
            <td className={`text-right tabular-nums py-0.5 pl-2 border-l border-navy/10 ${gameWinClass(mr.team1Game2, mr.team2Game2)}`}>{mr.team1Game2 ?? '-'}</td>
            <td className={`text-right tabular-nums py-0.5 pl-2 border-l border-navy/10 ${gameWinClass(mr.team1Game3, mr.team2Game3)}`}>{mr.team1Game3 ?? '-'}</td>
            <td className="text-right tabular-nums py-0.5">{mr.team1Series ?? '-'}</td>
            <td className="text-right tabular-nums py-0.5">{mr.team1GamePts != null ? mr.team1GamePts / 2 : '-'}</td>
            <td className="text-right tabular-nums py-0.5">{mr.team1BonusPts ?? '-'}</td>
            <td className="text-right tabular-nums py-0.5 font-bold">
              {t1Total === 9 ? '\u2B50 ' : ''}{t1Total}
            </td>
          </tr>
          <tr className="text-navy">
            <td className="py-0.5">
              <Link href={`/team/${awayTeamSlug}`} className="hover:text-red-600 transition-colors">
                {awayTeamName}
              </Link>
            </td>
            <td className={`text-right tabular-nums py-0.5 pl-2 border-l border-navy/10 ${gameWinClass(mr.team2Game1, mr.team1Game1)}`}>{mr.team2Game1 ?? '-'}</td>
            <td className={`text-right tabular-nums py-0.5 pl-2 border-l border-navy/10 ${gameWinClass(mr.team2Game2, mr.team1Game2)}`}>{mr.team2Game2 ?? '-'}</td>
            <td className={`text-right tabular-nums py-0.5 pl-2 border-l border-navy/10 ${gameWinClass(mr.team2Game3, mr.team1Game3)}`}>{mr.team2Game3 ?? '-'}</td>
            <td className="text-right tabular-nums py-0.5">{mr.team2Series ?? '-'}</td>
            <td className="text-right tabular-nums py-0.5">{mr.team2GamePts != null ? mr.team2GamePts / 2 : '-'}</td>
            <td className="text-right tabular-nums py-0.5">{mr.team2BonusPts ?? '-'}</td>
            <td className="text-right tabular-nums py-0.5 font-bold">
              {t2Total === 9 ? '\u2B50 ' : ''}{t2Total}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Color class for game-by-game win/loss in matchup summary. */
function gameWinClass(myScore: number | null, oppScore: number | null): string {
  if (myScore == null || oppScore == null) return '';
  if (myScore > oppScore) return 'text-green-600 font-semibold';
  if (myScore < oppScore) return 'text-navy/50';
  return 'text-amber-600'; // tie
}

function TeamBoxScore({
  teamName,
  teamSlug,
  bowlers,
  mvpBowlerID,
}: {
  teamName: string;
  teamSlug: string;
  bowlers: WeeklyMatchScore[];
  mvpBowlerID?: number | null;
}) {
  const g1Total = teamGameTotal(bowlers, 'game1');
  const g2Total = teamGameTotal(bowlers, 'game2');
  const g3Total = teamGameTotal(bowlers, 'game3');
  const seriesTot = teamSeriesTotal(bowlers);
  const hcpSeriesTot = teamHcpSeriesTotal(bowlers);
  const turkeysTot = teamTurkeyTotal(bowlers);

  return (
    <div>
      <Link
        href={`/team/${teamSlug}`}
        className="font-heading text-sm text-navy hover:text-red-600 transition-colors"
      >
        {teamName}
      </Link>
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-body mt-1">
          <thead>
            <tr className="border-b border-navy/10">
              <th className="text-left px-2 py-1 text-navy/50 font-normal text-xs">Bowler</th>
              <th className="text-right px-1 py-1 text-navy/50 font-normal text-xs">Avg</th>
              <th className="text-right pl-2 pr-1 py-1 text-navy/50 font-normal text-xs border-l border-navy/10">G1</th>
              <th className="text-right pl-2 pr-1 py-1 text-navy/50 font-normal text-xs border-l border-navy/10">G2</th>
              <th className="text-right pl-2 pr-1 py-1 text-navy/50 font-normal text-xs border-l border-navy/10">G3</th>
              <th className="text-right px-1 py-1 text-navy/50 font-normal text-xs">Series</th>
              <th className="text-right px-1 py-1 text-navy/50 font-normal text-xs">Hcp</th>
              <th className="text-right px-1 py-1 text-navy/50 font-normal text-xs">T</th>
            </tr>
          </thead>
          <tbody>
            {bowlers.map((b) => {
              const isDebut = b.incomingAvg === null;
              const isMVP = mvpBowlerID != null && b.bowlerID === mvpBowlerID;
              return (
                <tr key={b.bowlerID} className={`border-b border-navy/5 ${isMVP ? 'bg-amber-100/40' : ''}`}>
                  <td className="px-2 py-1">
                    <Link
                      href={`/bowler/${b.bowlerSlug}`}
                      className={`underline-offset-2 hover:underline text-xs sm:text-sm ${isMVP ? 'text-amber-800 font-semibold hover:text-red-600' : 'text-navy hover:text-red-600'}`}
                    >
                      {b.bowlerName}
                    </Link>
                    {isDebut && (
                      <span className="ml-1.5 text-[10px] font-heading text-red-600/70 bg-red-600/10 px-1 py-0.5 rounded uppercase tracking-wider">
                        Debut
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums text-xs sm:text-sm text-navy/50">
                    {b.incomingAvg ?? '-'}
                  </td>
                  <td className={`pl-2 pr-1 py-1 text-right tabular-nums text-xs sm:text-sm border-l border-navy/10 ${avgColorClass(b.game1, b.incomingAvg)}`}>
                    {b.game1 ?? '-'}
                  </td>
                  <td className={`pl-2 pr-1 py-1 text-right tabular-nums text-xs sm:text-sm border-l border-navy/10 ${avgColorClass(b.game2, b.incomingAvg)}`}>
                    {b.game2 ?? '-'}
                  </td>
                  <td className={`pl-2 pr-1 py-1 text-right tabular-nums text-xs sm:text-sm border-l border-navy/10 ${avgColorClass(b.game3, b.incomingAvg)}`}>
                    {b.game3 ?? '-'}
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums font-semibold text-xs sm:text-sm">
                    {b.scratchSeries ?? '-'}
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums text-xs sm:text-sm text-navy/60">
                    {b.handSeries ?? '-'}
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums text-xs sm:text-sm text-navy/50">
                    {b.turkeys > 0 ? b.turkeys : ''}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-navy/[0.03]">
              <td className="px-2 py-1 text-xs font-heading text-navy/60">Team Total</td>
              <td className="px-1 py-1"></td>
              <td className="pl-2 pr-1 py-1 text-right tabular-nums font-semibold text-xs border-l border-navy/10">{g1Total}</td>
              <td className="pl-2 pr-1 py-1 text-right tabular-nums font-semibold text-xs border-l border-navy/10">{g2Total}</td>
              <td className="pl-2 pr-1 py-1 text-right tabular-nums font-semibold text-xs border-l border-navy/10">{g3Total}</td>
              <td className="px-1 py-1 text-right tabular-nums font-bold text-xs">{seriesTot}</td>
              <td className="px-1 py-1 text-right tabular-nums font-bold text-xs">{hcpSeriesTot}</td>
              <td className="px-1 py-1 text-right tabular-nums font-semibold text-xs text-navy/50">
                {turkeysTot > 0 ? turkeysTot : ''}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
              const mvpID = findMatchMVP(homeBowlers, awayBowlers);
              const mr = mrIndex.get(`${week}-${matchup.homeTeamID}-${matchup.awayTeamID}`);
              return (
                <div key={`${week}-${idx}`} id={`match-${idx}`} className="border border-navy/5 rounded-lg p-3 scroll-mt-4">
                  {mr ? (
                    <MatchupSummary
                      mr={mr}
                      homeTeamName={matchup.homeTeamName}
                      awayTeamName={matchup.awayTeamName}
                      homeTeamSlug={matchup.homeTeamSlug}
                      awayTeamSlug={matchup.awayTeamSlug}
                    />
                  ) : (
                    <div className="flex items-center gap-2 mb-2 text-sm font-heading text-navy/60">
                      <Link href={`/team/${matchup.homeTeamSlug}`} className="hover:text-red-600">
                        {matchup.homeTeamName}
                      </Link>
                      <span className="text-navy/30">vs</span>
                      <Link href={`/team/${matchup.awayTeamSlug}`} className="hover:text-red-600">
                        {matchup.awayTeamName}
                      </Link>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-3">
                    {homeBowlers.length > 0 && (
                      <TeamBoxScore teamName={matchup.homeTeamName} teamSlug={matchup.homeTeamSlug} bowlers={homeBowlers} mvpBowlerID={mvpID} />
                    )}
                    {awayBowlers.length > 0 && (
                      <TeamBoxScore teamName={matchup.awayTeamName} teamSlug={matchup.awayTeamSlug} bowlers={awayBowlers} mvpBowlerID={mvpID} />
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
                    <span className="text-navy/50 font-body text-sm ml-2">{dateStr}</span>
                  )}
                  {!hasScores && (
                    <span className="text-navy/40 font-body text-sm ml-2 italic">Upcoming</span>
                  )}
                </span>
                <span className="text-navy/50 text-sm">
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
                      const mvpID = findMatchMVP(homeBowlers, awayBowlers);
                      const mr = mrIndex.get(`${week}-${matchup.homeTeamID}-${matchup.awayTeamID}`);
                      return (
                        <div key={idx} className="border border-navy/5 rounded-lg p-3">
                          {mr ? (
                            <MatchupSummary
                              mr={mr}
                              homeTeamName={matchup.homeTeamName}
                              awayTeamName={matchup.awayTeamName}
                              homeTeamSlug={matchup.homeTeamSlug}
                              awayTeamSlug={matchup.awayTeamSlug}
                            />
                          ) : (
                            <div className="flex items-center gap-2 mb-2 text-sm font-heading text-navy/60">
                              <Link href={`/team/${matchup.homeTeamSlug}`} className="hover:text-red-600">
                                {matchup.homeTeamName}
                              </Link>
                              <span className="text-navy/30">vs</span>
                              <Link href={`/team/${matchup.awayTeamSlug}`} className="hover:text-red-600">
                                {matchup.awayTeamName}
                              </Link>
                            </div>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {homeBowlers.length > 0 && (
                              <TeamBoxScore
                                teamName={matchup.homeTeamName}
                                teamSlug={matchup.homeTeamSlug}
                                bowlers={homeBowlers}
                                mvpBowlerID={mvpID}
                              />
                            )}
                            {awayBowlers.length > 0 && (
                              <TeamBoxScore
                                teamName={matchup.awayTeamName}
                                teamSlug={matchup.awayTeamSlug}
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
                        <p className="text-sm text-navy/40 italic">Schedule not yet available.</p>
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
