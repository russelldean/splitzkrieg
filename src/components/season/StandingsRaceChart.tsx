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
import type { WeeklyMatchScore, StandingsRow } from '@/lib/queries';

interface Props {
  weeklyScores: WeeklyMatchScore[];
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

const MUTED_COLOR = '#D1D5DB'; // gray-300

export function StandingsRaceChart({ weeklyScores, standings }: Props) {
  const [activeTeam, setActiveTeam] = useState<string | null>(null);

  const { chartData, teamNames, teamCount, teamColorMap } = useMemo(() => {
    if (weeklyScores.length === 0 || standings.length === 0) {
      return { chartData: [], teamNames: [] as string[], teamCount: 0, teamColorMap: new Map<string, string>() };
    }

    const weeks = Array.from(new Set(weeklyScores.map(s => s.week))).sort((a, b) => a - b);
    if (weeks.length < 3) {
      return { chartData: [], teamNames: [] as string[], teamCount: 0, teamColorMap: new Map<string, string>() };
    }

    const teamIDsFromStandings = standings.map(s => s.teamID);
    const teamNameMap = new Map(standings.map(s => [s.teamID, s.teamName]));

    // Group scores by week and team, sum scratch series
    const weekTeamPins = new Map<number, Map<number, number>>();
    for (const score of weeklyScores) {
      if (!weekTeamPins.has(score.week)) weekTeamPins.set(score.week, new Map());
      const teamMap = weekTeamPins.get(score.week)!;
      teamMap.set(score.teamID, (teamMap.get(score.teamID) ?? 0) + (score.scratchSeries ?? 0));
    }

    // Compute cumulative pins and ranks per week
    const cumPins = new Map<number, number>();
    for (const teamID of teamIDsFromStandings) {
      cumPins.set(teamID, 0);
    }

    const data: Record<string, number | string>[] = [];

    for (const week of weeks) {
      const weekPins = weekTeamPins.get(week);
      if (!weekPins) continue;

      for (const teamID of teamIDsFromStandings) {
        const weekTotal = weekPins.get(teamID) ?? 0;
        cumPins.set(teamID, (cumPins.get(teamID) ?? 0) + weekTotal);
      }

      const teamsWithPins = teamIDsFromStandings
        .filter(id => (cumPins.get(id) ?? 0) > 0)
        .map(id => ({ teamID: id, pins: cumPins.get(id) ?? 0 }))
        .sort((a, b) => b.pins - a.pins);

      const rankMap = new Map<number, number>();
      teamsWithPins.forEach((t, i) => rankMap.set(t.teamID, i + 1));

      const point: Record<string, number | string> = { week: `Wk ${week}` };
      for (const teamID of teamIDsFromStandings) {
        const name = teamNameMap.get(teamID) ?? `Team ${teamID}`;
        const rank = rankMap.get(teamID);
        if (rank !== undefined) {
          point[name] = rank;
        }
      }
      data.push(point);
    }

    const names = teamIDsFromStandings.map(id => teamNameMap.get(id) ?? `Team ${id}`);
    const colorMap = new Map<string, string>();
    names.forEach((name, i) => colorMap.set(name, TEAM_COLORS[i % TEAM_COLORS.length]));

    return { chartData: data, teamNames: names, teamCount: names.length, teamColorMap: colorMap };
  }, [weeklyScores, standings]);

  const handleTeamClick = useCallback((teamName: string) => {
    setActiveTeam(prev => prev === teamName ? null : teamName);
  }, []);

  if (chartData.length < 3) return null;

  return (
    <section>
      <h2 className="font-heading text-2xl text-navy mb-2">Standings Race</h2>
      <p className="font-body text-sm text-navy/50 mb-4">
        Team rank positions by cumulative pins over the season. Click a team to highlight.
      </p>
      <div className="bg-white rounded-lg border border-navy/10 p-4">
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
            <Tooltip
              contentStyle={{
                background: '#FFFBF2',
                border: '1px solid rgba(27,42,74,0.1)',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              formatter={(value?: number, name?: string) => [value != null ? `#${value}` : '', name ?? '']}
            />
            {teamNames.map((name) => {
              const isActive = activeTeam === null || activeTeam === name;
              const color = isActive ? (teamColorMap.get(name) ?? MUTED_COLOR) : MUTED_COLOR;
              const width = activeTeam === name ? 3 : activeTeam === null ? 1.5 : 1;
              const opacity = activeTeam === null ? 0.35 : (activeTeam === name ? 1 : 0.15);
              return (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={color}
                  strokeWidth={width}
                  strokeOpacity={opacity}
                  dot={false}
                  activeDot={activeTeam === name || activeTeam === null ? { r: 4 } : false}
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
                  color: isActive || activeTeam === null ? color : '#9CA3AF',
                  borderColor: isActive ? color : 'transparent',
                  ...(isActive ? { ringColor: color } : {}),
                }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ background: isActive || activeTeam === null ? color : '#D1D5DB' }}
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
