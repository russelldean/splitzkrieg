'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { GhostTeamMatchup } from '@/lib/queries';
import { formatMatchDate } from '@/lib/bowling-time';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeading } from '@/components/ui/SectionHeading';

const GHOST_THRESHOLD = 20;

interface GhostH2HSummary {
  opponentID: number;
  opponentName: string;
  opponentSlug: string;
  totalMatchups: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  details: GhostTeamMatchup[];
}

/** Ghost wins a game when opponent scratch < teamAvg - GHOST_THRESHOLD */
function ghostGameResult(scratch: number, teamAvg: number): 'w' | 'l' | 't' {
  const threshold = teamAvg - GHOST_THRESHOLD;
  if (scratch < threshold) return 'w'; // opponent missed, ghost wins
  if (scratch > threshold) return 'l'; // opponent beat it, ghost loses
  return 't'; // exactly on the line
}

function countGhostGames(m: GhostTeamMatchup): { w: number; l: number; t: number } {
  let w = 0, l = 0, t = 0;
  // Per-game avg = teamAvg (sum of bowler averages) — one number for all 3 games
  const pairs: [number, number][] = [
    [m.scratchGame1, m.teamAvg],
    [m.scratchGame2, m.teamAvg],
    [m.scratchGame3, m.teamAvg],
  ];
  for (const [scratch, avg] of pairs) {
    const r = ghostGameResult(scratch, avg);
    if (r === 'w') w++;
    else if (r === 'l') l++;
    else t++;
  }
  return { w, l, t };
}

function nightRecordStr(m: GhostTeamMatchup): string {
  const { w, l, t } = countGhostGames(m);
  return `${w}-${l}-${t}`;
}

function nightResultClass(m: GhostTeamMatchup): string {
  const { w, l } = countGhostGames(m);
  if (w > l) return 'text-green-600 font-semibold';
  if (w < l) return 'text-navy/65';
  return 'text-amber-600';
}

function gameClass(scratch: number, teamAvg: number): string {
  const r = ghostGameResult(scratch, teamAvg);
  if (r === 'w') return 'text-green-600 font-semibold';
  if (r === 'l') return 'text-navy/65';
  return 'text-amber-600';
}

function formatDate(dateStr: string | null): string {
  return formatMatchDate(dateStr, { month: 'short', day: 'numeric', year: 'numeric' }) ?? '\u2014';
}

interface Props {
  matchups: GhostTeamMatchup[];
}

export function GhostTeamH2H({ matchups }: Props) {
  const [openOpponents, setOpenOpponents] = useState<Set<number>>(new Set());

  const summaries = useMemo(() => {
    const map = new Map<number, GhostH2HSummary>();
    for (const m of matchups) {
      if (!map.has(m.opponentID)) {
        map.set(m.opponentID, {
          opponentID: m.opponentID,
          opponentName: m.opponentName,
          opponentSlug: m.opponentSlug,
          totalMatchups: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          winPct: 0,
          details: [],
        });
      }
      const s = map.get(m.opponentID)!;
      s.totalMatchups++;
      const g = countGhostGames(m);
      s.wins += g.w;
      s.losses += g.l;
      s.ties += g.t;
      s.details.push(m);
    }
    const result = Array.from(map.values());
    for (const s of result) {
      const total = s.wins + s.losses + s.ties;
      s.winPct = total > 0 ? s.wins / total : 0;
    }
    result.sort((a, b) => b.totalMatchups - a.totalMatchups);
    return result;
  }, [matchups]);

  function toggleOpponent(id: number) {
    setOpenOpponents((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (matchups.length === 0) {
    return (
      <section>
        <SectionHeading>Ghost Team Records</SectionHeading>
        <EmptyState title="No ghost team matchup data available" />
      </section>
    );
  }

  return (
    <section>
      <SectionHeading>Ghost Team Records</SectionHeading>
      <p className="font-body text-sm text-navy/55 mb-3">
        Ghost wins when the opponent doesn&rsquo;t get within {GHOST_THRESHOLD} pins of their team scratch average.
      </p>

      <div className="border border-navy/10 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm sm:text-base font-body">
            <thead>
              <tr className="border-b border-navy/10 bg-navy/[0.03]">
                <th className="text-left px-4 py-2.5 text-navy/60 font-normal">Opponent</th>
                <th className="text-right px-3 py-2.5 text-navy/60 font-normal">Nights</th>
                <th className="text-right px-3 py-2.5 text-navy/60 font-normal">W</th>
                <th className="text-right px-3 py-2.5 text-navy/60 font-normal">L</th>
                <th className="text-right px-3 py-2.5 text-navy/60 font-normal">T</th>
                <th className="text-right px-4 py-2.5 text-navy/60 font-normal">Win%</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => {
                const isOpen = openOpponents.has(s.opponentID);
                return (
                  <GhostSummaryRow
                    key={s.opponentID}
                    summary={s}
                    isOpen={isOpen}
                    onToggle={() => toggleOpponent(s.opponentID)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function GhostSummaryRow({
  summary: s,
  isOpen,
  onToggle,
}: {
  summary: GhostH2HSummary;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-navy/5 cursor-pointer hover:bg-navy/[0.04] transition-colors"
      >
        <td className="px-4 py-2.5">
          <span className="flex items-center gap-2">
            <span className="text-navy/40 text-xs">{isOpen ? '\u25BC' : '\u25B6'}</span>
            <Link
              href={`/team/${s.opponentSlug}`}
              onClick={(e) => e.stopPropagation()}
              className="text-navy hover:text-red-600 underline-offset-2 hover:underline transition-colors"
            >
              {s.opponentName}
            </Link>
          </span>
        </td>
        <td className="text-right px-3 py-2.5 tabular-nums text-navy/70">{s.totalMatchups}</td>
        <td className="text-right px-3 py-2.5 tabular-nums text-green-600 font-semibold">{s.wins}</td>
        <td className="text-right px-3 py-2.5 tabular-nums text-navy/65">{s.losses}</td>
        <td className="text-right px-3 py-2.5 tabular-nums text-amber-600">{s.ties}</td>
        <td className="text-right px-4 py-2.5 tabular-nums font-medium text-navy">
          {(s.winPct * 100).toFixed(1)}%
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={6} className="p-0">
            <GhostDrillDown details={s.details} />
          </td>
        </tr>
      )}
    </>
  );
}

function GhostDrillDown({ details }: { details: GhostTeamMatchup[] }) {
  return (
    <div className="bg-navy/[0.02] border-t border-navy/5">
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="border-b border-navy/8 text-navy/50">
              <th className="text-left px-4 py-1.5 font-normal">Date</th>
              <th className="text-left px-3 py-1.5 font-normal">Season</th>
              <th className="text-right px-3 py-1.5 font-normal">Wk</th>
              <th className="text-center px-3 py-1.5 font-normal">Record</th>
              <th className="text-right px-2 py-1.5 font-normal">G1</th>
              <th className="text-right px-2 py-1.5 font-normal">G2</th>
              <th className="text-right px-2 py-1.5 font-normal">G3</th>
              <th className="text-right px-3 py-1.5 font-normal">Avg</th>
            </tr>
          </thead>
          <tbody>
            {details.map((m, i) => {
              const threshold = m.teamAvg - GHOST_THRESHOLD;
              return (
                <tr
                  key={i}
                  className="border-b border-navy/5 hover:bg-navy/[0.04] transition-colors"
                >
                  <td className="px-4 py-1.5 text-navy/60">
                    <Link
                      href={`/week/${m.seasonSlug}/${m.week}`}
                      className="hover:text-red-600 underline-offset-2 hover:underline transition-colors"
                    >
                      {formatDate(m.matchDate)}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5">
                    <Link
                      href={`/season/${m.seasonSlug}`}
                      className="text-navy/70 hover:text-red-600 underline-offset-2 hover:underline transition-colors"
                    >
                      {m.seasonName}
                    </Link>
                  </td>
                  <td className="text-right px-3 py-1.5 tabular-nums text-navy/60">{m.week}</td>
                  <td className={`text-center px-3 py-1.5 tabular-nums ${nightResultClass(m)}`}>
                    {nightRecordStr(m)}
                  </td>
                  <td className={`text-right px-2 py-1.5 tabular-nums ${gameClass(m.scratchGame1, m.teamAvg)}`}>
                    {m.scratchGame1}
                    <span className="text-navy/30 text-xs">/{threshold}</span>
                  </td>
                  <td className={`text-right px-2 py-1.5 tabular-nums ${gameClass(m.scratchGame2, m.teamAvg)}`}>
                    {m.scratchGame2}
                    <span className="text-navy/30 text-xs">/{threshold}</span>
                  </td>
                  <td className={`text-right px-2 py-1.5 tabular-nums ${gameClass(m.scratchGame3, m.teamAvg)}`}>
                    {m.scratchGame3}
                    <span className="text-navy/30 text-xs">/{threshold}</span>
                  </td>
                  <td className="text-right px-3 py-1.5 tabular-nums text-navy/55">
                    {m.teamAvg}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
