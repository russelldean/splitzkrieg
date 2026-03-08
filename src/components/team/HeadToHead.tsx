'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { TeamH2HMatchup, TeamH2HActiveTeam } from '@/lib/queries';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface H2HSummary {
  opponentID: number;
  opponentName: string;
  opponentSlug: string;
  totalMatchups: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  matchupDetails: TeamH2HMatchup[];
}

function matchResultClass(ourPts: number, theirPts: number): string {
  if (ourPts > theirPts) return 'text-green-600 font-semibold';
  if (ourPts < theirPts) return 'text-navy/65';
  return 'text-amber-600'; // tie
}

function matchResultLabel(ourPts: number, theirPts: number): string {
  if (ourPts > theirPts) return 'W';
  if (ourPts < theirPts) return 'L';
  return 'T';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface Props {
  matchups: TeamH2HMatchup[];
  activeTeams: TeamH2HActiveTeam[];
  currentTeamID: number;
}

export function HeadToHead({ matchups, activeTeams, currentTeamID }: Props) {
  const [openOpponents, setOpenOpponents] = useState<Set<number>>(new Set());

  const summaries = useMemo(() => {
    const map = new Map<number, H2HSummary>();
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
          matchupDetails: [],
        });
      }
      const s = map.get(m.opponentID)!;
      s.totalMatchups++;
      if (m.ourGamePts > m.theirGamePts) s.wins++;
      else if (m.ourGamePts < m.theirGamePts) s.losses++;
      else s.ties++;
      s.matchupDetails.push(m);
    }
    // Calculate win% and sort by most matchups
    const result = Array.from(map.values());
    for (const s of result) {
      s.winPct = s.totalMatchups > 0 ? s.wins / s.totalMatchups : 0;
    }
    result.sort((a, b) => b.totalMatchups - a.totalMatchups);
    return result;
  }, [matchups]);

  const notYetFaced = useMemo(() => {
    const facedIDs = new Set(summaries.map((s) => s.opponentID));
    return activeTeams.filter(
      (t) => t.teamID !== currentTeamID && !facedIDs.has(t.teamID)
    );
  }, [summaries, activeTeams, currentTeamID]);

  function toggleOpponent(opponentID: number) {
    setOpenOpponents((prev) => {
      const next = new Set(prev);
      next.has(opponentID) ? next.delete(opponentID) : next.add(opponentID);
      return next;
    });
  }

  if (matchups.length === 0) {
    return (
      <section>
        <SectionHeading>Head-to-Head Records</SectionHeading>
        <EmptyState title="No head-to-head data available" />
      </section>
    );
  }

  return (
    <section>
      <SectionHeading>Head-to-Head Records</SectionHeading>

      <div className="border border-navy/10 rounded-xl overflow-hidden bg-white shadow-sm">
        {/* Summary table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm sm:text-base font-body">
            <thead>
              <tr className="border-b border-navy/10 bg-navy/[0.03]">
                <th className="text-left px-4 py-2.5 text-navy/60 font-normal">Opponent</th>
                <th className="text-right px-3 py-2.5 text-navy/60 font-normal">Mtch</th>
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
                  <SummaryRow
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

      {/* Have not yet faced */}
      {notYetFaced.length > 0 && (
        <p className="mt-4 text-sm font-body text-navy/55">
          <span className="font-medium text-navy/70">Have not yet faced: </span>
          {notYetFaced.map((t, i) => (
            <span key={t.teamID}>
              {i > 0 && ', '}
              <Link
                href={`/team/${t.slug}`}
                className="text-navy/65 hover:text-red-600 underline-offset-2 hover:underline transition-colors"
              >
                {t.teamName}
              </Link>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

function SummaryRow({
  summary: s,
  isOpen,
  onToggle,
}: {
  summary: H2HSummary;
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
            <DrillDown details={s.matchupDetails} />
          </td>
        </tr>
      )}
    </>
  );
}

function DrillDown({ details }: { details: TeamH2HMatchup[] }) {
  return (
    <div className="bg-navy/[0.02] border-t border-navy/5">
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="border-b border-navy/8 text-navy/50">
              <th className="text-left px-4 py-1.5 font-normal">Date</th>
              <th className="text-left px-3 py-1.5 font-normal">Season</th>
              <th className="text-right px-3 py-1.5 font-normal">Wk</th>
              <th className="text-center px-3 py-1.5 font-normal">Result</th>
              <th className="text-right px-3 py-1.5 font-normal">Us</th>
              <th className="text-right px-4 py-1.5 font-normal">Them</th>
            </tr>
          </thead>
          <tbody>
            {details.map((m, i) => (
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
                <td className={`text-center px-3 py-1.5 tabular-nums ${matchResultClass(m.ourGamePts, m.theirGamePts)}`}>
                  {matchResultLabel(m.ourGamePts, m.theirGamePts)}
                </td>
                <td className="text-right px-3 py-1.5 tabular-nums text-navy/70">
                  {m.ourSeries ?? '\u2014'}
                </td>
                <td className="text-right px-4 py-1.5 tabular-nums text-navy/60">
                  {m.theirSeries ?? '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
