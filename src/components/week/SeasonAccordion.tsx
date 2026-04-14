'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatMatchDate } from '@/lib/bowling-time';

interface WeekSummary {
  week: number;
  matchDate: string | null;
  leagueAvg: number | null;
  expectedAvg: number | null;
  botwNames: string[];
  botwHandSeries: number | null;
}

interface SeasonEntry {
  seasonID: number;
  slug: string;
  displayName: string;
  romanNumeral: string;
  summaries: WeekSummary[];
}

interface Props {
  seasons: SeasonEntry[];
  currentSlug: string | undefined;
  latestWeek: number | null;
}

export function SeasonAccordion({ seasons, currentSlug, latestWeek }: Props) {
  const [openSeasons, setOpenSeasons] = useState<Set<number>>(
    new Set(seasons[0] ? [seasons[0].seasonID] : [])
  );

  function toggleSeason(seasonID: number) {
    setOpenSeasons(prev => {
      const next = new Set(prev);
      next.has(seasonID) ? next.delete(seasonID) : next.add(seasonID);
      return next;
    });
  }

  return (
    <div className="space-y-1">
      {seasons.map((season, i) => {
        const isFirst = i === 0;
        const isCurrentSeason = season.slug === currentSlug;
        const isOpen = openSeasons.has(season.seasonID);

        return (
          <div key={season.seasonID} id={`season-${season.slug}`} className="scroll-mt-20">
            <div className={`rounded-xl border overflow-hidden ${isFirst ? 'border-navy/10 border-l-4 border-l-navy/30 bg-white shadow-sm' : 'border-navy/8 bg-white shadow-sm'}`}>
              {/* Season header */}
              <button
                onClick={() => toggleSeason(season.seasonID)}
                className="w-full flex justify-between items-center px-5 py-4 bg-navy/[0.02] hover:bg-navy/[0.05] transition-colors"
              >
                <div className="flex items-baseline gap-3">
                  <Link
                    href={`/season/${season.slug}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-heading text-xl text-navy hover:text-red-600 transition-colors"
                  >
                    {season.displayName}
                  </Link>
                  <span className="font-body text-sm text-navy/50">
                    {season.romanNumeral}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-body text-xs text-navy/45 tabular-nums">
                    {season.summaries.length} {season.summaries.length === 1 ? 'week' : 'weeks'}
                  </span>
                  <span className="text-navy/30">
                    {isOpen ? '\u25B2' : '\u25BC'}
                  </span>
                </div>
              </button>

              {/* Week rows */}
              {isOpen && (
                season.summaries.length > 0 ? (
                  <div className="divide-y divide-navy/[0.04]">
                    {season.summaries.map((week) => {
                      const dateStr = formatMatchDate(week.matchDate);
                      const isLatestWeek = isCurrentSeason && week.week === latestWeek;
                      return (
                        <Link
                          key={week.week}
                          href={`/week/${season.slug}/${week.week}`}
                          className={`flex items-center justify-between px-5 py-2.5 hover:bg-navy/[0.02] transition-colors group ${isLatestWeek ? 'bg-red-600/[0.04] border-l-2 border-l-red-600/50' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`font-heading text-base group-hover:text-red-600 transition-colors ${isLatestWeek ? 'text-red-600' : 'text-navy'}`}>
                              Week {week.week}
                            </span>
                            {isLatestWeek && (
                              <span className="font-body text-xs uppercase tracking-wider text-red-600/80 bg-red-600/10 px-1.5 py-0.5 rounded font-semibold">
                                Latest
                              </span>
                            )}
                            {dateStr && (
                              <span className="text-xs font-body text-navy/50">{dateStr}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs font-body text-navy/55">
                            {week.leagueAvg != null && week.expectedAvg != null && (() => {
                              const delta = week.leagueAvg - week.expectedAvg;
                              const sign = delta >= 0 ? '+' : '';
                              const colorClass = delta >= 0 ? 'text-green-600' : 'text-red-600';
                              return (
                                <span className="hidden sm:inline">
                                  <span className="text-navy/55">Avg </span>
                                  <span className="tabular-nums font-semibold text-navy/70">{week.leagueAvg}</span>
                                  <span className="text-navy/25"> / </span>
                                  <span className="text-navy/55">Expected </span>
                                  <span className="tabular-nums text-navy/55">{week.expectedAvg}</span>
                                  <span className={`tabular-nums font-semibold ml-1.5 ${colorClass}`}>{sign}{delta.toFixed(1)}</span>
                                </span>
                              );
                            })()}
                            {week.botwNames.length > 0 && (
                              <span>
                                <span className="text-navy/55 text-xs">BOTW </span>
                                <span className="font-semibold text-navy/70">{week.botwNames.join(' & ')}</span>
                                {week.botwHandSeries != null && (
                                  <span className="hidden sm:inline tabular-nums text-navy/55 ml-1">{week.botwHandSeries}</span>
                                )}
                              </span>
                            )}
                            <svg className="w-3.5 h-3.5 text-navy/25 group-hover:text-red-600 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <p className="font-body text-sm text-navy/50 italic px-5 py-3">No weekly data available.</p>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
