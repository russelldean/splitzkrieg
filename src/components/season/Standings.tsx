'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { StandingsRow } from '@/lib/queries';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { StandingsRaceChart } from './StandingsRaceChart';
import { WeeklyHeatmap } from './WeeklyHeatmap';

interface RaceChartData {
  week: number;
  teamID: number;
  teamName: string;
  totalPts: number;
}

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
  /** Show (+x) last-week delta on points. Defaults to true. */
  showDelta?: boolean;
  /** Race data for inline heatmap columns */
  raceData?: RaceChartData[];
}

/** Map 0-9 weekly points to a heat color. */
function heatColor(pts: number): string {
  const colors = [
    '#1E3A8A', '#2563EB', '#3B82F6', '#93C5FD', '#E5E7EB',
    '#FDE68A', '#FBBF24', '#F59E0B', '#EA580C', '#DC2626',
  ];
  return colors[Math.min(9, Math.max(0, pts))] ?? '#E5E7EB';
}

function heatTextColor(pts: number): string {
  if (pts <= 2 || pts >= 8) return '#FFFFFF';
  return '#1B2A4A';
}

/**
 * Compute which teamIDs are in playoff position.
 * With divisions: top 2 per division. Standings are pre-sorted with
 * head-to-head tiebreaker for 2-way ties, so position is definitive.
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
      // Top 2 by position (h2h tiebreaker already applied in sort)
      for (let i = 0; i < Math.min(2, rows.length); i++) {
        ids.add(rows[i].teamID);
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
  showDelta = true,
  weeklyPts,
  weeks,
}: {
  rows: StandingsRow[];
  startRank: number;
  playoffTeamIDs: Set<number>;
  showDelta?: boolean;
  weeklyPts?: Map<number, number[]>;
  weeks?: number[];
}) {
  const hasHeat = weeklyPts && weeks && weeks.length > 0;
  return (
    <div className="bg-white border border-navy/10 rounded-lg shadow-sm overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-xs sm:text-base font-body">
        <thead className="sticky top-0 z-20">
          <tr className="border-b border-navy/10 bg-white text-navy/65 text-xs sm:text-sm uppercase tracking-wider shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
            <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-right w-8 sm:w-10">#</th>
            <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left">Team</th>
            <th className="px-2 py-1.5 sm:py-2 text-right">Pts</th>
            <th className="px-2 py-1.5 sm:py-2 text-right hidden sm:table-cell">Wins</th>
            <th className="px-2 py-1.5 sm:py-2 text-right hidden sm:table-cell">XP</th>
            <th className="px-2 py-1.5 sm:py-2 text-right sm:hidden">W/XP</th>
            <th className="px-2 py-1.5 sm:py-2 text-right hidden sm:table-cell">Scr Avg</th>
            <th className="px-2 py-1.5 sm:py-2 text-right hidden sm:table-cell">Hcp Avg</th>
            {hasHeat && <th className="px-3 hidden md:table-cell"><div className="w-px h-4 bg-navy/30 mx-auto" /></th>}
            {hasHeat && weeks.map(w => (
              <th key={w} className={`px-0 py-1.5 sm:py-2 text-center w-7 hidden md:table-cell text-[10px] ${w === weeks[weeks.length - 1] ? 'pr-3' : ''}`}>{w}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const inPlayoffs = playoffTeamIDs.has(row.teamID);
            const teamWeekPts = weeklyPts?.get(row.teamID);
            return (
              <tr
                key={row.teamID}
                className={`border-b border-navy/5 hover:bg-navy/[0.05] transition-colors ${
                  inPlayoffs ? 'bg-amber-100/70 border-l-2 border-l-amber-400' : ''
                }`}
              >
                <td className="px-2 py-1.5 sm:py-2.5 text-right text-navy/65 tabular-nums">
                  {startRank + i}
                </td>
                <td className="px-2 py-1.5 sm:py-2.5 font-medium">
                  <Link
                    href={`/team/${row.teamSlug}`}
                    className="text-navy hover:text-red-600 transition-colors"
                  >
                    {row.teamName}
                  </Link>
                </td>
                <td className="px-2 py-1.5 sm:py-2.5 text-right tabular-nums font-semibold text-navy">
                  {row.totalPts}
                </td>
                <td className="px-2 py-1.5 sm:py-2.5 text-right tabular-nums text-navy/70 hidden sm:table-cell">{row.wins}</td>
                <td className="px-2 py-1.5 sm:py-2.5 text-right tabular-nums text-navy/70 hidden sm:table-cell">{row.xp}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-navy/70 sm:hidden">{row.wins}/{row.xp}</td>
                <td className="px-2 py-1.5 sm:py-2.5 text-right tabular-nums text-navy/70 hidden sm:table-cell">
                  {row.teamScratchAvg?.toFixed(1) ?? '\u2014'}
                  <span className="text-navy/65 text-xs ml-1">({row.scratchAvgRank})</span>
                </td>
                <td className="px-2 py-1.5 sm:py-2.5 text-right tabular-nums text-navy/70 hidden sm:table-cell">
                  {row.teamHcpAvg?.toFixed(1) ?? '\u2014'}
                  <span className="text-navy/65 text-xs ml-1">({row.hcpAvgRank})</span>
                </td>
                {hasHeat && <td className="px-3 hidden md:table-cell"><div className="w-px h-4 bg-navy/30 mx-auto" /></td>}
                {hasHeat && teamWeekPts?.map((pts, wi) => (
                  <td key={wi} className={`px-0 py-1 text-center hidden md:table-cell ${wi === teamWeekPts.length - 1 ? 'pr-3' : ''}`}>
                    <div
                      className="mx-auto w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-semibold tabular-nums"
                      style={{ backgroundColor: heatColor(pts), color: heatTextColor(pts) }}
                    >
                      {pts}
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DivisionRaceSection({ divName, raceData, standings, playoffTeamIDs }: {
  divName: string;
  raceData: RaceChartData[];
  standings: StandingsRow[];
  playoffTeamIDs: Set<number>;
}) {
  const [open, setOpen] = useState(false);
  if (raceData.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-navy/[0.03] border border-navy/10 hover:bg-navy/[0.06] transition-colors group"
      >
        <span className="font-heading text-sm text-navy/70 group-hover:text-navy transition-colors">
          {divName} Season Race
        </span>
        <span className="flex items-center gap-2 text-xs font-body text-navy/70 group-hover:text-navy transition-colors">
          {open ? 'Hide' : <><span className="hidden md:inline">View chart</span><span className="md:hidden">View charts</span></>}
          <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          <div className="md:hidden">
            <WeeklyHeatmap raceData={raceData} standings={standings} />
          </div>
          <StandingsRaceChart
            raceData={raceData}
            standings={standings}
            playoffTeamIDs={playoffTeamIDs}
            hasDivisions={false}
          />
        </div>
      )}
    </div>
  );
}

function CompactStandingsCard({
  divName,
  rows,
  playoffTeamIDs,
  showDelta = true,
}: {
  divName: string;
  rows: StandingsRow[];
  playoffTeamIDs: Set<number>;
  showDelta?: boolean;
}) {
  return (
    <div className="bg-white border border-navy/10 rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-1 bg-navy/[0.03] border-b border-navy/10">
        <h3 className="font-heading text-sm text-navy/70 leading-tight">{divName}</h3>
      </div>
      <table className="w-full text-sm font-body">
        <thead>
          <tr className="border-b border-navy/10 text-navy/65 text-sm uppercase tracking-wider">
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
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <Link
                    href={`/team/${row.teamSlug}`}
                    className="text-navy hover:text-red-600 transition-colors"
                  >
                    {row.teamName}
                  </Link>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-navy">
                  {row.totalPts}
                  {showDelta && row.lastWeekPts != null && (
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

export function Standings({ standings, hasDivisions, playoffTeams, seasonID, weekNumber, compact, showDelta = true, raceData }: Props) {
  if (standings.length === 0) {
    return (
      <section id="standings">
        <SectionHeading>Standings{weekNumber ? ` (after Wk ${weekNumber})` : ''}</SectionHeading>
        <p className="font-body text-navy/65">No standings data available for this season.</p>
      </section>
    );
  }

  // Compute per-team weekly points from race data
  const weeks = raceData ? Array.from(new Set(raceData.map(r => r.week))).sort((a, b) => a - b) : [];
  const weeklyPts = new Map<number, number[]>();
  if (raceData && weeks.length > 0) {
    for (const s of standings) {
      const pts = weeks.map((w, i) => {
        const thisWeek = raceData.find(r => r.teamID === s.teamID && r.week === w)?.totalPts ?? 0;
        const prevWeek = i > 0
          ? (raceData.find(r => r.teamID === s.teamID && r.week === weeks[i - 1])?.totalPts ?? 0)
          : 0;
        return thisWeek - prevWeek;
      });
      weeklyPts.set(s.teamID, pts);
    }
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
                <CompactStandingsCard key={divName} divName={divName} rows={rows} playoffTeamIDs={playoffTeamIDs} showDelta={showDelta} />
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
            const teamDiv = new Map<number, string>();
            for (const s of standings) teamDiv.set(s.teamID, s.divisionName ?? 'Other');

            return Array.from(divisions.entries()).map(([divName, rows]) => {
              const divRaceData = raceData?.filter(r => teamDiv.get(r.teamID) === divName) ?? [];
              const divPlayoffIDs = new Set(rows.slice(0, 2).map(r => r.teamID));
              return (
                <div key={divName}>
                  <h3 className="font-heading text-lg text-navy/70 mb-3">{divName}</h3>
                  <StandingsTable rows={rows} startRank={1} playoffTeamIDs={playoffTeamIDs} showDelta={showDelta} weeklyPts={weeklyPts} weeks={weeks} />
                  {divRaceData.length > 0 && (
                    <DivisionRaceSection
                      divName={divName}
                      raceData={divRaceData}
                      standings={rows}
                      playoffTeamIDs={playoffTeamIDs?.size ? new Set(rows.filter(r => playoffTeamIDs.has(r.teamID)).map(r => r.teamID)) : divPlayoffIDs}
                    />
                  )}
                </div>
              );
            });
          })()}
        </div>
        )
      ) : (
        <StandingsTable rows={standings} startRank={1} playoffTeamIDs={playoffTeamIDs} showDelta={showDelta} />
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
