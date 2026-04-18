'use client';
import Link from 'next/link';
import type { WeeklyMatchScore } from '@/lib/queries';

const GHOST_TEAM_NAME = 'Ghost Team';

export function TeamName({ name }: { name: string }) {
  if (name === GHOST_TEAM_NAME) return <>{name} {'👻'}</>;
  return <>{name}</>;
}

/** Color class for a game score relative to the bowler's incoming average. */
function avgColorClass(score: number | null, avg: number | null): string {
  if (score === null || avg === null) return '';
  return score >= avg ? 'text-green-600' : 'text-red-600/70';
}

function teamGameTotal(bowlers: WeeklyMatchScore[], gameKey: 'game1' | 'game2' | 'game3'): number {
  return bowlers.reduce((sum, b) => b.isPenalty ? sum : sum + (b[gameKey] ?? 0), 0);
}

function teamSeriesTotal(bowlers: WeeklyMatchScore[]): number {
  return bowlers.reduce((sum, b) => b.isPenalty ? sum : sum + (b.scratchSeries ?? 0), 0);
}

function teamHcpSeriesTotal(bowlers: WeeklyMatchScore[]): number {
  return bowlers.reduce((sum, b) => sum + (b.handSeries ?? 0), 0);
}

function teamTurkeyTotal(bowlers: WeeklyMatchScore[]): number {
  return bowlers.reduce((sum, b) => sum + (b.turkeys ?? 0), 0);
}

export function TeamBoxScore({
  teamName,
  teamSlug,
  bowlers,
  mvpBowlerID,
}: {
  teamName: string;
  teamSlug: string;
  bowlers: WeeklyMatchScore[];
  mvpBowlerID?: number | null;
}) {
  const g1Total = teamGameTotal(bowlers, 'game1');
  const g2Total = teamGameTotal(bowlers, 'game2');
  const g3Total = teamGameTotal(bowlers, 'game3');
  const seriesTot = teamSeriesTotal(bowlers);
  const hcpSeriesTot = teamHcpSeriesTotal(bowlers);
  const turkeysTot = teamTurkeyTotal(bowlers);

  return (
    <div>
      <Link
        href={`/team/${teamSlug}`}
        className="font-heading text-sm text-navy hover:text-red-600 transition-colors"
      >
        <TeamName name={teamName} />
      </Link>
      <div className="overflow-x-auto">
        <table className="w-full text-sm sm:text-base font-body mt-1">
          <thead>
            <tr className="border-b border-navy/10">
              <th className="text-left px-2 py-1 text-navy/65 font-normal text-xs">Bowler</th>
              <th className="text-right px-1 py-1 text-navy/65 font-normal text-xs">Avg</th>
              <th className="text-right pl-2 pr-1 py-1 text-navy/65 font-normal text-xs border-l border-navy/10">G1</th>
              <th className="text-right pl-2 pr-1 py-1 text-navy/65 font-normal text-xs border-l border-navy/10">G2</th>
              <th className="text-right pl-2 pr-1 py-1 text-navy/65 font-normal text-xs border-l border-navy/10">G3</th>
              <th className="text-right px-1 py-1 text-navy/65 font-normal text-xs">Series</th>
              <th className="text-right px-1 py-1 text-navy/65 font-normal text-xs">Hcp</th>
              <th className="text-right px-1 py-1 text-navy/65 font-normal text-xs">T</th>
            </tr>
          </thead>
          <tbody>
            {bowlers.map((b) => {
              const isDebut = !b.isPenalty && b.incomingAvg === null;
              const isMVP = mvpBowlerID != null && b.bowlerID === mvpBowlerID;
              if (b.isPenalty) {
                return (
                  <tr key={`penalty-${b.bowlerID}`} className="border-b border-navy/5 bg-navy/[0.02]">
                    <td className="px-2 py-1 text-sm text-navy/60 italic">Penalty</td>
                    <td className="px-1 py-1"></td>
                    <td className="pl-2 pr-1 py-1 border-l border-navy/10"></td>
                    <td className="pl-2 pr-1 py-1 border-l border-navy/10"></td>
                    <td className="pl-2 pr-1 py-1 border-l border-navy/10"></td>
                    <td className="px-1 py-1"></td>
                    <td className="px-1 py-1 text-right tabular-nums text-sm text-navy/60">{b.handSeries ?? '-'}</td>
                    <td className="px-1 py-1"></td>
                  </tr>
                );
              }
              return (
                <tr key={b.bowlerID} className={`border-b border-navy/5 ${isMVP ? 'bg-amber-100/40' : ''}`}>
                  <td className="px-2 py-1">
                    <Link
                      href={`/bowler/${b.bowlerSlug}`}
                      className={`underline-offset-2 hover:underline text-sm ${isMVP ? 'text-amber-800 font-semibold hover:text-red-600' : 'text-navy hover:text-red-600'}`}
                    >
                      {b.bowlerName}
                    </Link>
                    {isDebut && (
                      <span className="ml-1.5 text-xs font-heading text-red-600/70 bg-red-600/10 px-1 py-0.5 rounded uppercase tracking-wider">
                        Debut
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums text-sm text-navy/65">
                    {b.incomingAvg ?? '-'}
                  </td>
                  <td className={`pl-2 pr-1 py-1 text-right tabular-nums text-sm border-l border-navy/10 ${avgColorClass(b.game1, b.incomingAvg)}`}>
                    {b.game1 ?? '-'}
                  </td>
                  <td className={`pl-2 pr-1 py-1 text-right tabular-nums text-sm border-l border-navy/10 ${avgColorClass(b.game2, b.incomingAvg)}`}>
                    {b.game2 ?? '-'}
                  </td>
                  <td className={`pl-2 pr-1 py-1 text-right tabular-nums text-sm border-l border-navy/10 ${avgColorClass(b.game3, b.incomingAvg)}`}>
                    {b.game3 ?? '-'}
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums font-semibold text-sm">
                    {b.scratchSeries ?? '-'}
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums text-sm text-navy/60">
                    {b.handSeries ?? '-'}
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums text-sm text-navy/65">
                    {b.turkeys > 0 ? b.turkeys : ''}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-navy/[0.03]">
              <td className="px-2 py-1 text-xs font-heading text-navy/60">Team Total</td>
              <td className="px-1 py-1"></td>
              <td className="pl-2 pr-1 py-1 text-right tabular-nums font-semibold text-xs border-l border-navy/10">{g1Total}</td>
              <td className="pl-2 pr-1 py-1 text-right tabular-nums font-semibold text-xs border-l border-navy/10">{g2Total}</td>
              <td className="pl-2 pr-1 py-1 text-right tabular-nums font-semibold text-xs border-l border-navy/10">{g3Total}</td>
              <td className="px-1 py-1 text-right tabular-nums font-bold text-xs">{seriesTot}</td>
              <td className="px-1 py-1 text-right tabular-nums font-bold text-xs">{hcpSeriesTot}</td>
              <td className="px-1 py-1 text-right tabular-nums font-semibold text-xs text-navy/65">
                {turkeysTot > 0 ? turkeysTot : ''}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
