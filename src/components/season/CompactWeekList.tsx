import Link from 'next/link';
import type { WeekSummary, SeasonScheduleWeek } from '@/lib/queries';
import { formatMatchDate } from '@/lib/bowling-time';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface Props {
  weekSummaries: WeekSummary[];
  schedule: SeasonScheduleWeek[];
  seasonSlug: string;
  totalWeeks: number;
}

export function CompactWeekList({ weekSummaries, schedule, seasonSlug, totalWeeks }: Props) {
  const summaryMap = new Map(weekSummaries.map(w => [w.week, w]));
  // Build a map of week -> matchDate from schedule for weeks without scores
  const scheduleDateMap = new Map<number, string>();
  for (const s of schedule) {
    if (s.matchDate && !scheduleDateMap.has(s.week)) {
      scheduleDateMap.set(s.week, s.matchDate);
    }
  }
  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  return (
    <section id="weekly">
      <SectionHeading>Weekly Results</SectionHeading>

      <div className="bg-white border border-navy/10 rounded-lg shadow-sm overflow-hidden divide-y divide-navy/5">
          {weeks.map(week => {
            const summary = summaryMap.get(week);
            const hasScores = !!summary;
            const rawDate = summary?.matchDate ?? scheduleDateMap.get(week) ?? null;
            const dateStr = formatMatchDate(rawDate);
            // A week with no scores that has later weeks with scores is missing data, not upcoming
            const maxScoreWeek = Math.max(...Array.from(summaryMap.keys()), 0);
            const isMissingData = !hasScores && week <= maxScoreWeek;

            return (
              <Link
                key={week}
                href={`/week/${seasonSlug}/${week}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-navy/[0.04] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className={`font-heading text-base group-hover:text-red-600 transition-colors ${isMissingData ? 'text-navy/60' : 'text-navy'}`}>
                    Week {week}
                  </span>
                  {dateStr && (
                    <span className="text-xs font-body text-navy/65">{dateStr}</span>
                  )}
                  {isMissingData && (
                    <span className="text-xs font-body text-navy/45 italic">Data missing from archive</span>
                  )}
                  {!hasScores && !isMissingData && !dateStr && (
                    <span className="text-xs font-body text-navy/60 italic">Upcoming</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs font-body text-navy/65 shrink-0">
                  {hasScores && summary && (
                    <>
                      {summary.leagueAvg != null && summary.expectedAvg != null && (() => {
                        const delta = summary.leagueAvg - summary.expectedAvg;
                        const sign = delta >= 0 ? '+' : '';
                        const colorClass = delta >= 0 ? 'text-green-600' : 'text-red-600';
                        return (
                          <span className="hidden sm:inline">
                            <span className="text-navy/65">Avg </span>
                            <span className="tabular-nums font-semibold text-navy/70">{summary.leagueAvg}</span>
                            <span className="text-navy/30"> / </span>
                            <span className="text-navy/65">Expected </span>
                            <span className="tabular-nums text-navy/65">{summary.expectedAvg}</span>
                            <span className={`tabular-nums font-semibold ml-1.5 ${colorClass}`}>{sign}{delta.toFixed(1)}</span>
                          </span>
                        );
                      })()}
                      {summary.botwNames.length > 0 && (
                        <span>
                          <span className="text-navy/65 text-xs">BOTW </span>
                          <span className="font-semibold text-navy/70">{summary.botwNames.join(' & ')}</span>
                          {summary.botwHandSeries != null && (
                            <span className="hidden sm:inline tabular-nums text-navy/65 ml-1">{summary.botwHandSeries}</span>
                          )}
                        </span>
                      )}
                    </>
                  )}
                  <svg className="w-4 h-4 text-navy/30 group-hover:text-red-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>

    </section>
  );
}
