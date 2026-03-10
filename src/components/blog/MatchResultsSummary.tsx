import Link from 'next/link';
import { getSeasonIDByRoman, getMatchResultsSummary, type MatchResultRow } from '@/lib/queries/blog';

interface MatchResultsSummaryProps {
  season: string;
  week: number;
}

function isSweep(row: MatchResultRow): 'team1' | 'team2' | null {
  // A sweep is winning all game points (6 out of 6) AND bonus
  if (row.team1GamePts === 6 && row.team1BonusPts > row.team2BonusPts) return 'team1';
  if (row.team2GamePts === 6 && row.team2BonusPts > row.team1BonusPts) return 'team2';
  return null;
}

export async function MatchResultsSummary({ season, week }: MatchResultsSummaryProps) {
  const seasonID = await getSeasonIDByRoman(season);
  if (!seasonID) return null;

  const matches = await getMatchResultsSummary(seasonID, week);

  if (matches.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-navy/10 shadow-sm p-5 my-6">
      <h3 className="font-heading text-lg text-navy mb-4">Match Results</h3>
      <div className="space-y-3">
        {matches.map((m, i) => {
          const sweep = isSweep(m);
          const team1Won = m.team1TotalPts > m.team2TotalPts;
          const team2Won = m.team2TotalPts > m.team1TotalPts;

          return (
            <div
              key={i}
              className={`rounded-md border px-4 py-3 ${
                sweep ? 'border-amber-300 bg-amber-50/50' : 'border-navy/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2 font-body text-sm">
                {/* Team 1 */}
                <div className={`flex-1 ${team1Won ? 'font-semibold' : ''}`}>
                  <Link href={`/team/${m.team1Slug}`} className="text-navy hover:text-red-600 transition-colors">
                    {m.team1Name}
                  </Link>
                </div>
                {/* Scores */}
                <div className="flex items-center gap-3 tabular-nums text-xs text-navy/60">
                  <span className={team1Won ? 'font-bold text-navy' : ''}>{m.team1TotalPts}</span>
                  <span className="text-navy/30">-</span>
                  <span className={team2Won ? 'font-bold text-navy' : ''}>{m.team2TotalPts}</span>
                </div>
                {/* Team 2 */}
                <div className={`flex-1 text-right ${team2Won ? 'font-semibold' : ''}`}>
                  <Link href={`/team/${m.team2Slug}`} className="text-navy hover:text-red-600 transition-colors">
                    {m.team2Name}
                  </Link>
                </div>
              </div>
              {/* Series */}
              <div className="flex items-center justify-between mt-1 font-body text-xs text-navy/40">
                <span>{m.team1Series?.toLocaleString()}</span>
                <span>Series</span>
                <span>{m.team2Series?.toLocaleString()}</span>
              </div>
              {sweep && (
                <p className="text-xs font-body text-amber-600 font-medium mt-1 text-center">Sweep</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
