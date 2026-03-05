import Link from 'next/link';
import type { StandingsRow } from '@/lib/queries';
import { strikeX } from '@/components/ui/StrikeX';

interface Props {
  standings: StandingsRow[];
  hasDivisions: boolean;
}

function StandingsTable({ rows, startRank }: { rows: StandingsRow[]; startRank: number }) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm font-body">
        <thead>
          <tr className="border-b border-navy/10 text-navy/50 text-xs uppercase tracking-wider">
            <th className="px-4 py-2 text-left w-12">#</th>
            <th className="px-4 py-2 text-left">Team</th>
            <th className="px-4 py-2 text-right">Total Pts</th>
            <th className="px-4 py-2 text-right">Wins</th>
            <th className="px-4 py-2 text-right">XP</th>
            <th className="px-4 py-2 text-right">Scratch Avg</th>
            <th className="px-4 py-2 text-right">HCP Avg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.teamID}
              className="border-b border-navy/5 hover:bg-navy/[0.02] transition-colors"
            >
              <td className="px-4 py-3 text-navy/40 tabular-nums">{startRank + i}</td>
              <td className="px-4 py-3 font-medium">
                <Link
                  href={`/team/${row.teamSlug}`}
                  className="text-navy hover:text-red-600 transition-colors"
                >
                  {strikeX(row.teamName)}
                </Link>
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-navy">
                {row.totalPts}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-navy/70">{row.wins}</td>
              <td className="px-4 py-3 text-right tabular-nums text-navy/70">{row.xp}</td>
              <td className="px-4 py-3 text-right tabular-nums text-navy/70">
                {row.teamScratchAvg?.toFixed(1) ?? '\u2014'}
                <span className="text-navy/30 text-xs ml-1">({row.scratchAvgRank})</span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-navy/70">
                {row.teamHcpAvg?.toFixed(1) ?? '\u2014'}
                <span className="text-navy/30 text-xs ml-1">({row.hcpAvgRank})</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Standings({ standings, hasDivisions }: Props) {
  if (standings.length === 0) {
    return (
      <section>
        <h2 className="font-heading text-2xl text-navy mb-4">Standings</h2>
        <p className="font-body text-navy/50">No standings data available for this season.</p>
      </section>
    );
  }

  if (!hasDivisions) {
    return (
      <section>
        <h2 className="font-heading text-2xl text-navy mb-4">Standings</h2>
        <StandingsTable rows={standings} startRank={1} />
      </section>
    );
  }

  // Group by division
  const divisions = new Map<string, StandingsRow[]>();
  for (const row of standings) {
    const div = row.divisionName ?? 'Other';
    if (!divisions.has(div)) divisions.set(div, []);
    divisions.get(div)!.push(row);
  }

  return (
    <section>
      <h2 className="font-heading text-2xl text-navy mb-4">Standings</h2>
      <div className="space-y-8">
        {Array.from(divisions.entries()).map(([divName, rows]) => (
          <div key={divName}>
            <h3 className="font-heading text-lg text-navy/70 mb-3">{divName}</h3>
            <StandingsTable rows={rows} startRank={1} />
          </div>
        ))}
      </div>
    </section>
  );
}
