'use client';

import { useMemo } from 'react';
import type { StandingsRow } from '@/lib/queries';
import { StandingsRaceChart } from './StandingsRaceChart';
import { WeeklyHeatmap } from './WeeklyHeatmap';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface RaceChartData {
  week: number;
  teamID: number;
  teamName: string;
  totalPts: number;
}

interface Props {
  raceData: RaceChartData[];
  standings: StandingsRow[];
  playoffTeamIDs: Set<number> | null;
  hasDivisions: boolean;
}

export function StandingsViz({ raceData, standings, playoffTeamIDs, hasDivisions }: Props) {
  const divisions = useMemo(() => {
    if (!hasDivisions) return [null];
    const divs = new Map<string, { standings: StandingsRow[]; raceData: RaceChartData[] }>();
    for (const s of standings) {
      const key = s.divisionName ?? 'Other';
      if (!divs.has(key)) divs.set(key, { standings: [], raceData: [] });
      divs.get(key)!.standings.push(s);
    }
    const teamDiv = new Map<number, string>();
    for (const s of standings) teamDiv.set(s.teamID, s.divisionName ?? 'Other');
    for (const r of raceData) {
      const div = teamDiv.get(r.teamID);
      if (div && divs.has(div)) divs.get(div)!.raceData.push(r);
    }
    return Array.from(divs.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [standings, raceData, hasDivisions]);

  return (
    <section>
      <SectionHeading>Season Race</SectionHeading>

      {hasDivisions ? (
        <div className="space-y-10">
          {(divisions as [string, { standings: StandingsRow[]; raceData: RaceChartData[] }][]).map(([divName, data]) => {
            const divPlayoffIDs = playoffTeamIDs && playoffTeamIDs.size > 0
              ? new Set(data.standings.filter(s => playoffTeamIDs.has(s.teamID)).map(s => s.teamID))
              : new Set(data.standings.slice(0, 2).map(s => s.teamID));
            return (
              <div key={divName}>
                <h4 className="font-heading text-sm text-navy/60 mb-3">{divName}</h4>
                <StandingsRaceChart
                  raceData={data.raceData}
                  standings={data.standings}
                  playoffTeamIDs={divPlayoffIDs}
                  hasDivisions={false}
                />
                <div className="mt-4 md:hidden">
                  <WeeklyHeatmap
                    raceData={data.raceData}
                    standings={data.standings}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <StandingsRaceChart
            raceData={raceData}
            standings={standings}
            playoffTeamIDs={playoffTeamIDs}
            hasDivisions={false}
          />
          <div className="mt-4 md:hidden">
            <WeeklyHeatmap
              raceData={raceData}
              standings={standings}
            />
          </div>
        </>
      )}
    </section>
  );
}
