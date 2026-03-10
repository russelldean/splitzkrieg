import Link from 'next/link';
import { getSeasonIDByRoman, getStandingsSnapshot } from '@/lib/queries/blog';

interface StandingsSnapshotProps {
  season: string;
  week: number;
}

function MovementArrow({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) {
    // First week — no prior data
    return <span className="text-navy/30">--</span>;
  }
  const diff = previous - current; // positive = moved up
  if (diff > 0) {
    return (
      <span className="text-green-600 font-medium flex items-center gap-0.5">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        {diff}
      </span>
    );
  }
  if (diff < 0) {
    return (
      <span className="text-red-500 font-medium flex items-center gap-0.5">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
        {Math.abs(diff)}
      </span>
    );
  }
  return <span className="text-navy/30">&mdash;</span>;
}

export async function StandingsSnapshot({ season, week }: StandingsSnapshotProps) {
  const seasonID = await getSeasonIDByRoman(season);
  if (!seasonID) return null;

  const standings = await getStandingsSnapshot(seasonID, week);

  if (standings.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-navy/10 shadow-sm p-5 my-6">
      <h3 className="font-heading text-lg text-navy mb-4">Standings</h3>
      <table className="w-full font-body text-sm">
        <thead>
          <tr className="text-navy/50 text-xs uppercase tracking-wide border-b border-navy/10">
            <th className="py-2 text-left w-8">#</th>
            <th className="py-2 text-left">Team</th>
            <th className="py-2 text-right w-16">Pts</th>
            <th className="py-2 text-center w-16">Move</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => (
            <tr key={row.teamSlug} className="border-b border-navy/5 last:border-0">
              <td className="py-2 text-navy/50 tabular-nums">{row.rank}</td>
              <td className="py-2">
                <Link href={`/team/${row.teamSlug}`} className="text-navy hover:text-red-600 transition-colors">
                  {row.teamName}
                </Link>
              </td>
              <td className="py-2 text-right tabular-nums font-semibold text-navy">{row.totalPts}</td>
              <td className="py-2 flex justify-center">
                <MovementArrow current={row.rank} previous={row.prevRank} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
