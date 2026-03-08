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
    return { matchup, t1Pts, t2Pts, mvpBowler };
  });

  // Detect forfeits: scheduled non-ghost teams with no bowler scores in a week that has results
  const hasResults = rows.some(r => r.t1Pts !== null);
  const forfeitTeamIDs = new Set<number>();
  const forfeitTeamNames: string[] = [];
  if (hasResults) {
    for (const matchup of matchups) {
      if (matchup.homeTeamName !== GHOST_TEAM_NAME && (teamScores?.get(matchup.homeTeamID) ?? []).length === 0) {
        forfeitTeamIDs.add(matchup.homeTeamID);
        forfeitTeamNames.push(matchup.homeTeamName);
      }
      if (matchup.awayTeamName !== GHOST_TEAM_NAME && (teamScores?.get(matchup.awayTeamID) ?? []).length === 0) {
        forfeitTeamIDs.add(matchup.awayTeamID);
        forfeitTeamNames.push(matchup.awayTeamName);
      }
    }
  }

  if (rows.every(r => r.t1Pts === null)) return null;

  return (
    <div className="mb-4 space-y-2">
      {rows.map(({ matchup, t1Pts, t2Pts, mvpBowler }, idx) => {
        const homeWon = t1Pts != null && t2Pts != null && t1Pts > t2Pts;
        const awayWon = t1Pts != null && t2Pts != null && t2Pts > t1Pts;
        const homeForfeit = forfeitTeamIDs.has(matchup.homeTeamID);
        const awayForfeit = forfeitTeamIDs.has(matchup.awayTeamID);
        return (
          <a key={idx} href={`#match-${idx}`} className="block bg-white border border-navy/10 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between px-3 py-2 font-body">
              <div className={`flex-1 min-w-0 ${homeWon ? 'font-semibold text-navy' : 'text-navy/70'}`}>
                {homeForfeit ? (
                  <GhostTeamLink className={homeWon ? 'font-semibold text-navy' : 'text-navy/70'} />
                ) : (
                  <Link href={`/team/${matchup.homeTeamSlug}`} className="hover:text-red-600 transition-colors">
                    <TeamName name={matchup.homeTeamName} />
                  </Link>
                )}
              </div>
              <div className="tabular-nums text-center px-3 shrink-0">
                <span className={homeWon ? 'font-semibold text-navy' : 'text-navy/70'}>{t1Pts ?? '-'}</span>
                <span className="text-navy/30 mx-1.5">–</span>
                <span className={awayWon ? 'font-semibold text-navy' : 'text-navy/70'}>{t2Pts ?? '-'}</span>
              </div>
              <div className={`flex-1 min-w-0 text-right ${awayWon ? 'font-semibold text-navy' : 'text-navy/70'}`}>
                {awayForfeit ? (
                  <GhostTeamLink className={awayWon ? 'font-semibold text-navy' : 'text-navy/70'} />
                ) : (
                  <Link href={`/team/${matchup.awayTeamSlug}`} className="hover:text-red-600 transition-colors">
                    <TeamName name={matchup.awayTeamName} />
                  </Link>
                )}
              </div>
            </div>
            {mvpBowler && (
              <div className="px-3 py-1 border-t border-navy/5 bg-navy/[0.02] text-xs font-body text-amber-800">
                <span className="text-navy/50">Bowler of the Match</span>{' '}
                <Link href={`/bowler/${mvpBowler.bowlerSlug}`} className="hover:text-red-600 transition-colors">
                  {mvpBowler.bowlerName}
                  <span className="text-navy/65 ml-1">{mvpBowler.handSeries}</span>
                </Link>
              </div>
            )}
          </a>
        );
      })}
      {forfeitTeamNames.length > 0 && (
        <div className="px-3 py-2 bg-navy/[0.02] rounded-lg text-xs font-body text-navy/55">
          {'👻'} Forfeit &mdash;{' '}
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
