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
        <h4 className="font-body text-xs text-navy/60 uppercase tracking-wider mb-1.5">{divisionName}</h4>
      )}
      <table className="w-full text-sm font-body">
        <thead>
          <tr className="border-b border-navy/10 text-xs">
            <th className="text-left font-normal py-1.5 px-2 w-8 text-navy/60">#</th>
            <th className="text-left font-normal py-1.5 px-2 text-navy/60">Team</th>
            <th className="text-right font-normal py-1.5 px-2 text-navy/60">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.teamID} className={i === 1 ? 'border-b-2 border-dashed border-navy/20' : 'border-b border-navy/5'}>
              <td className="py-1.5 px-2 text-navy/60 tabular-nums text-xs">{i + 1}</td>
              <td className="py-1.5 px-2">
                <Link
                  href={`/team/${row.teamSlug}`}
                  className="text-navy hover:text-red-600 transition-colors text-sm"
                >
                  {row.teamName}
                </Link>
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-sm">
                <span className="font-semibold">{row.totalPts}</span>
                {row.lastWeekPts != null && (
                  <span className="text-navy/60 ml-1 text-xs">
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
    <div className="bg-white rounded-xl border border-navy/10 shadow-sm px-6 pt-4 pb-4 h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-heading text-lg text-navy">Standings</h3>
        <Link
          href={`/season/${seasonSlug}`}
          className="text-xs font-body text-navy/60 hover:text-red-600 transition-colors"
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
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-0 space-y-6 md:space-y-0 md:divide-x md:divide-navy/20">
                {Array.from(divisions.entries()).map(([name, rows], i) => (
                  <div key={name} className={i > 0 ? 'md:pl-6' : 'md:pr-6'}>
                    <StandingsGroup rows={rows} divisionName={name} />
                  </div>
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
