'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { WeeklyMatchScore, SeasonScheduleWeek, WeeklyMatchupResult } from '@/lib/queries';
import { organizeByWeek, indexMatchResults, findMatchMVP } from '@/lib/week-utils';
import { MatchupSummary } from './MatchupCards';
import { TeamBoxScore } from './TeamBoxScore';

const GHOST_TEAM_NAME = 'Ghost Team';
const GHOST_TEAM_SLUG = 'ghost-team';

function TeamNameLabel({ name }: { name: string }) {
  if (name === GHOST_TEAM_NAME) return <>{name} {'👻'}</>;
  return <>{name}</>;
}

function GhostTeamLink({ className }: { className?: string }) {
  return (
    <Link href={`/team/${GHOST_TEAM_SLUG}`} className={`hover:text-red-600 transition-colors ${className ?? 'text-navy/50'}`}>
      Ghost Team {'👻'}
    </Link>
  );
}

interface Props {
  weekScores: WeeklyMatchScore[];
  schedule: SeasonScheduleWeek[];
  matchResults: WeeklyMatchupResult[];
  week: number;
}

export function WeekMatchSummary({ weekScores, schedule, matchResults, week }: Props) {
  const weekData = organizeByWeek(weekScores);
  const mrIndex = indexMatchResults(matchResults);
  const matchups = schedule.filter(s => s.week === week);
  const teamScores = weekData.get(week);

  const rows = matchups.map((matchup) => {
    const mr = mrIndex.get(`${week}-${matchup.homeTeamID}-${matchup.awayTeamID}`);
    const homeBowlers = teamScores?.get(matchup.homeTeamID) ?? [];
    const awayBowlers = teamScores?.get(matchup.awayTeamID) ?? [];
    const mvpID = findMatchMVP(homeBowlers, awayBowlers);
    const mvpBowler = [...homeBowlers, ...awayBowlers].find(b => b.bowlerID === mvpID);
    const t1Pts = mr ? (mr.team1GamePts ?? 0) + (mr.team1BonusPts ?? 0) : null;
    const t2Pts = mr ? (mr.team2GamePts ?? 0) + (mr.team2BonusPts ?? 0) : null;
    return { matchup, mr, homeBowlers, awayBowlers, mvpID, t1Pts, t2Pts, mvpBowler };
  });

  // Detect forfeits
  const hasResults = rows.some(r => r.t1Pts !== null);
  const forfeitTeamIDs = new Set<number>();
  const forfeitTeamNames: string[] = [];
  if (hasResults) {
    for (const matchup of matchups) {
      const homeBowlers = teamScores?.get(matchup.homeTeamID) ?? [];
      const awayBowlers = teamScores?.get(matchup.awayTeamID) ?? [];
      const homeForfeit = matchup.homeTeamName !== GHOST_TEAM_NAME &&
        (homeBowlers.length === 0 || homeBowlers.every(b => b.isPenalty));
      const awayForfeit = matchup.awayTeamName !== GHOST_TEAM_NAME &&
        (awayBowlers.length === 0 || awayBowlers.every(b => b.isPenalty));
      if (homeForfeit) {
        forfeitTeamIDs.add(matchup.homeTeamID);
        forfeitTeamNames.push(matchup.homeTeamName);
      }
      if (awayForfeit) {
        forfeitTeamIDs.add(matchup.awayTeamID);
        forfeitTeamNames.push(matchup.awayTeamName);
      }
    }
  }

  // Expand/collapse state
  const [openMatches, setOpenMatches] = useState<Set<number>>(() => new Set());

  // Auto-open from URL hash (#match-0, #match-1, etc.)
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && hash.startsWith('match-')) {
      const idx = parseInt(hash.replace('match-', ''), 10);
      if (!isNaN(idx)) {
        setOpenMatches(new Set([idx]));
        requestAnimationFrame(() => {
          document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
        });
      }
    }
  }, []);

  // Listen for hash changes
  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.slice(1);
      if (!hash || !hash.startsWith('match-')) return;
      const idx = parseInt(hash.replace('match-', ''), 10);
      if (!isNaN(idx)) {
        setOpenMatches(prev => new Set(prev).add(idx));
        requestAnimationFrame(() => {
          document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
        });
      }
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  function toggleMatch(idx: number) {
    setOpenMatches(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  const allOpen = openMatches.size === rows.length;
  function toggleAll() {
    if (allOpen) {
      setOpenMatches(new Set());
    } else {
      setOpenMatches(new Set(rows.map((_, i) => i)));
    }
  }

  if (rows.every(r => r.t1Pts === null)) return null;

  return (
    <div className="mb-4">
      <div className="flex justify-end mb-2">
        <button
          onClick={toggleAll}
          className="text-sm font-body text-navy/65 hover:text-red-600 transition-colors px-1"
        >
          {allOpen ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((row, idx) => {
          const { matchup, mr, homeBowlers, awayBowlers, mvpID, t1Pts, t2Pts, mvpBowler } = row;
          const homeForfeit = forfeitTeamIDs.has(matchup.homeTeamID);
          const awayForfeit = forfeitTeamIDs.has(matchup.awayTeamID);
          const isOpen = openMatches.has(idx);

          // Put higher-pts team on the left
          const flip = t1Pts != null && t2Pts != null && t2Pts > t1Pts;
          const leftName = flip ? matchup.awayTeamName : matchup.homeTeamName;
          const leftSlug = flip ? matchup.awayTeamSlug : matchup.homeTeamSlug;
          const leftPts = flip ? t2Pts : t1Pts;
          const leftWon = leftPts != null && leftPts > (flip ? t1Pts! : t2Pts!);
          const leftForfeit = flip ? awayForfeit : homeForfeit;
          const rightName = flip ? matchup.homeTeamName : matchup.awayTeamName;
          const rightSlug = flip ? matchup.homeTeamSlug : matchup.awayTeamSlug;
          const rightPts = flip ? t1Pts : t2Pts;
          const rightWon = rightPts != null && rightPts > (flip ? t2Pts! : t1Pts!);
          const rightForfeit = flip ? homeForfeit : awayForfeit;

          // For expanded detail, always use original home/away order
          const homeTeamName = homeForfeit ? GHOST_TEAM_NAME : matchup.homeTeamName;
          const awayTeamName = awayForfeit ? GHOST_TEAM_NAME : matchup.awayTeamName;
          const homeTeamSlug = homeForfeit ? GHOST_TEAM_SLUG : matchup.homeTeamSlug;
          const awayTeamSlug = awayForfeit ? GHOST_TEAM_SLUG : matchup.awayTeamSlug;

          return (
            <div
              key={idx}
              id={`match-${idx}`}
              className={`bg-white border rounded-lg shadow-sm overflow-hidden transition-shadow scroll-mt-4 ${
                isOpen ? 'border-navy/20 shadow-md' : 'border-navy/10 hover:shadow-md'
              }`}
            >
              {/* Scoreboard header - always visible, clickable */}
              <button
                onClick={() => toggleMatch(idx)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between font-body px-3 py-2">
                  <div className={`flex-1 min-w-0 truncate ${leftWon ? 'font-semibold text-navy' : 'text-navy/70'}`}>
                    {leftForfeit ? (
                      <span className="text-navy/50">Ghost Team {'👻'}</span>
                    ) : (
                      <TeamNameLabel name={leftName} />
                    )}
                  </div>
                  <div className="tabular-nums text-center shrink-0 px-3">
                    <span className={leftWon ? 'font-semibold text-navy' : 'text-navy/70'}>{leftPts ?? '-'}</span>
                    <span className="text-navy/30 mx-1">-</span>
                    <span className={rightWon ? 'font-semibold text-navy' : 'text-navy/70'}>{rightPts ?? '-'}</span>
                  </div>
                  <div className={`flex-1 min-w-0 truncate text-right ${rightWon ? 'font-semibold text-navy' : 'text-navy/70'}`}>
                    {rightForfeit ? (
                      <span className="text-navy/50">Ghost Team {'👻'}</span>
                    ) : (
                      <TeamNameLabel name={rightName} />
                    )}
                  </div>
                  <span className="text-navy/40 text-xs ml-2 shrink-0">
                    {isOpen ? '\u25B2' : '\u25BC'}
                  </span>
                </div>
                {!isOpen && mvpBowler && (
                  <div className="px-3 py-1 border-t border-navy/5 bg-navy/[0.02] text-xs font-body text-amber-800">
                    <span className="text-navy/50">Bowler of the Match</span>{' '}
                    {mvpBowler.bowlerName}
                    <span className="text-navy/65 ml-1">{mvpBowler.handSeries}</span>
                  </div>
                )}
              </button>

              {/* Expanded details */}
              {isOpen && (
                <div className="border-t border-navy/10 p-3">
                  {mr && (
                    <MatchupSummary
                      mr={mr}
                      homeTeamName={homeTeamName}
                      awayTeamName={awayTeamName}
                      homeTeamSlug={homeTeamSlug}
                      awayTeamSlug={awayTeamSlug}
                    />
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
              )}
            </div>
          );
        })}
      </div>

      {forfeitTeamNames.length > 0 && (
        <div className="mt-2 px-3 py-2 bg-navy/[0.02] rounded-lg text-xs font-body text-navy/55">
          {'👻'} Forfeit -{' '}
          {forfeitTeamNames.map((name, i) => (
            <span key={i}>
              {i > 0 && ', '}
              <span className="text-navy/70 font-medium">{name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
