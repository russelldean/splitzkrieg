import Link from 'next/link';
import type { StandingsRow } from '@/lib/queries';

interface Props {
  standings: StandingsRow[];
  weekNumber: number;
}

export function CompactStandingsPreview({ standings, weekNumber }: Props) {
  if (standings.length === 0) return null;

  // Group by division
  const divisions = new Map<string, StandingsRow[]>();
  for (const row of standings) {
    const div = row.divisionName ?? '__none__';
    if (!divisions.has(div)) divisions.set(div, []);
    divisions.get(div)!.push(row);
  }

  const divEntries = [...divisions.entries()];
  const hasDivisions = divEntries.length > 1 || (divEntries.length === 1 && divEntries[0][0] !== '__none__');

  return (
    <div className={hasDivisions ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
      {divEntries.map(([divName, rows]) => {
        // Top 2 are playoff teams — include any team tied for 2nd
        const cutoffPts = rows.length >= 2 ? rows[1].totalPts : rows[0]?.totalPts;
        const playoffIDs = new Set(rows.filter(r => r.totalPts >= cutoffPts).map(r => r.teamID));
        const top3 = rows.slice(0, 3);
        // If ties pushed playoff count beyond 2, show all playoff teams + 1 more
        const visibleRows = playoffIDs.size > 2
          ? rows.slice(0, playoffIDs.size + 1)
          : top3;

        return (
          <div key={divName} className="bg-white rounded-lg border border-navy/10 shadow-sm overflow-hidden">
            {hasDivisions && divName !== '__none__' && (
              <div className="px-3 py-1 bg-navy/[0.03] border-b border-navy/10">
                <span className="font-body text-xs text-navy/65 uppercase tracking-wider">{divName}</span>
              </div>
            )}
            <div className="divide-y divide-navy/5">
              {visibleRows.map((row, i) => {
                const inPlayoffs = playoffIDs.has(row.teamID);
                return (
                  <div
                    key={row.teamSlug ?? row.teamName}
                    className={`flex items-center justify-between px-3 py-2 text-sm font-body ${
                      inPlayoffs ? 'bg-amber-100/70 border-l-2 border-l-amber-400' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-navy/65 tabular-nums w-4 text-right">{i + 1}.</span>
                      {row.teamSlug ? (
                        <Link
                          href={`/team/${row.teamSlug}`}
                          className="text-navy hover:text-red-600 transition-colors"
                        >
                          {row.teamName}
                        </Link>
                      ) : (
                        <span className="text-navy">{row.teamName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-navy/70 tabular-nums">
                      <span>{row.wins}W / {row.xp}XP</span>
                      <span className="font-semibold text-navy">{row.totalPts} pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
