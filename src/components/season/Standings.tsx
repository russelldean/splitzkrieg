import Link from 'next/link';
import type { StandingsRow } from '@/lib/queries';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface Props {
  standings: StandingsRow[];
  hasDivisions: boolean;
  /** Actual playoff teams from playoffResults, or null to use computed positions */
  playoffTeams?: Set<number> | null;
  seasonID?: number;
  /** Week number to display in heading (e.g. "Standings (after Wk 3)") */
  weekNumber?: number | null;
  /** Blog mode: side-by-side division cards, no avg columns */
  compact?: boolean;
}

/**
 * Compute which teamIDs are in playoff position.
 * With divisions: top 2 per division (including ties for 2nd).
 * Without divisions: top 8 overall (including ties for 8th).
 */
function getPlayoffTeamIDs(standings: StandingsRow[], hasDivisions: boolean): Set<number> {
  const ids = new Set<number>();

  if (hasDivisions) {
    const divisions = new Map<string, StandingsRow[]>();
    for (const row of standings) {
      const div = row.divisionName ?? 'Other';
      if (!divisions.has(div)) divisions.set(div, []);
      divisions.get(div)!.push(row);
    }
    for (const rows of divisions.values()) {
      if (rows.length === 0) continue;
      ids.add(rows[0].teamID);
      if (rows.length >= 2) {
        const secondPlacePts = rows[1].totalPts;
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
    <div className="bg-white border border-navy/10 rounded-lg shadow-sm overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm sm:text-base font-body">
        <thead>
          <tr className="border-b border-navy/10 bg-navy/[0.02] text-navy/60 text-xs sm:text-sm uppercase tracking-wider">
            <th className="px-4 py-2 text-left w-12">#</th>
            <th className="px-4 py-2 text-left">Team</th>
            <th className="px-4 py-2 text-right">Total Pts</th>
            <th className="px-4 py-2 text-right">Wins</th>
            <th className="px-4 py-2 text-right">XP</th>
            <th className="px-4 py-2 text-left pl-6">Scratch Avg</th>
            <th className="px-4 py-2 text-left pl-6">HCP Avg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const inPlayoffs = playoffTeamIDs.has(row.teamID);
            return (
              <tr
                key={row.teamID}
                className={`border-b border-navy/5 hover:bg-navy/[0.05] transition-colors ${
                  inPlayoffs ? 'bg-amber-100/70 border-l-2 border-l-amber-400' : ''
                }`}
              >
                <td className="px-4 py-2.5 text-navy/65 tabular-nums">
                  {startRank + i}
                </td>
                <td className="px-4 py-2.5 font-medium">
                  <Link
                    href={`/team/${row.teamSlug}`}
                    className="text-navy hover:text-red-600 transition-colors"
                  >
                    {row.teamName}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-navy">
                  {row.totalPts}
                  {row.lastWeekPts != null && (
                    <span className="text-xs font-normal text-navy/65 ml-1">
                      (+{row.lastWeekPts})
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-navy/70">{row.wins}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-navy/70">{row.xp}</td>
                <td className="px-4 py-2.5 text-left pl-6 tabular-nums text-navy/70">
                  {row.teamScratchAvg?.toFixed(1) ?? '\u2014'}
                  <span className="text-navy/60 text-xs ml-1">({row.scratchAvgRank})</span>
                </td>
                <td className="px-4 py-2.5 text-left pl-6 tabular-nums text-navy/70">
                  {row.teamHcpAvg?.toFixed(1) ?? '\u2014'}
                  <span className="text-navy/60 text-xs ml-1">({row.hcpAvgRank})</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CompactStandingsCard({
  divName,
  rows,
  playoffTeamIDs,
}: {
  divName: string;
  rows: StandingsRow[];
  playoffTeamIDs: Set<number>;
}) {
  return (
    <div className="bg-white border border-navy/10 rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-1.5 bg-navy/[0.03] border-b border-navy/10">
        <h3 className="font-heading text-sm text-navy/70">{divName}</h3>
      </div>
      <table className="w-full text-sm font-body">
        <thead>
          <tr className="border-b border-navy/10 text-navy/60 text-xs uppercase tracking-wider">
            <th className="px-3 py-1.5 text-left w-8">#</th>
            <th className="px-3 py-1.5 text-left">Team</th>
            <th className="px-3 py-1.5 text-right">Pts</th>
            <th className="px-3 py-1.5 text-right">W/XP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const inPlayoffs = playoffTeamIDs.has(row.teamID);
            return (
              <tr
                key={row.teamID}
                className={`border-b border-navy/5 ${
                  inPlayoffs ? 'bg-amber-100/70 border-l-2 border-l-amber-400' : ''
                }`}
              >
                <td className="px-3 py-1.5 text-navy/65 tabular-nums">{i + 1}</td>
                <td className="px-3 py-1.5">
                  <Link
                    href={`/team/${row.teamSlug}`}
                    className="text-navy hover:text-red-600 transition-colors"
                  >
                    {row.teamName}
                  </Link>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-navy">
                  {row.totalPts}
                  {row.lastWeekPts != null && (
                    <span className="text-xs font-normal text-navy/65 ml-1">
                      (+{row.lastWeekPts})
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-navy/70">{row.wins}/{row.xp}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Standings({ standings, hasDivisions, playoffTeams, seasonID, weekNumber, compact }: Props) {
  if (standings.length === 0) {
    return (
      <section id="standings">
        <SectionHeading>Standings{weekNumber ? ` (after Wk ${weekNumber})` : ''}</SectionHeading>
        <p className="font-body text-navy/65">No standings data available for this season.</p>
      </section>
    );
  }

  // Use actual playoff teams when available, fall back to computed positions
  const playoffTeamIDs = playoffTeams ?? getPlayoffTeamIDs(standings, hasDivisions);
  const playoffLabel = playoffTeams
    ? 'Playoff team'
    : hasDivisions ? 'Playoff position (top 2 per division)' : 'Playoff position (top 8)';

  return (
    <section id="standings">
      {!compact && <SectionHeading>Standings{weekNumber ? ` (after Wk ${weekNumber})` : ''}</SectionHeading>}
      {hasDivisions ? (
        compact ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(() => {
              const divisions = new Map<string, StandingsRow[]>();
              for (const row of standings) {
                const div = row.divisionName ?? 'Other';
                if (!divisions.has(div)) divisions.set(div, []);
                divisions.get(div)!.push(row);
              }
              return Array.from(divisions.entries()).map(([divName, rows]) => (
                <CompactStandingsCard key={divName} divName={divName} rows={rows} playoffTeamIDs={playoffTeamIDs} />
              ));
            })()}
          </div>
        ) : (
        <div className="space-y-8">
          {(() => {
            const divisions = new Map<string, StandingsRow[]>();
            for (const row of standings) {
              const div = row.divisionName ?? 'Other';
              if (!divisions.has(div)) divisions.set(div, []);
              divisions.get(div)!.push(row);
            }
            return Array.from(divisions.entries()).map(([divName, rows]) => (
              <div key={divName}>
                <h3 className="font-heading text-lg text-navy/70 mb-3">{divName}</h3>
                <StandingsTable rows={rows} startRank={1} playoffTeamIDs={playoffTeamIDs} />
              </div>
            ));
          })()}
        </div>
        )
      ) : (
        <StandingsTable rows={standings} startRank={1} playoffTeamIDs={playoffTeamIDs} />
      )}
      {!compact && (
        <p className="text-xs font-body text-navy/65 mt-2 flex items-center gap-1.5">
          <span className="inline-block w-3 h-2 bg-amber-100 border-l-2 border-l-amber-400 rounded-sm" />
          {playoffLabel}
        </p>
      )}
      {!compact && (seasonID === 30 || seasonID === 31) && (
        <p className="text-xs font-body text-navy/65 mt-1.5">
          Playoff teams shown here may differ from what was originally reported.
          See <Link href="/rules#numbers" className="text-red-600 hover:text-red-700 underline">A Note on the Numbers</Link> on the Rules page.
        </p>
      )}
    </section>
  );
}
