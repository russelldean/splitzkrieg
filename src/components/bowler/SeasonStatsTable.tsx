'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { BowlerSeasonStats } from '@/lib/queries';
import { scoreColorClass, seriesColorClass } from '@/lib/score-utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeading } from '@/components/ui/SectionHeading';

const INITIAL_VISIBLE = 3;

interface Props {
  seasons: BowlerSeasonStats[];
}

export function SeasonStatsTable({ seasons }: Props) {
  const [showAll, setShowAll] = useState(false);

  if (seasons.length === 0) {
    return (
      <section>
        <SectionHeading>Season Stats</SectionHeading>
        <div className="bg-white rounded-lg border border-navy/10 p-6">
          <EmptyState title="No season data available" />
        </div>
      </section>
    );
  }

  const totals = seasons.reduce(
    (acc, s) => ({
      gamesBowled: acc.gamesBowled + s.gamesBowled,
      totalPins: acc.totalPins + s.totalPins,
      games200Plus: acc.games200Plus + s.games200Plus,
    }),
    { gamesBowled: 0, totalPins: 0, games200Plus: 0 },
  );

  const careerAvg =
    totals.gamesBowled > 0
      ? (totals.totalPins / totals.gamesBowled).toFixed(1)
      : '\u2014';

  const careerHighGame = Math.max(...seasons.map((s) => s.highGame ?? 0));
  const careerHighSeries = Math.max(...seasons.map((s) => s.highSeries ?? 0));

  const hiddenCount = seasons.length - INITIAL_VISIBLE;
  const visibleSeasons = showAll ? seasons : seasons.slice(0, INITIAL_VISIBLE);

  return (
    <section>
      <SectionHeading>Season Stats</SectionHeading>
      <div className="overflow-x-auto bg-white rounded-lg border border-navy/10 shadow-sm">
        <table className="w-full text-sm sm:text-base font-body">
          <thead>
            <tr className="bg-navy/[0.03] text-left text-xs uppercase tracking-wide text-navy/60">
              <th className="px-4 py-3">Season</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3 text-right">Games</th>
              <th className="px-4 py-3 text-right">Avg</th>
              <th className="px-4 py-3 text-right">High Game</th>
              <th className="px-4 py-3 text-right">High Series</th>
              <th className="px-4 py-3 text-right">200+</th>
              <th className="px-4 py-3 text-right">Total Pins</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/5">
            {visibleSeasons.map((season) => (
              <tr key={`${season.seasonID}-${season.teamSlug ?? 'no-team'}`} className="hover:bg-navy/[0.05] transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link
                    href={`/season/${season.seasonSlug}`}
                    className="text-navy hover:text-red-600 transition-colors"
                  >
                    {season.displayName}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {season.teamSlug ? (
                    <Link
                      href={`/team/${season.teamSlug}`}
                      className="text-navy hover:text-red-600 transition-colors"
                    >
                      {season.teamName ?? ''}
                    </Link>
                  ) : (
                    <span className="text-navy/65">{season.teamName ?? '\u2014'}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">{season.gamesBowled}</td>
                <td className="px-4 py-3 text-right">
                  {season.seasonAverage?.toFixed(1) ?? '\u2014'}
                </td>
                <td className={`px-4 py-3 text-right ${scoreColorClass(season.highGame)}`}>
                  {season.highGame ?? '\u2014'}
                </td>
                <td className={`px-4 py-3 text-right ${seriesColorClass(season.highSeries)}`}>
                  {season.highSeries ?? '\u2014'}
                </td>
                <td className="px-4 py-3 text-right">{season.games200Plus}</td>
                <td className="px-4 py-3 text-right">
                  {season.totalPins.toLocaleString()}
                </td>
              </tr>
            ))}

            {/* Expand/collapse toggle row */}
            {hiddenCount > 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-2 text-center">
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className="text-sm text-red-600 hover:text-red-700 font-body cursor-pointer py-1 inline-flex items-center gap-1"
                  >
                    {showAll ? (
                      <>
                        Show fewer
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      </>
                    ) : (
                      <>
                        Show all {seasons.length} seasons
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>
                </td>
              </tr>
            )}

            {/* Career totals row */}
            <tr className="font-semibold bg-navy/5">
              <td className="px-4 py-3">Career</td>
              <td className="px-4 py-3 text-navy/65">{'\u2014'}</td>
              <td className="px-4 py-3 text-right">{totals.gamesBowled}</td>
              <td className="px-4 py-3 text-right">{careerAvg}</td>
              <td className={`px-4 py-3 text-right ${scoreColorClass(careerHighGame || null)}`}>
                {careerHighGame || '\u2014'}
              </td>
              <td className={`px-4 py-3 text-right ${seriesColorClass(careerHighSeries || null)}`}>
                {careerHighSeries || '\u2014'}
              </td>
              <td className="px-4 py-3 text-right">{totals.games200Plus}</td>
              <td className="px-4 py-3 text-right">
                {totals.totalPins.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
