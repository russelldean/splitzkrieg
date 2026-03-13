'use client';
import Link from 'next/link';
import type { WeeklyMatchScore, SeasonScheduleWeek, WeeklyMatchupResult } from '@/lib/queries';
import { findMatchMVP } from '@/lib/week-utils';
import { TeamName } from './TeamBoxScore';

/** Color class for game-by-game win/loss in matchup summary. */
function gameWinClass(myScore: number | null, oppScore: number | null): string {
  if (myScore == null || oppScore == null) return '';
  if (myScore > oppScore) return 'text-green-600 font-semibold';
  if (myScore < oppScore) return 'text-navy/65';
  return 'text-amber-600'; // tie
}

/** Matchup summary bar showing team hcp totals, wins, XP, total pts. */
export function MatchupSummary({
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
          <tr className="text-navy/65">
            <th className="text-left font-normal py-0.5 w-[30%]"></th>
            <th className="text-right font-normal py-0.5 pl-3 pr-2 border-l border-navy/10">G1</th>
            <th className="text-right font-normal py-0.5 pl-3 pr-2 border-l border-navy/10">G2</th>
            <th className="text-right font-normal py-0.5 pl-3 pr-2 border-l border-navy/10">G3</th>
            <th className="text-center font-normal py-0.5">W</th>
            <th className="text-center font-normal py-0.5">XP</th>
            <th className="text-center font-normal py-0.5 font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-navy">
            <td className="py-0.5">
              <Link href={`/team/${homeTeamSlug}`} className="hover:text-red-600 transition-colors">
                <TeamName name={homeTeamName} />
              </Link>
            </td>
            <td className={`text-right tabular-nums py-0.5 pl-3 pr-2 border-l border-navy/10 ${gameWinClass(mr.team1Game1, mr.team2Game1)}`}>{mr.team1Game1 ?? '-'}</td>
            <td className={`text-right tabular-nums py-0.5 pl-3 pr-2 border-l border-navy/10 ${gameWinClass(mr.team1Game2, mr.team2Game2)}`}>{mr.team1Game2 ?? '-'}</td>
            <td className={`text-right tabular-nums py-0.5 pl-3 pr-2 border-l border-navy/10 ${gameWinClass(mr.team1Game3, mr.team2Game3)}`}>{mr.team1Game3 ?? '-'}</td>
            <td className="text-center tabular-nums py-0.5">{mr.team1GamePts != null ? mr.team1GamePts / 2 : '-'}</td>
            <td className="text-center tabular-nums py-0.5">{mr.team1BonusPts ?? '-'}</td>
            <td className="text-center tabular-nums py-0.5 font-bold">
              {t1Total === 9 ? '\u2B50 ' : ''}{t1Total}
            </td>
          </tr>
          <tr className="text-navy">
            <td className="py-0.5">
              <Link href={`/team/${awayTeamSlug}`} className="hover:text-red-600 transition-colors">
                <TeamName name={awayTeamName} />
              </Link>
            </td>
            <td className={`text-right tabular-nums py-0.5 pl-3 pr-2 border-l border-navy/10 ${gameWinClass(mr.team2Game1, mr.team1Game1)}`}>{mr.team2Game1 ?? '-'}</td>
            <td className={`text-right tabular-nums py-0.5 pl-3 pr-2 border-l border-navy/10 ${gameWinClass(mr.team2Game2, mr.team1Game2)}`}>{mr.team2Game2 ?? '-'}</td>
            <td className={`text-right tabular-nums py-0.5 pl-3 pr-2 border-l border-navy/10 ${gameWinClass(mr.team2Game3, mr.team1Game3)}`}>{mr.team2Game3 ?? '-'}</td>
            <td className="text-center tabular-nums py-0.5">{mr.team2GamePts != null ? mr.team2GamePts / 2 : '-'}</td>
            <td className="text-center tabular-nums py-0.5">{mr.team2BonusPts ?? '-'}</td>
            <td className="text-center tabular-nums py-0.5 font-bold">
              {t2Total === 9 ? '\u2B50 ' : ''}{t2Total}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Weekly scoreboard: one row per matchup with total pts + bowler of the match. */
export function WeeklySummaryTable({
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
      <table className="w-full text-sm sm:text-base font-body">
        <thead>
          <tr className="border-b border-navy/10 text-navy/65 text-xs">
            <th className="text-left font-normal py-1.5 pl-2">Home</th>
            <th className="text-center font-normal py-1.5 w-[80px] sm:w-[100px]">Score</th>
            <th className="text-right font-normal py-1.5">Away</th>
            <th className="hidden sm:table-cell text-left font-normal py-1.5 pl-4">Bowler of the Match</th>
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
                    <TeamName name={matchup.homeTeamName} />
                  </Link>
                </td>
                <td className="text-center tabular-nums py-1.5">
                  <span className={homeWon ? 'font-semibold text-navy' : 'text-navy/70'}>{t1Pts ?? '-'}</span>
                  <span className="text-navy/30 mx-1">-</span>
                  <span className={awayWon ? 'font-semibold text-navy' : 'text-navy/70'}>{t2Pts ?? '-'}</span>
                </td>
                <td className={`text-right py-1.5 ${awayWon ? 'font-semibold text-navy' : 'text-navy/70'}`}>
                  <Link href={`/team/${matchup.awayTeamSlug}`} className="hover:text-red-600 transition-colors">
                    <TeamName name={matchup.awayTeamName} />
                  </Link>
                </td>
                <td className="hidden sm:table-cell pl-4 py-1.5 text-amber-800">
                  {mvpBowler ? (
                    <Link href={`/bowler/${mvpBowler.bowlerSlug}`} className="hover:text-red-600 transition-colors">
                      {mvpBowler.bowlerName}
                      <span className="text-navy/65 ml-1 text-xs">{mvpBowler.handSeries}</span>
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
