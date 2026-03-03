'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { GameLogWeek } from '@/lib/queries';
import { scoreColorClass, seriesColorClass } from '@/lib/score-utils';
import { EmptyState } from '@/components/ui/EmptyState';

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
}

export function GameLog({ gameLog }: Props) {
  const seasons = groupBySeason(gameLog);

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
        <h2 className="font-heading text-2xl text-navy">Game Log</h2>
        <button
          onClick={toggleAll}
          className="text-sm font-body text-navy/50 hover:text-red-600 transition-colors"
        >
          {allOpen ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      <div className="space-y-1">
        {seasons.map(season => (
          <div key={season.seasonID} className="border border-navy/10 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSeason(season.seasonID)}
              className="w-full flex justify-between items-center px-4 py-3 bg-navy/[0.02] hover:bg-navy/[0.05] transition-colors"
            >
              <span className="font-heading text-lg text-navy">{season.displayName}</span>
              <span className="text-navy/40 text-sm">
                {season.weeks.length} nights {openSeasons.has(season.seasonID) ? '\u25B2' : '\u25BC'}
              </span>
            </button>

            {openSeasons.has(season.seasonID) && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-body">
                  <thead>
                    <tr className="border-b border-navy/10">
                      <th className="text-left px-4 py-2 text-navy/50 font-normal">Wk</th>
                      <th className="text-left px-4 py-2 text-navy/50 font-normal">Date</th>
                      <th className="text-left px-4 py-2 text-navy/50 font-normal">Opponent</th>
                      <th className="text-right px-4 py-2 text-navy/50 font-normal">G1</th>
                      <th className="text-right px-4 py-2 text-navy/50 font-normal">G2</th>
                      <th className="text-right px-4 py-2 text-navy/50 font-normal">G3</th>
                      <th className="text-right px-4 py-2 text-navy/50 font-normal">Series</th>
                    </tr>
                  </thead>
                  <tbody>
                    {season.weeks.map((week, i) => (
                      <tr key={i} className="border-b border-navy/5 hover:bg-navy/[0.02]">
                        <td className="px-4 py-2 text-navy/60">{week.week}</td>
                        <td className="px-4 py-2 text-navy/60">
                          {week.matchDate
                            ? new Date(week.matchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '\u2014'}
                        </td>
                        <td className="px-4 py-2">
                          {week.opponentSlug ? (
                            <Link href={`/team/${week.opponentSlug}`} className="text-navy hover:text-red-600 underline-offset-2 hover:underline">
                              {week.opponentName}
                            </Link>
                          ) : (
                            <span className="text-navy/40">{week.opponentName ?? '\u2014'}</span>
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
