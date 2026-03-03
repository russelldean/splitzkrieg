'use client';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceDot,
} from 'recharts';
import type { BowlerSeasonStats } from '@/lib/queries';

interface Props {
  seasons: BowlerSeasonStats[];
}

export function AverageProgressionChart({ seasons }: Props) {
  // This component is only rendered when seasons.length >= 3 (guard in page.tsx)
  const chartData = seasons
    .filter(s => s.seasonAverage !== null)
    .map(s => ({
      name: s.displayName,
      average: s.seasonAverage,
    }));

  if (chartData.length < 3) return null;

  const averages = chartData.map(d => d.average as number);
  const maxAvg = Math.max(...averages);
  const minAvg = Math.min(...averages);
  const careerHighPoint = chartData.find(d => d.average === maxAvg);

  // Tight Y-axis domain with padding so the line fills most of the chart height
  const range = maxAvg - minAvg;
  const padding = Math.max(range * 0.15, 5);
  // Pick a clean tick interval based on range
  const span = (maxAvg + padding) - (minAvg - padding);
  const tickInterval = span <= 30 ? 5 : span <= 60 ? 10 : span <= 120 ? 15 : 20;
  const yMin = Math.floor((minAvg - padding) / tickInterval) * tickInterval;
  const yMax = Math.ceil((maxAvg + padding) / tickInterval) * tickInterval;
  // Generate explicit evenly-spaced ticks
  const ticks: number[] = [];
  for (let t = yMin; t <= yMax; t += tickInterval) ticks.push(t);

  return (
    <div className="bg-white rounded-lg border border-navy/10 p-6">
      <h2 className="font-heading text-2xl text-navy mb-6">Average Progression</h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#1B2A4A', opacity: 0.6 }}
            tickLine={false}
            axisLine={{ stroke: '#1B2A4A', opacity: 0.1 }}
          />
          <YAxis
            domain={[yMin, yMax]}
            ticks={ticks}
            tick={{ fontSize: 11, fill: '#1B2A4A', opacity: 0.6 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            formatter={(value: number | undefined) => [value != null ? value.toFixed(1) : '', 'Avg']}
            contentStyle={{
              background: '#FFFBF2',
              border: '1px solid rgba(27,42,74,0.1)',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          />
          <Line
            type="monotone"
            dataKey="average"
            stroke="#1B2A4A"
            strokeWidth={2}
            dot={{ fill: '#1B2A4A', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#1B2A4A' }}
          />
          {careerHighPoint && (
            <ReferenceDot
              x={careerHighPoint.name}
              y={maxAvg}
              r={6}
              fill="#C53030"
              stroke="#FFFBF2"
              strokeWidth={2}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-navy/40 mt-2 font-body">
        Red dot marks career-high season average.
      </p>
    </div>
  );
}
