'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { GameLogWeek, BowlerPatch } from '@/lib/queries';
import { scoreColorClass, seriesColorClass } from '@/lib/score-utils';
import { formatMatchDate } from '@/lib/bowling-time';
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

/** Build fast lookup: "seasonID-week" -> set of patch types */
function buildPatchLookup(patches: BowlerPatch[]) {
  const weekPatches = new Map<string, Set<string>>();
  const seasonPatches = new Map<number, Set<string>>();
  for (const p of patches) {
    if (p.week != null) {
      const key = `${p.seasonID}-${p.week}`;
      if (!weekPatches.has(key)) weekPatches.set(key, new Set());
      weekPatches.get(key)!.add(p.patch);
    } else {
      if (!seasonPatches.has(p.seasonID)) seasonPatches.set(p.seasonID, new Set());
      seasonPatches.get(p.seasonID)!.add(p.patch);
    }
  }
  return { weekPatches, seasonPatches };
}

const PATCH_CONFIG: Record<string, { label: string; abbr: string; color: string; bg: string }> = {
  perfectGame:    { label: 'Perfect Game',       abbr: '300',  color: 'text-amber-800',  bg: 'bg-amber-200' },
  botw:           { label: 'Bowler of the Week', abbr: 'BOTW', color: 'text-purple-700', bg: 'bg-purple-100' },
  highGame:       { label: 'Weekly High Game',   abbr: 'HG',   color: 'text-blue-700',   bg: 'bg-blue-100' },
  highSeries:     { label: 'Weekly High Series', abbr: 'HS',   color: 'text-emerald-700', bg: 'bg-emerald-100' },
  aboveAvg:         { label: 'Above Avg All 3',     abbr: '3/3',  color: 'text-teal-700',    bg: 'bg-teal-100' },
  threeOfAKind:     { label: 'Three of a Kind',    abbr: '3K',   color: 'text-pink-700',    bg: 'bg-pink-100' },
  playoff:          { label: 'Team Playoffs',      abbr: 'TP',   color: 'text-indigo-700',  bg: 'bg-indigo-100' },
  scratchPlayoff:   { label: 'Scratch Playoffs',   abbr: 'SP',   color: 'text-rose-700',    bg: 'bg-rose-100' },
  hcpPlayoff:       { label: 'Handicap Playoffs',  abbr: 'HP',   color: 'text-orange-700',  bg: 'bg-orange-100' },
  champion:         { label: 'Champion',            abbr: '\uD83C\uDFC6',  color: 'text-amber-700',   bg: 'bg-amber-100' },
  scratchChampion:  { label: 'Scratch Champion',    abbr: 'SC',   color: 'text-rose-700',    bg: 'bg-rose-200' },
  hcpChampion:      { label: 'Handicap Champion',   abbr: 'HC',   color: 'text-orange-700',  bg: 'bg-orange-200' },
};

function Patch({ type }: { type: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const cfg = PATCH_CONFIG[type];

  useEffect(() => {
    if (showTooltip && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({
        top: rect.top + window.scrollY - 4,
        left: rect.left + rect.width / 2,
      });
    }
  }, [showTooltip]);

  if (!cfg) return null;
  return (
    <span
      ref={ref}
      className="inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => { e.stopPropagation(); setShowTooltip(prev => !prev); }}
    >
      <span
        className={`inline-flex items-center text-[10px] font-semibold font-body px-1.5 py-0.5 rounded-full ${cfg.color} ${cfg.bg} leading-none cursor-help`}
      >
        {cfg.abbr}
      </span>
      {showTooltip && pos && createPortal(
        <span
          style={{ position: 'absolute', top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)' }}
          className="px-2 py-1 text-[11px] font-body text-white bg-navy rounded shadow-lg whitespace-nowrap z-50 pointer-events-none"
        >
          {cfg.label}
        </span>,
        document.body,
      )}
    </span>
  );
}

interface Props {
  gameLog: GameLogWeek[];
  highGame?: number | null;
  highSeries?: number | null;
  patches?: BowlerPatch[];
}

export function GameLog({ gameLog, highGame, highSeries, patches = [] }: Props) {
  const seasons = groupBySeason(gameLog);
  const { weekPatches, seasonPatches } = buildPatchLookup(patches);

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
          className="text-sm font-body text-navy/65 hover:text-red-600 transition-colors px-3 py-2 -mr-3"
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

          const sPatches = seasonPatches.get(season.seasonID);
          const isOpen = openSeasons.has(season.seasonID);

          // Count week-level patches in this season for the collapsed summary
          let seasonWeekPatchCount = 0;
          for (const week of season.weeks) {
            const wp = weekPatches.get(`${season.seasonID}-${week.week}`);
            if (wp) seasonWeekPatchCount += wp.size;
            // Client-computed: above avg all 3
            if (week.incomingAvg && week.incomingAvg > 0
                && week.game1 != null && week.game1 > week.incomingAvg
                && week.game2 != null && week.game2 > week.incomingAvg
                && week.game3 != null && week.game3 > week.incomingAvg) {
              seasonWeekPatchCount++;
            }
          }
          const totalPatchCount = seasonWeekPatchCount + (sPatches?.size ?? 0);

          return (
          <div key={season.seasonID} className={`border rounded-lg shadow-sm overflow-hidden ${hasBest && !isOpen ? 'border-amber-300 bg-amber-50/30' : 'border-navy/10 bg-white'}`}>
            <button
              onClick={() => toggleSeason(season.seasonID)}
              className="w-full flex justify-between items-center px-4 py-3 bg-navy/[0.03] hover:bg-navy/[0.06] transition-colors"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/stats/${season.weeks[0]?.seasonSlug ?? ''}`} className="font-heading text-lg text-navy hover:text-red-600 transition-colors" onClick={(e) => e.stopPropagation()}>{season.displayName}</Link>
                {!isOpen && hasBest && (
                  <span className="text-xs font-body font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                    {bestLabel}
                  </span>
                )}
                {!isOpen && sPatches && Array.from(sPatches).map(p => (
                  <Patch key={p} type={p} />
                ))}
                {!isOpen && totalPatchCount > 0 && (
                  <span className="text-[10px] font-body text-navy/40">
                    {totalPatchCount} {totalPatchCount === 1 ? 'patch' : 'patches'}
                  </span>
                )}
              </div>
              <span className="text-navy/65 text-sm whitespace-nowrap ml-2">
                {season.weeks.length} nights {isOpen ? '\u25B2' : '\u25BC'}
              </span>
            </button>

            {isOpen && (
              <>
                {/* Season-level patches bar */}
                {sPatches && sPatches.size > 0 && (
                  <div className="flex items-center gap-1.5 px-4 py-2 border-b border-navy/5 bg-navy/[0.01]">
                    {Array.from(sPatches).map(p => (
                      <Patch key={p} type={p} />
                    ))}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm sm:text-base font-body">
                    <thead>
                      <tr className="border-b border-navy/10 bg-navy/[0.02]">
                        <th className="text-left px-2 sm:px-4 py-2 text-navy/60 font-normal">Wk</th>
                        <th className="text-left px-2 sm:px-4 py-2 text-navy/60 font-normal">Date</th>
                        <th className="text-left px-2 sm:px-4 py-2 text-navy/60 font-normal">Opponent</th>
                        <th className="text-right px-2 sm:px-4 py-2 text-navy/60 font-normal">G1</th>
                        <th className="text-right px-2 sm:px-4 py-2 text-navy/60 font-normal">G2</th>
                        <th className="text-right px-2 sm:px-4 py-2 text-navy/60 font-normal">G3</th>
                        <th className="text-right px-2 sm:px-4 py-2 text-navy/60 font-normal">Series</th>
                      </tr>
                    </thead>
                    <tbody>
                      {season.weeks.map((week, i) => {
                        const isHighGame = highGame != null && (week.game1 === highGame || week.game2 === highGame || week.game3 === highGame);
                        const isHighSeries = highSeries != null && week.scratchSeries === highSeries;
                        const isCareerBest = isHighGame || isHighSeries;

                        // Compute week patches
                        const wp = weekPatches.get(`${season.seasonID}-${week.week}`);
                        const weekPatchTypes: string[] = wp ? Array.from(wp) : [];

                        // Client-computed: above avg all 3 games
                        if (week.incomingAvg && week.incomingAvg > 0
                            && week.game1 != null && week.game1 > week.incomingAvg
                            && week.game2 != null && week.game2 > week.incomingAvg
                            && week.game3 != null && week.game3 > week.incomingAvg) {
                          weekPatchTypes.push('aboveAvg');
                        }

                        const hasPatches = weekPatchTypes.length > 0;

                        return (
                        <tr key={i} className={`border-b hover:bg-navy/[0.05] transition-colors ${isCareerBest ? 'bg-amber-50 border-b-amber-200' : 'border-navy/5'}`}>
                          <td className="px-2 sm:px-4 py-2 text-navy/60">
                            <span className="flex items-center gap-1">
                              {week.week}
                              {isCareerBest && (
                                <span className="text-amber-500" title={isHighGame && isHighSeries ? 'Career high game + series' : isHighGame ? 'Career high game' : 'Career high series'}>
                                  &#9733;
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-2 text-navy/60">
                            {week.matchDate ? (
                              <Link
                                href={`/week/${week.seasonSlug}/${week.week}`}
                                className="hover:text-red-600 underline-offset-2 hover:underline transition-colors"
                              >
                                {formatMatchDate(week.matchDate)}
                              </Link>
                            ) : (
                              '\u2014'
                            )}
                          </td>
                          <td className="px-2 sm:px-4 py-2">
                            {week.opponentSlug ? (
                              <Link href={`/team/${week.opponentSlug}`} className="text-navy hover:text-red-600 underline-offset-2 hover:underline">
                                {week.opponentName ?? ''}
                              </Link>
                            ) : (
                              <span className="text-navy/65">{week.opponentName ?? '\u2014'}</span>
                            )}
                          </td>
                          <td className={`px-2 sm:px-4 py-2 text-right tabular-nums ${scoreColorClass(week.game1)}`}>
                            {week.game1 ?? '\u2014'}
                          </td>
                          <td className={`px-2 sm:px-4 py-2 text-right tabular-nums ${scoreColorClass(week.game2)}`}>
                            {week.game2 ?? '\u2014'}
                          </td>
                          <td className={`px-2 sm:px-4 py-2 text-right tabular-nums ${scoreColorClass(week.game3)}`}>
                            {week.game3 ?? '\u2014'}
                          </td>
                          <td className={`px-2 sm:px-4 py-2 text-right tabular-nums font-semibold ${seriesColorClass(week.scratchSeries)}`}>
                            {week.scratchSeries ?? '\u2014'}
                          </td>
                          {hasPatches && (
                            <td className="px-1 sm:px-2 py-2">
                              <div className="flex gap-0.5 flex-wrap">
                                {weekPatchTypes.map(p => <Patch key={p} type={p} />)}
                              </div>
                            </td>
                          )}
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          );
        })}
      </div>
    </section>
  );
}
