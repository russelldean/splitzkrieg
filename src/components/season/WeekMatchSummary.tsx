import Link from 'next/link';
import type { WeeklyMatchScore, SeasonScheduleWeek, WeeklyMatchupResult } from '@/lib/queries';
import { organizeByWeek, indexMatchResults, findMatchMVP } from '@/lib/week-utils';

const GHOST_TEAM_NAME = 'Ghost Team';
const GHOST_TEAM_SLUG = 'ghost-team';

function TeamName({ name }: { name: string }) {
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
  /** Blog mode: 5+5 side-by-side columns, no Bowler of the Match */
  compact?: boolean;
}

export function WeekMatchSummary({ weekScores, schedule, matchResults, week, compact }: Props) {
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
    return { matchup, t1Pts, t2Pts, mvpBowler };
  });

  // Detect forfeits: teams where all bowlers are penalty rows, or no scores at all
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

  if (rows.every(r => r.t1Pts === null)) return null;

  const renderMatchCard = (
    { matchup, t1Pts, t2Pts, mvpBowler }: typeof rows[number],
    idx: number,
  ) => {
    const homeWon = t1Pts != null && t2Pts != null && t1Pts > t2Pts;
    const awayWon = t1Pts != null && t2Pts != null && t2Pts > t1Pts;
    const homeForfeit = forfeitTeamIDs.has(matchup.homeTeamID);
    const awayForfeit = forfeitTeamIDs.has(matchup.awayTeamID);
    return (
      <div key={idx} className="block bg-white border border-navy/10 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        <div className={`flex items-center justify-between font-body ${compact ? 'px-2 py-1.5 text-sm' : 'px-3 py-2'}`}>
          <div className={`flex-1 min-w-0 truncate ${homeWon ? 'font-semibold text-navy' : 'text-navy/70'}`}>
            {homeForfeit ? (
              <GhostTeamLink className={homeWon ? 'font-semibold text-navy' : 'text-navy/70'} />
            ) : (
              <Link href={`/team/${matchup.homeTeamSlug}`} className="hover:text-red-600 transition-colors">
                <TeamName name={matchup.homeTeamName} />
              </Link>
            )}
          </div>
          <div className={`tabular-nums text-center shrink-0 ${compact ? 'px-1' : 'px-3'}`}>
            <span className={homeWon ? 'font-semibold text-navy' : 'text-navy/70'}>{t1Pts ?? '-'}</span>
            <span className="text-navy/30 mx-1">-</span>
            <span className={awayWon ? 'font-semibold text-navy' : 'text-navy/70'}>{t2Pts ?? '-'}</span>
          </div>
          <div className={`flex-1 min-w-0 truncate text-right ${awayWon ? 'font-semibold text-navy' : 'text-navy/70'}`}>
            {awayForfeit ? (
              <GhostTeamLink className={awayWon ? 'font-semibold text-navy' : 'text-navy/70'} />
            ) : (
              <Link href={`/team/${matchup.awayTeamSlug}`} className="hover:text-red-600 transition-colors">
                <TeamName name={matchup.awayTeamName} />
              </Link>
            )}
          </div>
        </div>
        {!compact && mvpBowler && (
          <div className="px-3 py-1 border-t border-navy/5 bg-navy/[0.02] text-xs font-body text-amber-800">
            <span className="text-navy/50">Bowler of the Match</span>{' '}
            <Link href={`/bowler/${mvpBowler.bowlerSlug}`} className="hover:text-red-600 transition-colors">
              {mvpBowler.bowlerName}
              <span className="text-navy/65 ml-1">{mvpBowler.handSeries}</span>
            </Link>
          </div>
        )}
      </div>
    );
  };

  const forfeitNote = forfeitTeamNames.length > 0 && (
    <div className="px-3 py-2 bg-navy/[0.02] rounded-lg text-xs font-body text-navy/55">
      {'👻'} Forfeit -{' '}
      {forfeitTeamNames.map((name, i) => (
        <span key={i}>
          {i > 0 && ', '}
          <span className="text-navy/70 font-medium">{name}</span>
        </span>
      ))}
    </div>
  );

  if (compact) {
    const half = Math.ceil(rows.length / 2);
    const left = rows.slice(0, half);
    const right = rows.slice(half);
    return (
      <div className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          <div className="space-y-1.5">{left.map((r, i) => renderMatchCard(r, i))}</div>
          <div className="space-y-1.5">{right.map((r, i) => renderMatchCard(r, half + i))}</div>
        </div>
        {forfeitNote}
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-2">
      {rows.map((r, idx) => renderMatchCard(r, idx))}
      {forfeitNote}
    </div>
  );
}
