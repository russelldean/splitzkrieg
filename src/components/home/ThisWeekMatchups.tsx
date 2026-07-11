import Link from 'next/link';
import type { SeasonScheduleWeek, WeeklyMatchupResult } from '@/lib/queries';
import { formatMatchDate } from '@/lib/bowling-time';
import { groupByMatchDate } from '@/lib/week-utils';

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

  // A split week spans more than one date; group so each date's matchups show
  // under their own date instead of all collapsing under the first date.
  const dateGroups = groupByMatchDate(matchups, (m) => m.matchDate);
  const isSplit = dateGroups.length > 1;
  const headerDate = isSplit ? null : formatMatchDate(matchups[0]?.matchDate, { weekday: 'short', month: 'short', day: 'numeric' });

  const renderMatchup = (m: SeasonScheduleWeek, i: number) => {
          const mr = mrIndex.get(`${weekNumber}-${m.homeTeamID}-${m.awayTeamID}`);
          const t1Pts = mr ? (mr.team1GamePts ?? 0) + (mr.team1BonusPts ?? 0) : null;
          const t2Pts = mr ? (mr.team2GamePts ?? 0) + (mr.team2BonusPts ?? 0) : null;
          const homeWon = t1Pts != null && t2Pts != null && t1Pts > t2Pts;
          const awayWon = t1Pts != null && t2Pts != null && t2Pts > t1Pts;

          return (
            <div key={`${m.homeTeamID}-${m.awayTeamID}`} className="flex items-center justify-between py-1 border-b border-navy/5 last:border-0">
              <div className="flex-1 min-w-0">
                <Link
                  href={`/team/${m.homeTeamSlug}`}
                  className={`text-sm hover:text-red-600 transition-colors ${homeWon ? 'font-semibold text-navy' : 'text-navy'}`}
                >
                  {m.homeTeamName}
                </Link>
              </div>
              {hasResults ? (
                <div className="text-center px-2 tabular-nums text-sm shrink-0">
                  <span className={homeWon ? 'font-semibold text-navy' : 'text-navy/60'}>{t1Pts ?? '-'}</span>
                  <span className="text-navy/40 mx-1">-</span>
                  <span className={awayWon ? 'font-semibold text-navy' : 'text-navy/60'}>{t2Pts ?? '-'}</span>
                </div>
              ) : (
                <span className="text-navy/60 text-xs px-2">vs</span>
              )}
              <div className="flex-1 min-w-0 text-right">
                <Link
                  href={`/team/${m.awayTeamSlug}`}
                  className={`text-sm hover:text-red-600 transition-colors ${awayWon ? 'font-semibold text-navy' : 'text-navy'}`}
                >
                  {m.awayTeamName}
                </Link>
              </div>
            </div>
          );
  };

  return (
    <div className="bg-white rounded-xl border border-navy/10 shadow-sm px-6 pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <h3 className="font-heading text-lg text-navy">Up Next</h3>
          <p className="text-xs font-body text-navy/60">
            Week {weekNumber}{headerDate && <> &middot; {headerDate}</>}
          </p>
        </div>
        <Link
          href={`/week/${seasonSlug}/${weekNumber}`}
          className="text-xs font-body text-navy/60 hover:text-red-600 transition-colors"
        >
          Details &rarr;
        </Link>
      </div>

      {isSplit ? (
        <div className="space-y-3">
          {dateGroups.map((g, gi) => (
            <div key={g.date ?? 'tbd'} className={gi > 0 ? 'pt-3 border-t border-navy/25' : ''}>
              <div className="flex items-baseline gap-2 mb-1.5">
                <h4 className="font-heading text-sm text-navy">
                  {formatMatchDate(g.date, { weekday: 'long', month: 'short', day: 'numeric' }) ?? 'Date TBD'}
                </h4>
                <span className="text-[11px] font-body text-navy/50 tabular-nums">{g.items.length} matches</span>
              </div>
              <div className="space-y-1">
                {g.items.map((m, i) => renderMatchup(m, i))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {matchups.map((m, i) => renderMatchup(m, i))}
        </div>
      )}
    </div>
  );
}
