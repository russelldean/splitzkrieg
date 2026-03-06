import Link from 'next/link';
import type { StandingsRow } from '@/lib/queries';

interface Props {
  standings: StandingsRow[];
  seasonSlug: string;
  romanNumeral: string;
}

function StandingsGroup({ rows, divisionName }: { rows: StandingsRow[]; divisionName?: string }) {
  return (
    <div>
      {divisionName && (
        <h4 className="font-heading text-sm text-navy/60 mb-1.5">{divisionName}</h4>
      )}
      <table className="w-full text-sm font-body">
        <thead>
          <tr className="border-b border-navy/10 text-navy/40 text-xs">
            <th className="text-left font-normal py-1 px-2 w-8">#</th>
            <th className="text-left font-normal py-1 px-2">Team</th>
            <th className="text-right font-normal py-1 px-2">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.teamID} className="border-b border-navy/5">
              <td className="py-1 px-2 text-navy/40 tabular-nums text-xs">{i + 1}</td>
              <td className="py-1 px-2">
                <Link
                  href={`/team/${row.teamSlug}`}
                  className="text-navy hover:text-red-600 transition-colors text-xs sm:text-sm"
                >
                  {row.teamName}
                </Link>
              </td>
              <td className="py-1 px-2 text-right tabular-nums text-xs sm:text-sm">
                <span className="font-semibold">{row.totalPts}</span>
                {row.lastWeekPts != null && (
                  <span className="text-navy/40 ml-1 text-xs">
                    (+{row.lastWeekPts})
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MiniStandings({ standings, seasonSlug, romanNumeral }: Props) {
  if (standings.length === 0) return null;

  const hasDivisions = standings.some(r => r.divisionName !== null);

  return (
    <div className="bg-white rounded-xl border border-navy/10 p-6 h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-heading text-lg text-navy">Standings</h3>
        <Link
          href={`/season/${seasonSlug}`}
          className="text-xs font-body text-navy/40 hover:text-red-600 transition-colors"
        >
          Full standings &rarr;
        </Link>
      </div>

      <div className="overflow-x-auto -mx-2 flex-1">
        {hasDivisions ? (
          (() => {
            const divisions = new Map<string, StandingsRow[]>();
            for (const row of standings) {
              const div = row.divisionName ?? 'Other';
              if (!divisions.has(div)) divisions.set(div, []);
              divisions.get(div)!.push(row);
            }
            return (
              <div className="space-y-6">
                {Array.from(divisions.entries()).map(([name, rows]) => (
                  <StandingsGroup key={name} rows={rows} divisionName={name} />
                ))}
              </div>
            );
          })()
        ) : (
          <StandingsGroup rows={standings} />
        )}
      </div>
    </div>
  );
}
