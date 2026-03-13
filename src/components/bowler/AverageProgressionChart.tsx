'use client';
import { useRef, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceDot,
  ReferenceLine,
} from 'recharts';
import { toPng } from 'html-to-image';
import type { RollingAvgPoint } from '@/lib/queries';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface Props {
  history: RollingAvgPoint[];
  bowlerName?: string;
}

interface ChartPoint {
  index: number;
  rollingAvg: number;
  label: string; // "Fall 2025 Wk 12"
  seasonID: number;
  displayName: string;
}

export function AverageProgressionChart({ history, bowlerName }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (!chartRef.current) return;
    setSharing(true);
    try {
      const dataUrl = await toPng(chartRef.current, {
        backgroundColor: '#FFFFFF',
        pixelRatio: 2,
      });

      const blob = await (await fetch(dataUrl)).blob();
      const fileName = bowlerName
        ? `${bowlerName.toLowerCase().replace(/\s+/g, '-')}-avg-progression.png`
        : 'avg-progression.png';
      const file = new File([blob], fileName, { type: 'image/png' });

      const shareData = { files: [file], title: `${bowlerName ?? ''} Average Progression` };
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
      // User cancelled share or something failed
    } finally {
      setSharing(false);
    }
  }, [bowlerName]);
  if (history.length < 6) return null;

  // Skip the first league night (often outlier data that changes immediately)
  const trimmedHistory = history.slice(1);

  if (trimmedHistory.length < 5) return null;

  const chartData: ChartPoint[] = trimmedHistory.map((pt, i) => ({
    index: i,
    rollingAvg: pt.rollingAvg,
    label: `${pt.displayName} Wk ${pt.week}`,
    seasonID: pt.seasonID,
    displayName: pt.displayName,
  }));

  const averages = chartData.map(d => d.rollingAvg);
  const maxAvg = Math.max(...averages);
  const minAvg = Math.min(...averages);
  const careerHighIdx = chartData.findIndex(d => d.rollingAvg === maxAvg);

  // Y-axis domain
  const range = maxAvg - minAvg;
  const padding = Math.max(range * 0.15, 3);
  const span = (maxAvg + padding) - (minAvg - padding);
  const tickInterval = span <= 20 ? 5 : span <= 40 ? 5 : span <= 80 ? 10 : 15;
  const yMin = Math.floor((minAvg - padding) / tickInterval) * tickInterval;
  const yMax = Math.ceil((maxAvg + padding) / tickInterval) * tickInterval;
  const ticks: number[] = [];
  for (let t = yMin; t <= yMax; t += tickInterval) ticks.push(t);

  // Season boundary lines and label positions
  const seasonBoundaries: number[] = [];
  const seasonLabels: { index: number; label: string }[] = [];
  let seasonStart = 0;
  for (let i = 1; i <= chartData.length; i++) {
    if (i === chartData.length || chartData[i].seasonID !== chartData[i - 1].seasonID) {
      // Boundary at this index
      if (i < chartData.length) seasonBoundaries.push(i);
      // Label at midpoint of the season range
      const mid = Math.round((seasonStart + (i - 1)) / 2);
      seasonLabels.push({ index: mid, label: chartData[seasonStart].displayName });
      seasonStart = i;
    }
  }

  // Custom tick: only show season labels (not every week)
  const labelMap = new Map(seasonLabels.map(sl => [sl.index, sl.label]));

  return (
    <div className="bg-white rounded-lg border border-navy/10 p-6" ref={chartRef}>
      <div className="flex items-start justify-between mb-6">
        <div>
          {bowlerName && (
            <p className="text-sm font-body text-navy/50 mb-0.5">{bowlerName}</p>
          )}
          <SectionHeading className="mb-0">Average Progression</SectionHeading>
        </div>
        <button
          onClick={handleShare}
          disabled={sharing}
          className="inline-flex items-center gap-1.5 text-sm font-body text-navy/50 hover:text-navy transition-colors disabled:opacity-50 mt-1"
          aria-label="Share chart"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          {sharing ? 'Saving...' : 'Share'}
        </button>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="index"
            ticks={seasonLabels.map(sl => sl.index)}
            tickFormatter={(idx: number) => labelMap.get(idx) ?? ''}
            tick={{ fontSize: 11, fill: '#1B2A4A', opacity: 0.6 }}
            tickLine={false}
            axisLine={{ stroke: '#1B2A4A', opacity: 0.1 }}
            type="number"
            domain={[0, chartData.length - 1]}
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
            labelFormatter={(label) => {
              const idx = typeof label === 'number' ? label : Number(label);
              const pt = chartData[idx];
              return pt ? `${pt.displayName} Wk ${trimmedHistory[idx]?.week}` : '';
            }}
            formatter={(value: number | undefined) => [
              value != null ? value.toFixed(1) : '',
              'Rolling Avg',
            ]}
            contentStyle={{
              background: '#FFFBF2',
              border: '1px solid rgba(27,42,74,0.1)',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          />
          {seasonBoundaries.map(idx => (
            <ReferenceLine
              key={`boundary-${idx}`}
              x={idx}
              stroke="#1B2A4A"
              strokeOpacity={0.08}
              strokeDasharray="3 3"
            />
          ))}
          <Line
            type="monotone"
            dataKey="rollingAvg"
            stroke="#1B2A4A"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#1B2A4A' }}
          />
          {careerHighIdx >= 0 && (
            <ReferenceDot
              x={careerHighIdx}
              y={maxAvg}
              r={6}
              fill="#C53030"
              stroke="#FFFBF2"
              strokeWidth={2}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-navy/65 mt-2 font-body">
        27-game rolling average. Red dot marks career high.
      </p>
    </div>
  );
}
