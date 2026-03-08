'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { GameLogWeek } from '@/lib/queries';
import { scoreColorClass, seriesColorClass } from '@/lib/score-utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeading } from '@/components/ui/SectionHeading';

type GameLogSeason = {
  seasonID: number;
  displayName: string;
  weeks: GameLogWeek[];
};

function groupBySeason(rows: GameLogWeek[]): GameLogSeason[] {
  const map = new Map<number, GameLogSeason>();
  for (const row of rows) {
    if (!map.has(row.seasonID)) {
      map.set(row.seasonID, {
        seasonID: row.seasonID,
        displayName: row.displayName,
        weeks: [],
      });
    }
    map.get(row.seasonID)!.weeks.push(row);
  }
  // Data arrives newest-season-first from query
  return Array.from(map.values());
}

interface Props {
  gameLog: GameLogWeek[];
  highGame?: number | null;
  highSeries?: number | null;
}

export function GameLog({ gameLog, highGame, highSeries }: Props) {
  const seasons = groupBySeason(gameLog);

  // Find which seasons contain career-best game/series
  const seasonsWithHighGame = new Set<number>();
  const seasonsWithHighSeries = new Set<number>();
  for (const week of gameLog) {
    if (highGame != null && (week.game1 === highGame || week.game2 === highGame || week.game3 === highGame)) {
      seasonsWithHighGame.add(week.seasonID);
    }
    if (highSeries != null && week.scratchSeries === highSeries) {
      seasonsWithHighSeries.add(week.seasonID);
    }
  }

  const [openSeasons, setOpenSeasons] = useState<Set<number>>(
    new Set(seasons[0] ? [seasons[0].seasonID] : [])
  );

  if (gameLog.length === 0) {
    return <EmptyState title="No game history available." />;
  }

  const allOpen = openSeasons.size === seasons.length;

  function toggleAll() {
    setOpenSeasons(
      allOpen ? new Set() : new Set(seasons.map(s => s.seasonID))
    );
  }

  function toggleSeason(seasonID: number) {
    setOpenSeasons(prev => {
      const next = new Set(prev);
      next.has(seasonID) ? next.delete(seasonID) : next.add(seasonID);
      return next;
    });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <SectionHeading className="mb-0">Game Log</SectionHeading>
        <button
          onClick={toggleAll}
          className="text-sm font-body text-navy/65 hover:text-red-600 transition-colors"
        >
          {allOpen ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      <div className="space-y-1">
        {seasons.map(season => {
          const hasHighGame = seasonsWithHighGame.has(season.seasonID);
          const hasHighSeries = seasonsWithHighSeries.has(season.seasonID);
          const hasBest = hasHighGame || hasHighSeries;
          const bestLabel = hasHighGame && hasHighSeries
            ? 'Career high game + series'
            : hasHighGame ? 'Career high game' : hasHighSeries ? 'Career high series' : '';

          return (
          <div key={season.seasonID} className={`border rounded-lg overflow-hidden ${hasBest && !openSeasons.has(season.seasonID) ? 'border-amber-300 bg-amber-50/30' : 'border-navy/10'}`}>
            <button
              onClick={() => toggleSeason(season.seasonID)}
              className="w-full flex justify-between items-center px-4 py-3 bg-navy/[0.02] hover:bg-navy/[0.05] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-heading text-lg text-navy">{season.displayName}</span>
                {hasBest && !openSeasons.has(season.seasonID) && (
                  <span className="text-xs font-body font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                    {bestLabel}
                  </span>
                )}
              </div>
              <span className="text-navy/65 text-sm">
                {season.weeks.length} nights {openSeasons.has(season.seasonID) ? '\u25B2' : '\u25BC'}
              </span>
            </button>

            {openSeasons.has(season.seasonID) && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm sm:text-base font-body">
                  <thead>
                    <tr className="border-b border-navy/10">
                      <th className="text-left px-4 py-2 text-navy/60 font-normal">Wk</th>
                      <th className="text-left px-4 py-2 text-navy/60 font-normal">Date</th>
                      <th className="text-left px-4 py-2 text-navy/60 font-normal">Opponent</th>
                      <th className="text-right px-4 py-2 text-navy/60 font-normal">G1</th>
                      <th className="text-right px-4 py-2 text-navy/60 font-normal">G2</th>
                      <th className="text-right px-4 py-2 text-navy/60 font-normal">G3</th>
                      <th className="text-right px-4 py-2 text-navy/60 font-normal">Series</th>
                    </tr>
                  </thead>
                  <tbody>
                    {season.weeks.map((week, i) => {
                      const isHighGame = highGame != null && (week.game1 === highGame || week.game2 === highGame || week.game3 === highGame);
                      const isHighSeries = highSeries != null && week.scratchSeries === highSeries;
                      const isCareerBest = isHighGame || isHighSeries;
                      return (
                      <tr key={i} className={`border-b hover:bg-navy/[0.05] transition-colors ${isCareerBest ? 'bg-amber-50 border-b-amber-200' : 'border-navy/5'}`}>
                        <td className="px-4 py-2 text-navy/60">
                          <span className="flex items-center gap-1">
                            {week.week}
                            {isCareerBest && (
                              <span className="text-amber-500" title={isHighGame && isHighSeries ? 'Career high game + series' : isHighGame ? 'Career high game' : 'Career high series'}>
                                &#9733;
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-navy/60">
                          {week.matchDate ? (
                            <Link
                              href={`/week/${week.seasonSlug}/${week.week}`}
                              className="hover:text-red-600 underline-offset-2 hover:underline transition-colors"
                            >
                              {new Date(week.matchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </Link>
                          ) : (
                            '\u2014'
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {week.opponentSlug ? (
                            <Link href={`/team/${week.opponentSlug}`} className="text-navy hover:text-red-600 underline-offset-2 hover:underline">
                              {week.opponentName ?? ''}
                            </Link>
                          ) : (
                            <span className="text-navy/65">{week.opponentName ?? '\u2014'}</span>
                          )}
                        </td>
                        <td className={`px-4 py-2 text-right tabular-nums ${scoreColorClass(week.game1)}`}>
                          {week.game1 ?? '\u2014'}
                        </td>
                        <td className={`px-4 py-2 text-right tabular-nums ${scoreColorClass(week.game2)}`}>
                          {week.game2 ?? '\u2014'}
                        </td>
                        <td className={`px-4 py-2 text-right tabular-nums ${scoreColorClass(week.game3)}`}>
                          {week.game3 ?? '\u2014'}
                        </td>
                        <td className={`px-4 py-2 text-right tabular-nums font-semibold ${seriesColorClass(week.scratchSeries)}`}>
                          {week.scratchSeries ?? '\u2014'}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </section>
  );
}
