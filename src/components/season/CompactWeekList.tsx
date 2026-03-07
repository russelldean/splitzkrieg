'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { WeekSummary } from '@/lib/queries';

interface Props {
  weekSummaries: WeekSummary[];
  seasonSlug: string;
  totalWeeks: number;
}

export function CompactWeekList({ weekSummaries, seasonSlug, totalWeeks }: Props) {
  const [expanded, setExpanded] = useState(true);

  const summaryMap = new Map(weekSummaries.map(w => [w.week, w]));
  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  return (
    <section id="weekly">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-heading text-2xl text-navy">Weekly Results</h2>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm font-body text-navy/50 hover:text-red-600 transition-colors"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {expanded && (
        <div className="space-y-0.5">
          {weeks.map(week => {
            const summary = summaryMap.get(week);
            const hasScores = !!summary;
            const dateStr = summary?.matchDate
              ? new Date(summary.matchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : null;

            return (
              <Link
                key={week}
                href={`/week/${seasonSlug}/${week}`}
                className="flex items-center justify-between px-4 py-2.5 -mx-1 rounded-lg hover:bg-navy/[0.04] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="font-heading text-base text-navy group-hover:text-red-600 transition-colors">
                    Week {week}
                  </span>
                  {dateStr && (
                    <span className="text-xs font-body text-navy/50">{dateStr}</span>
                  )}
                  {!hasScores && (
                    <span className="text-xs font-body text-navy/40 italic">Upcoming</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs font-body text-navy/50 shrink-0">
                  {hasScores && summary && (
                    <>
                      {summary.leagueAvg != null && summary.expectedAvg != null && (() => {
                        const delta = summary.leagueAvg - summary.expectedAvg;
                        const sign = delta >= 0 ? '+' : '';
                        const colorClass = delta >= 0 ? 'text-green-600' : 'text-red-600';
                        return (
                          <span className="hidden sm:inline">
                            <span className="text-navy/50">Avg </span>
                            <span className="tabular-nums font-semibold text-navy/70">{summary.leagueAvg}</span>
                            <span className="text-navy/30"> / </span>
                            <span className="text-navy/50">Expected </span>
                            <span className="tabular-nums text-navy/50">{summary.expectedAvg}</span>
                            <span className={`tabular-nums font-semibold ml-1.5 ${colorClass}`}>{sign}{delta.toFixed(1)}</span>
                          </span>
                        );
                      })()}
                      {summary.botwName && (
                        <span>
                          <span className="text-navy/50 text-[10px] sm:text-xs">BOTW </span>
                          <span className="font-semibold text-navy/70">{summary.botwName}</span>
                          {summary.botwPinsOver != null && (
                            <span className="hidden sm:inline tabular-nums text-navy/50 ml-1">+{summary.botwPinsOver}</span>
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
      )}

      <div className="mt-3">
        <Link
          href="/week"
          className="text-sm font-body text-navy/50 hover:text-red-600 transition-colors"
        >
          View all weeks across all seasons &rarr;
        </Link>
      </div>
    </section>
  );
}
