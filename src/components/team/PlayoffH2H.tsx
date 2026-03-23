'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { PlayoffH2HMatchup } from '@/lib/queries';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface PlayoffH2HSummary {
  opponentID: number;
  opponentName: string;
  opponentSlug: string;
  wins: number;
  losses: number;
  meetings: number;
  details: PlayoffH2HMatchup[];
}

interface Props {
  matchups: PlayoffH2HMatchup[];
}

export function PlayoffH2H({ matchups }: Props) {
  const [openOpponents, setOpenOpponents] = useState<Set<number>>(new Set());

  const summaries = useMemo(() => {
    const map = new Map<number, PlayoffH2HSummary>();
    for (const m of matchups) {
      if (!map.has(m.opponentID)) {
        map.set(m.opponentID, {
          opponentID: m.opponentID,
          opponentName: m.opponentName,
          opponentSlug: m.opponentSlug,
          wins: 0,
          losses: 0,
          meetings: 0,
          details: [],
        });
      }
      const s = map.get(m.opponentID)!;
      s.meetings++;
      if (m.won) s.wins++;
      else s.losses++;
      s.details.push(m);
    }
    const result = Array.from(map.values());
    result.sort((a, b) => b.meetings - a.meetings || a.opponentName.localeCompare(b.opponentName));
    return result;
  }, [matchups]);

  function toggleOpponent(opponentID: number) {
    setOpenOpponents((prev) => {
      const next = new Set(prev);
      next.has(opponentID) ? next.delete(opponentID) : next.add(opponentID);
      return next;
    });
  }

  const totals = useMemo(() => {
    let w = 0, l = 0;
    for (const s of summaries) { w += s.wins; l += s.losses; }
    const total = w + l;
    return { w, l, meetings: total, pct: total > 0 ? (w / total) * 100 : 0 };
  }, [summaries]);

  if (matchups.length === 0) return null;

  return (
    <section id="playoff-h2h" className="scroll-mt-20">
      <SectionHeading>Playoff Head-to-Head</SectionHeading>

      <div className="border border-navy/10 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm sm:text-base font-body">
            <thead>
              <tr className="border-b border-navy/10 bg-navy/[0.03]">
                <th className="text-left px-4 py-2.5 text-navy/60 font-normal">Opponent</th>
                <th className="text-right px-3 py-2.5 text-navy/60 font-normal">Meetings</th>
                <th className="text-right px-3 py-2.5 text-navy/60 font-normal">W</th>
                <th className="text-right px-3 py-2.5 text-navy/60 font-normal">L</th>
                <th className="text-right px-4 py-2.5 text-navy/60 font-normal">Win%</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => {
                const isOpen = openOpponents.has(s.opponentID);
                return (
                  <PlayoffSummaryRow
                    key={s.opponentID}
                    summary={s}
                    isOpen={isOpen}
                    onToggle={() => toggleOpponent(s.opponentID)}
                  />
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-navy/10 bg-navy/[0.03] font-medium">
                <td className="px-4 py-2.5 text-navy/70">Lifetime</td>
                <td className="text-right px-3 py-2.5 tabular-nums text-navy/70">{totals.meetings}</td>
                <td className="text-right px-3 py-2.5 tabular-nums text-green-600 font-semibold">{totals.w}</td>
                <td className="text-right px-3 py-2.5 tabular-nums text-navy/65">{totals.l}</td>
                <td className="text-right px-4 py-2.5 tabular-nums font-semibold text-navy">{totals.pct.toFixed(1)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}

function PlayoffSummaryRow({
  summary: s,
  isOpen,
  onToggle,
}: {
  summary: PlayoffH2HSummary;
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
            <span className="text-navy/55 text-xs">{isOpen ? '\u25BC' : '\u25B6'}</span>
            <Link
              href={`/team/${s.opponentSlug}`}
              onClick={(e) => e.stopPropagation()}
              className="text-navy hover:text-red-600 underline-offset-2 hover:underline transition-colors"
            >
              {s.opponentName}
            </Link>
          </span>
        </td>
        <td className="text-right px-3 py-2.5 tabular-nums text-navy/70">{s.meetings}</td>
        <td className="text-right px-3 py-2.5 tabular-nums text-green-600 font-semibold">{s.wins}</td>
        <td className="text-right px-3 py-2.5 tabular-nums text-navy/65">{s.losses}</td>
        <td className="text-right px-4 py-2.5 tabular-nums font-medium text-navy">
          {s.meetings > 0 ? ((s.wins / s.meetings) * 100).toFixed(1) : '0.0'}%
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={5} className="p-0">
            <PlayoffDrillDown details={s.details} />
          </td>
        </tr>
      )}
    </>
  );
}

function PlayoffDrillDown({ details }: { details: PlayoffH2HMatchup[] }) {
  return (
    <div className="bg-navy/[0.02] border-t border-navy/5">
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="border-b border-navy/8 text-navy/50">
              <th className="text-left px-4 py-1.5 font-normal">Season</th>
              <th className="text-left px-3 py-1.5 font-normal">Round</th>
              <th className="text-center px-3 py-1.5 font-normal">Result</th>
            </tr>
          </thead>
          <tbody>
            {details.map((m, i) => (
              <tr
                key={i}
                className="border-b border-navy/5 hover:bg-navy/[0.04] transition-colors"
              >
                <td className="px-4 py-1.5">
                  <Link
                    href={`/season/${m.seasonSlug}`}
                    className="text-navy/70 hover:text-red-600 underline-offset-2 hover:underline transition-colors"
                  >
                    {m.seasonName}
                  </Link>
                </td>
                <td className="px-3 py-1.5 text-navy/60 capitalize">{m.round === 'final' ? 'Final' : 'Semifinal'}</td>
                <td className={`text-center px-3 py-1.5 font-semibold ${m.won ? 'text-green-600' : 'text-navy/65'}`}>
                  {m.won ? 'Won' : 'Lost'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
