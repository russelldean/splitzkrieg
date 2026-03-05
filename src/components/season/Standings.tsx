import Link from 'next/link';
import type { StandingsRow } from '@/lib/queries';

interface Props {
  standings: StandingsRow[];
  hasDivisions: boolean;
}

/**
 * Compute which teamIDs are in playoff position.
 * With divisions: top 2 per division (including ties for 2nd).
 * Without divisions: top 8 overall (including ties for 8th).
 */
function getPlayoffTeamIDs(standings: StandingsRow[], hasDivisions: boolean): Set<number> {
  const ids = new Set<number>();

  if (hasDivisions) {
    // Group by division, take top 2 per division
    const divisions = new Map<string, StandingsRow[]>();
    for (const row of standings) {
      const div = row.divisionName ?? 'Other';
      if (!divisions.has(div)) divisions.set(div, []);
      divisions.get(div)!.push(row);
    }
    for (const rows of divisions.values()) {
      // Rows are already sorted by totalPts DESC
      if (rows.length === 0) continue;
      // Always include #1
      ids.add(rows[0].teamID);
      if (rows.length >= 2) {
        const secondPlacePts = rows[1].totalPts;
        // Include all teams tied for 2nd place
        for (let i = 1; i < rows.length; i++) {
          if (rows[i].totalPts >= secondPlacePts) {
            ids.add(rows[i].teamID);
          } else {
            break;
          }
        }
      }
    }
  } else {
    // Top 8 overall (including ties for 8th)
    if (standings.length <= 8) {
      standings.forEach(r => ids.add(r.teamID));
    } else {
      const eighthPlacePts = standings[7].totalPts;
      for (const row of standings) {
        if (row.totalPts >= eighthPlacePts) {
          ids.add(row.teamID);
        }
      }
    }
  }

  return ids;
}

function StandingsTable({
  rows,
  startRank,
  playoffTeamIDs,
}: {
  rows: StandingsRow[];
  startRank: number;
  playoffTeamIDs: Set<number>;
}) {
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
          {rows.map((row, i) => {
            const inPlayoffs = playoffTeamIDs.has(row.teamID);
            return (
              <tr
                key={row.teamID}
                className={`border-b border-navy/5 hover:bg-navy/[0.02] transition-colors ${
                  inPlayoffs ? 'bg-amber-50/60' : ''
                }`}
              >
                <td className="px-4 py-3 text-navy/40 tabular-nums">
                  {inPlayoffs && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" title="Playoff position" />
                  )}
                  {startRank + i}
                </td>
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/team/${row.teamSlug}`}
                    className="text-navy hover:text-red-600 transition-colors"
                  >
                    {row.teamName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-navy">
                  {row.totalPts}
                  {row.lastWeekPts != null && (
                    <span className="text-xs font-normal text-navy/40 ml-1">
                      (+{row.lastWeekPts})
                    </span>
                  )}
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
            );
          })}
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

  const playoffTeamIDs = getPlayoffTeamIDs(standings, hasDivisions);

  if (!hasDivisions) {
    return (
      <section>
        <h2 className="font-heading text-2xl text-navy mb-4">Standings</h2>
        <StandingsTable rows={standings} startRank={1} playoffTeamIDs={playoffTeamIDs} />
        <p className="text-xs font-body text-navy/40 mt-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1 align-middle" />
          Playoff position (top 8)
        </p>
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
            <StandingsTable rows={rows} startRank={1} playoffTeamIDs={playoffTeamIDs} />
          </div>
        ))}
      </div>
      <p className="text-xs font-body text-navy/40 mt-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1 align-middle" />
        Playoff position (top 2 per division)
      </p>
    </section>
  );
}
