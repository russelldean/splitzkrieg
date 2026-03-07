'use client';
import { useState, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
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

export function StandingsRaceChart({ raceData, standings }: Props) {
  const [activeTeam, setActiveTeam] = useState<string | null>(null);

  const { chartData, teamNames, teamCount, teamColorMap } = useMemo(() => {
    if (raceData.length === 0 || standings.length === 0) {
      return { chartData: [], teamNames: [] as string[], teamCount: 0, teamColorMap: new Map<string, string>() };
    }

    const teamNameMap = new Map(standings.map(s => [s.teamID, s.teamName]));
    const teamIDs = standings.map(s => s.teamID);

    // Group by week
    const weeks = Array.from(new Set(raceData.map(r => r.week))).sort((a, b) => a - b);
    if (weeks.length < 2) {
      return { chartData: [], teamNames: [] as string[], teamCount: 0, teamColorMap: new Map<string, string>() };
    }

    const data: Record<string, number | string>[] = [];

    for (const week of weeks) {
      const weekRows = raceData.filter(r => r.week === week);
      // Sort by totalPts DESC to compute ranks
      const sorted = [...weekRows].sort((a, b) => b.totalPts - a.totalPts);

      const point: Record<string, number | string> = { week: `Wk ${week}` };
      sorted.forEach((row, i) => {
        const name = teamNameMap.get(row.teamID) ?? `Team ${row.teamID}`;
        point[name] = i + 1; // rank
      });
      data.push(point);
    }

    const names = teamIDs.map(id => teamNameMap.get(id) ?? `Team ${id}`);
    const colorMap = new Map<string, string>();
    names.forEach((name, i) => colorMap.set(name, TEAM_COLORS[i % TEAM_COLORS.length]));

    return { chartData: data, teamNames: names, teamCount: names.length, teamColorMap: colorMap };
  }, [raceData, standings]);

  const handleTeamClick = useCallback((teamName: string) => {
    setActiveTeam(prev => prev === teamName ? null : teamName);
  }, []);

  if (chartData.length < 2) return null;

  return (
    <section id="race">
      <p className="font-body text-sm text-navy/60 mb-4">
        Team rank positions by total points over the season. Click a team to highlight.
      </p>
      <div className="bg-white rounded-lg p-4">
        <ResponsiveContainer width="100%" height={Math.max(300, teamCount * 20 + 100)}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: '#1B2A4A', opacity: 0.6 }}
              tickLine={false}
              axisLine={{ stroke: '#1B2A4A', opacity: 0.1 }}
            />
            <YAxis
              reversed
              domain={[1, teamCount]}
              ticks={Array.from({ length: teamCount }, (_, i) => i + 1)}
              tick={{ fontSize: 11, fill: '#1B2A4A', opacity: 0.6 }}
              tickLine={false}
              axisLine={false}
              width={30}
              label={{
                value: 'Rank',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 11, fill: '#1B2A4A', opacity: 0.4 },
              }}
            />
            {teamNames.map((name) => {
              const isSelected = activeTeam === name;
              const color = isSelected ? (teamColorMap.get(name) ?? MUTED_COLOR) : MUTED_COLOR;
              const width = isSelected ? 3 : 1.5;
              const opacity = isSelected ? 1 : (activeTeam === null ? 0.45 : 0.15);
              return (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={color}
                  strokeWidth={width}
                  strokeOpacity={opacity}
                  dot={false}
                  activeDot={false}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>

        {/* Team legend -- clickable buttons */}
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-navy/5">
          {teamNames.map((name) => {
            const isActive = activeTeam === name;
            const color = teamColorMap.get(name) ?? MUTED_COLOR;
            return (
              <button
                key={name}
                onClick={() => handleTeamClick(name)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-body transition-all ${
                  isActive
                    ? 'ring-1 ring-offset-1 font-semibold'
                    : activeTeam === null
                      ? 'opacity-70 hover:opacity-100'
                      : 'opacity-30 hover:opacity-60'
                }`}
                style={{
                  color: isActive ? color : '#6B7280',
                  borderColor: isActive ? color : 'transparent',
                  ...(isActive ? { ringColor: color } : {}),
                }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ background: isActive ? color : '#D1D5DB' }}
                />
                {name}
              </button>
            );
          })}
          {activeTeam && (
            <button
              onClick={() => setActiveTeam(null)}
              className="px-2 py-0.5 rounded text-xs font-body text-navy/40 hover:text-navy/60 transition-colors"
            >
              Show all
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
