'use client';
import { useState, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import type { StandingsRow } from '@/lib/queries';

interface RaceChartData {
  week: number;
  teamID: number;
  teamName: string;
  totalPts: number;
}

interface Props {
  raceData: RaceChartData[];
  standings: StandingsRow[];
  playoffTeamIDs?: Set<number> | null;
  hasDivisions?: boolean;
}

/** Palette for up to 20 teams -- distinct colors that work on light background. */
const TEAM_COLORS = [
  '#1B2A4A', // navy
  '#C53030', // red
  '#2B6CB0', // blue
  '#38A169', // green
  '#D69E2E', // gold
  '#805AD5', // purple
  '#DD6B20', // orange
  '#319795', // teal
  '#E53E3E', // bright red
  '#3182CE', // light blue
  '#48BB78', // light green
  '#ECC94B', // yellow
  '#9F7AEA', // lavender
  '#ED8936', // light orange
  '#4FD1C5', // cyan
  '#F56565', // salmon
  '#667EEA', // indigo
  '#68D391', // mint
  '#FC8181', // pink
  '#B794F4', // violet
];

const MUTED_COLOR = '#9CA3AF'; // gray-400 -- more visible than gray-300

export function PointsRaceChart({ raceData, standings, playoffTeamIDs, hasDivisions }: Props) {
  const [activeTeams, setActiveTeams] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Determine which teams are in playoffs (or projected)
  const highlightTeamIDs = useMemo(() => {
    if (playoffTeamIDs && playoffTeamIDs.size > 0) return playoffTeamIDs;
    // No playoff results yet — project top 2 per division
    if (hasDivisions) {
      const ids = new Set<number>();
      const divCounts = new Map<string, number>();
      for (const s of standings) {
        const div = s.divisionName ?? '';
        const count = divCounts.get(div) ?? 0;
        if (count < 2) {
          ids.add(s.teamID);
          divCounts.set(div, count + 1);
        }
      }
      return ids;
    }
    // No divisions — top 4 overall
    return new Set(standings.slice(0, 4).map(s => s.teamID));
  }, [playoffTeamIDs, standings, hasDivisions]);

  const { chartData, teamNames, teamCount, teamColorMap, nameToID } = useMemo(() => {
    if (raceData.length === 0 || standings.length === 0) {
      return { chartData: [], teamNames: [] as string[], teamCount: 0, teamColorMap: new Map<string, string>(), nameToID: new Map<string, number>() };
    }

    const teamNameMap = new Map(standings.map(s => [s.teamID, s.teamName]));
    const teamIDs = standings.map(s => s.teamID);

    // Group by week
    const weeks = Array.from(new Set(raceData.map(r => r.week))).sort((a, b) => a - b);
    if (weeks.length < 2) {
      return { chartData: [], teamNames: [] as string[], teamCount: 0, teamColorMap: new Map<string, string>(), nameToID: new Map<string, number>() };
    }

    const data: Record<string, number | string>[] = [];

    for (const week of weeks) {
      const weekRows = raceData.filter(r => r.week === week);

      const point: Record<string, number | string> = { week: `Wk ${week}` };
      for (const row of weekRows) {
        const name = teamNameMap.get(row.teamID) ?? `Team ${row.teamID}`;
        point[name] = row.totalPts;
      }
      data.push(point);
    }

    const names = teamIDs.map(id => teamNameMap.get(id) ?? `Team ${id}`);
    const colorMap = new Map<string, string>();
    names.forEach((name, i) => colorMap.set(name, TEAM_COLORS[i % TEAM_COLORS.length]));

    // Map team names back to IDs for highlight lookup
    const nameToID = new Map<string, number>();
    teamIDs.forEach(id => nameToID.set(teamNameMap.get(id) ?? `Team ${id}`, id));

    return { chartData: data, teamNames: names, teamCount: names.length, teamColorMap: colorMap, nameToID };
  }, [raceData, standings]);

  // Initialize active teams to playoff teams on first render
  if (!initialized && nameToID.size > 0) {
    const initial = new Set<string>();
    for (const [name, id] of nameToID) {
      if (highlightTeamIDs.has(id)) initial.add(name);
    }
    setActiveTeams(initial);
    setInitialized(true);
  }

  const handleTeamClick = useCallback((teamName: string) => {
    setActiveTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamName)) next.delete(teamName);
      else next.add(teamName);
      return next;
    });
  }, []);

  if (chartData.length < 2) return null;

  const hasSelection = activeTeams.size > 0;

  return (
    <section id="race">
      <p className="font-body text-sm text-navy/60 mb-4">
        Team rank positions by total points over the season. Current playoff positions highlighted by default. Toggle teams on/off to compare.
      </p>
      <div className="bg-white rounded-lg border border-navy/10 shadow-sm p-4">
        <ResponsiveContainer width="100%" height={Math.max(300, teamCount * 20 + 100)}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: '#1B2A4A', opacity: 0.6 }}
              tickLine={false}
              axisLine={{ stroke: '#1B2A4A', opacity: 0.1 }}
            />
            <YAxis
              domain={[0, 'auto']}
              tick={{ fontSize: 11, fill: '#1B2A4A', opacity: 0.6 }}
              tickLine={false}
              axisLine={false}
              width={35}
              label={{
                value: 'Points',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 11, fill: '#1B2A4A', opacity: 0.4 },
              }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                // Sort by points descending
                const sorted = [...payload]
                  .filter(p => p.value != null && activeTeams.has(p.dataKey as string))
                  .sort((a, b) => (b.value as number) - (a.value as number));
                if (sorted.length === 0) return null;
                return (
                  <div className="bg-white border border-navy/10 rounded-lg px-3 py-2 shadow-lg text-xs font-body">
                    <div className="font-semibold text-navy/60 mb-1">{label}</div>
                    {sorted.map((entry) => (
                      <div key={entry.dataKey as string} className="flex items-center gap-1.5 py-0.5">
                        <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
                        <span className="text-navy/50">{entry.value} pts</span>
                        <span className="text-navy" style={{ color: entry.color }}>{entry.dataKey}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            {teamNames.map((name) => {
              const isOn = activeTeams.has(name);
              const ownColor = teamColorMap.get(name) ?? MUTED_COLOR;

              return (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={isOn ? ownColor : MUTED_COLOR}
                  strokeWidth={isOn ? 2.5 : 1.5}
                  strokeOpacity={isOn ? 0.9 : (hasSelection ? 0.15 : 0.35)}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>

        {/* Team legend -- clickable buttons */}
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-navy/5">
          {teamNames.map((name) => {
            const isOn = activeTeams.has(name);
            const color = teamColorMap.get(name) ?? MUTED_COLOR;
            return (
              <button
                key={name}
                onClick={() => handleTeamClick(name)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-body transition-all ${
                  isOn
                    ? 'font-semibold'
                    : hasSelection ? 'opacity-40 hover:opacity-70' : 'opacity-60 hover:opacity-80'
                }`}
                style={{
                  color: isOn ? color : '#6B7280',
                }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ background: isOn ? color : '#D1D5DB' }}
                />
                {name}
              </button>
            );
          })}
          {activeTeams.size > 0 && (
            <button
              onClick={() => setActiveTeams(new Set())}
              className="px-2 py-0.5 rounded text-xs font-body text-navy/60 hover:text-navy/80 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
