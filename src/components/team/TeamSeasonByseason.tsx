'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { TeamSeasonRow, TeamSeasonBowler } from '@/lib/queries';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface Props {
  seasons: TeamSeasonRow[];
  bowlersBySeason: Record<number, TeamSeasonBowler[]>;
  currentTeamName: string;
  isActive?: boolean;
}

export function TeamSeasonByseason({ seasons, bowlersBySeason, currentTeamName, isActive = false }: Props) {
  const [openSeasons, setOpenSeasons] = useState<Set<number>>(
    new Set(seasons[0] ? [seasons[0].seasonID] : [])
  );

  if (seasons.length === 0) {
    return <EmptyState title="No season history available." />;
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

  // Find the contiguous block of old seasons without schedule data at the end of the list.
  // Walk backwards from the end to find where the block starts.
  let oldSeasonBoundaryIndex = -1;
  for (let i = seasons.length - 1; i >= 0; i--) {
    if (!seasons[i].hasScheduleData) {
      oldSeasonBoundaryIndex = i;
    } else {
      break;
    }
  }
  const hasOldSeasons = oldSeasonBoundaryIndex !== -1;
  const firstOldSeasonNumeral = hasOldSeasons
    ? seasons[oldSeasonBoundaryIndex].romanNumeral
    : null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <SectionHeading className="mb-0">Season-by-Season</SectionHeading>
        <button
          onClick={toggleAll}
          className="text-sm font-body text-navy/65 hover:text-red-600 transition-colors"
        >
          {allOpen ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      <div className="space-y-1">
        {seasons.map((season, idx) => {
          // Show file cabinet note once before the first old season
          const showOldSeasonNote = hasOldSeasons && idx === oldSeasonBoundaryIndex;
          const isOldSeason = !season.hasScheduleData;
          const bowlers = bowlersBySeason[season.seasonID] ?? [];

          return (
            <div key={season.seasonID}>
              {showOldSeasonNote && (
                <div className="px-4 py-3 mb-1 bg-navy/[0.02] border border-navy/10 rounded-lg text-sm font-body text-navy/65 italic">
                  Detailed team records from Season {firstOldSeasonNumeral ?? 'XXVI'} and earlier are coming soon. Individual bowler stats are shown below.
                </div>
              )}
              <div className="border border-navy/10 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSeason(season.seasonID)}
                  className="w-full flex justify-between items-start px-4 py-3 bg-navy/[0.02] hover:bg-navy/[0.05] transition-colors"
                >
                  <div className="flex items-start flex-wrap gap-x-2 gap-y-0.5">
                    <Link href={`/season/${season.seasonSlug}`} className="font-heading text-lg text-navy hover:text-red-600 transition-colors">
                      {season.seasonName} <span className="text-navy/60">({season.romanNumeral})</span>
                    </Link>
                    {season.teamNameAtTime !== currentTeamName && (
                      <span className="text-sm text-navy/65 font-body">
                        as {season.teamNameAtTime}
                      </span>
                    )}
                    {idx === 0 && isActive && (
                      <span className="text-[10px] font-body font-semibold uppercase tracking-wider text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Current</span>
                    )}
                    {season.isChampion && (
                      <span className="text-base" title="League Champion">🏆</span>
                    )}
                  </div>
                  <div className="flex items-start gap-4 text-sm font-body text-navy/65 shrink-0">
                    {season.wins != null && (
                      <span className="hidden sm:inline tabular-nums">
                        {season.wins}-{season.losses}{season.ties ? `-${season.ties}` : ''}
                      </span>
                    )}
                    <span>
                      {season.teamAverage?.toFixed(1) ?? '\u2014'} avg
                    </span>
                    <span className="text-navy/30">
                      {openSeasons.has(season.seasonID) ? '\u25B2' : '\u25BC'}
                    </span>
                  </div>
                </button>

                {openSeasons.has(season.seasonID) && bowlers.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm sm:text-base font-body">
                      <thead>
                        <tr className="border-b border-navy/10">
                          <th className="text-left px-4 py-2 text-navy/60 font-normal">Bowler</th>
                          <th className="text-right px-4 py-2 text-navy/60 font-normal">Games</th>
                          <th className="text-right px-4 py-2 text-navy/60 font-normal">Pins</th>
                          <th className="text-right px-4 py-2 text-navy/60 font-normal">Avg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bowlers.map(bowler => (
                          <tr key={bowler.bowlerID} className="border-b border-navy/5 hover:bg-navy/[0.05] transition-colors">
                            <td className="px-4 py-2">
                              <Link
                                href={`/bowler/${bowler.slug}`}
                                className="text-navy hover:text-red-600 transition-colors"
                              >
                                {bowler.bowlerName}
                              </Link>
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-navy">
                              {bowler.gamesBowled}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-navy">
                              {bowler.totalPins.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-navy">
                              {bowler.average?.toFixed(1) ?? '\u2014'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {openSeasons.has(season.seasonID) && bowlers.length === 0 && !isOldSeason && (
                  <div className="px-4 py-3 text-sm font-body text-navy/65 italic">
                    No individual bowler data available for this season.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
