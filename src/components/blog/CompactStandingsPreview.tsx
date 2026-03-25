import Link from 'next/link';
import type { StandingsRow } from '@/lib/queries';

interface Props {
  standings: StandingsRow[];
  weekNumber: number;
}

export function CompactStandingsPreview({ standings, weekNumber }: Props) {
  if (standings.length === 0) return null;

  const top4 = standings.slice(0, 4);
  const remaining = standings.length - 4;
  const divisionName = standings.find(r => r.divisionName !== null)?.divisionName;

  return (
    <div className="bg-white rounded-lg border border-navy/10 overflow-hidden">
      {divisionName && (
        <div className="px-3 py-1 bg-navy/[0.03] border-b border-navy/10">
          <span className="font-body text-xs text-navy/65 uppercase tracking-wider">{divisionName}</span>
        </div>
      )}
      <div className="divide-y divide-navy/5">
        {top4.map((row, i) => (
          <div key={row.teamSlug ?? row.teamName} className="flex items-center justify-between px-3 py-2 text-sm font-body">
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
        ))}
      </div>
      {remaining > 0 && (
        <div className="px-3 py-1.5 text-xs text-navy/60 text-center">
          and {remaining} more team{remaining !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
