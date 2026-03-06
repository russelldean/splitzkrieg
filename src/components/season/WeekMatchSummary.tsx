import Link from 'next/link';
import type { WeeklyMatchScore, SeasonScheduleWeek, WeeklyMatchupResult } from '@/lib/queries';
import { organizeByWeek, indexMatchResults, findMatchMVP } from '@/lib/week-utils';

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

  if (rows.every(r => r.t1Pts === null)) return null;

  return (
    <div className="mb-4 overflow-x-auto">
      <table className="w-full text-sm font-body">
        <thead>
          <tr className="border-b border-navy/10 text-navy/40 text-xs">
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
                  <span className={homeWon ? 'font-semibold text-navy' : 'text-navy/70'}>{t1Pts ?? '—'}</span>
                  <span className="text-navy/30 mx-1">–</span>
                  <span className={awayWon ? 'font-semibold text-navy' : 'text-navy/70'}>{t2Pts ?? '—'}</span>
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
                      <span className="text-navy/40 ml-1 text-xs">{mvpBowler.handSeries}</span>
                    </Link>
                  ) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
