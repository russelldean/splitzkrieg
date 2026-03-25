import Link from 'next/link';
import type { SeasonScheduleWeek, WeeklyMatchupResult } from '@/lib/queries';
import { formatMatchDate } from '@/lib/bowling-time';

interface Props {
  matchups: SeasonScheduleWeek[];
  matchResults: WeeklyMatchupResult[];
  seasonSlug: string;
  weekNumber: number;
  romanNumeral: string;
}

export function ThisWeekMatchups({ matchups, matchResults, seasonSlug, weekNumber, romanNumeral }: Props) {
  if (matchups.length === 0) return null;

  const mrIndex = new Map<string, WeeklyMatchupResult>();
  for (const r of matchResults) {
    mrIndex.set(`${r.week}-${r.homeTeamID}-${r.awayTeamID}`, r);
  }

  const hasResults = matchResults.length > 0;

  const matchDate = matchups[0]?.matchDate;
  const dateStr = formatMatchDate(matchDate, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="bg-white rounded-xl border border-navy/10 shadow-sm overflow-hidden">
      <div className="flex items-baseline justify-between px-6 py-3 bg-red-600/[0.04] border-b border-red-600/10">
        <div>
          <h3 className="font-heading text-lg text-navy">Up Next</h3>
          <p className="text-xs font-body text-navy/65">
            Week {weekNumber}{dateStr && <> &middot; {dateStr}</>}
          </p>
        </div>
        <Link
          href={`/week/${seasonSlug}/${weekNumber}`}
          className="text-xs font-body text-navy/65 hover:text-red-600 transition-colors"
        >
          Details &rarr;
        </Link>
      </div>
      <div className="px-6 py-5">

      <div className="space-y-1.5">
        {matchups.map((m, i) => {
          const mr = mrIndex.get(`${weekNumber}-${m.homeTeamID}-${m.awayTeamID}`);
          const t1Pts = mr ? (mr.team1GamePts ?? 0) + (mr.team1BonusPts ?? 0) : null;
          const t2Pts = mr ? (mr.team2GamePts ?? 0) + (mr.team2BonusPts ?? 0) : null;
          const homeWon = t1Pts != null && t2Pts != null && t1Pts > t2Pts;
          const awayWon = t1Pts != null && t2Pts != null && t2Pts > t1Pts;

          return (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-navy/5 last:border-0">
              <div className="flex-1 min-w-0">
                <Link
                  href={`/team/${m.homeTeamSlug}`}
                  className={`text-sm hover:text-red-600 transition-colors ${homeWon ? 'font-semibold text-navy' : 'text-navy/70'}`}
                >
                  {m.homeTeamName}
                </Link>
              </div>
              {hasResults ? (
                <div className="text-center px-2 tabular-nums text-sm shrink-0">
                  <span className={homeWon ? 'font-semibold text-navy' : 'text-navy/65'}>{t1Pts ?? '-'}</span>
                  <span className="text-navy/40 mx-1">-</span>
                  <span className={awayWon ? 'font-semibold text-navy' : 'text-navy/65'}>{t2Pts ?? '-'}</span>
                </div>
              ) : (
                <span className="text-navy/25 text-xs px-2">vs</span>
              )}
              <div className="flex-1 min-w-0 text-right">
                <Link
                  href={`/team/${m.awayTeamSlug}`}
                  className={`text-sm hover:text-red-600 transition-colors ${awayWon ? 'font-semibold text-navy' : 'text-navy/70'}`}
                >
                  {m.awayTeamName}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
