'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { TeamH2HMatchup, TeamH2HActiveTeam } from '@/lib/queries';
import { formatMatchDate } from '@/lib/bowling-time';
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

/** Count per-game W/L/T from a single matchup night */
function countGames(m: TeamH2HMatchup): { w: number; l: number; t: number } {
  let w = 0, l = 0, t = 0;
  const pairs: [number | null, number | null][] = [
    [m.ourGame1, m.theirGame1],
    [m.ourGame2, m.theirGame2],
    [m.ourGame3, m.theirGame3],
  ];
  for (const [ours, theirs] of pairs) {
    if (ours == null || theirs == null) continue;
    if (ours > theirs) w++;
    else if (ours < theirs) l++;
    else t++;
  }
  return { w, l, t };
}

function nightRecordStr(m: TeamH2HMatchup): string {
  const { w, l, t } = countGames(m);
  return `${w}-${l}-${t}`;
}

function nightResultClass(m: TeamH2HMatchup): string {
  const { w, l } = countGames(m);
  if (w > l) return 'text-green-600 font-semibold';
  if (w < l) return 'text-navy/65';
  return 'text-amber-600';
}

function gameResultClass(ours: number | null, theirs: number | null): string {
  if (ours == null || theirs == null) return 'text-navy/50';
  if (ours > theirs) return 'text-green-600 font-semibold';
  if (ours < theirs) return 'text-navy/65';
  return 'text-amber-600';
}

function formatDate(dateStr: string | null): string {
  return formatMatchDate(dateStr, { month: 'short', day: 'numeric', year: 'numeric' }) ?? '\u2014';
}

interface Props {
  matchups: TeamH2HMatchup[];
  activeTeams: TeamH2HActiveTeam[];
  currentTeamID: number;
  isActive?: boolean;
}

export function HeadToHead({ matchups, activeTeams, currentTeamID, isActive = true }: Props) {
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
      const g = countGames(m);
      s.wins += g.w;
      s.losses += g.l;
      s.ties += g.t;
      s.matchupDetails.push(m);
    }
    const result = Array.from(map.values());
    for (const s of result) {
      const totalGames = s.wins + s.losses + s.ties;
      s.winPct = totalGames > 0 ? s.wins / totalGames : 0;
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

  const totals = useMemo(() => {
    let w = 0, l = 0, t = 0;
    for (const s of summaries) { w += s.wins; l += s.losses; t += s.ties; }
    const total = w + l + t;
    return { w, l, t, pct: total > 0 ? (w / total) * 100 : 0 };
  }, [summaries]);

  return (
    <section>
      <SectionHeading>Head-to-Head Records</SectionHeading>

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
                  <SummaryRow
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
                <td className="text-right px-3 py-2.5 tabular-nums text-navy/70">{summaries.reduce((a, s) => a + s.totalMatchups, 0)}</td>
                <td className="text-right px-3 py-2.5 tabular-nums text-green-600 font-semibold">{totals.w}</td>
                <td className="text-right px-3 py-2.5 tabular-nums text-navy/65">{totals.l}</td>
                <td className="text-right px-3 py-2.5 tabular-nums text-amber-600">{totals.t}</td>
                <td className="text-right px-4 py-2.5 tabular-nums font-semibold text-navy">{totals.pct.toFixed(1)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {isActive && notYetFaced.length > 0 && (
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
              <th className="text-center px-3 py-1.5 font-normal">Record</th>
              <th className="text-right px-2 py-1.5 font-normal">G1</th>
              <th className="text-right px-2 py-1.5 font-normal">G2</th>
              <th className="text-right px-2 py-1.5 font-normal">G3</th>
              <th className="text-right px-3 py-1.5 font-normal">Series</th>
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
                <td className={`text-center px-3 py-1.5 tabular-nums ${nightResultClass(m)}`}>
                  {nightRecordStr(m)}
                </td>
                <td className={`text-right px-2 py-1.5 tabular-nums ${gameResultClass(m.ourGame1, m.theirGame1)}`}>
                  {m.ourGame1 != null && m.theirGame1 != null
                    ? `${m.ourGame1}-${m.theirGame1}`
                    : '\u2014'}
                </td>
                <td className={`text-right px-2 py-1.5 tabular-nums ${gameResultClass(m.ourGame2, m.theirGame2)}`}>
                  {m.ourGame2 != null && m.theirGame2 != null
                    ? `${m.ourGame2}-${m.theirGame2}`
                    : '\u2014'}
                </td>
                <td className={`text-right px-2 py-1.5 tabular-nums ${gameResultClass(m.ourGame3, m.theirGame3)}`}>
                  {m.ourGame3 != null && m.theirGame3 != null
                    ? `${m.ourGame3}-${m.theirGame3}`
                    : '\u2014'}
                </td>
                <td className="text-right px-3 py-1.5 tabular-nums text-navy/70">
                  {m.ourSeries ?? '\u2014'}-{m.theirSeries ?? '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
