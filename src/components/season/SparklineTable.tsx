'use client';

import Link from 'next/link';
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

/** Tiny inline SVG sparkline showing points trajectory. */
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const pad = 2;

  const coords = points.map((v, i) => ({
    x: pad + (i / (points.length - 1)) * (w - pad * 2),
    y: pad + (1 - (v - min) / range) * (h - pad * 2),
  }));

  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

  return (
    <svg width={w} height={h} className="inline-block">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dot on last point */}
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="2.5" fill={color} />
    </svg>
  );
}

const COLORS = [
  '#1B2A4A', '#C53030', '#2B6CB0', '#38A169', '#D69E2E',
  '#805AD5', '#DD6B20', '#319795', '#E53E3E', '#3182CE',
  '#48BB78', '#ECC94B', '#9F7AEA', '#ED8936', '#4FD1C5',
  '#F56565', '#667EEA', '#68D391', '#FC8181', '#B794F4',
];

export function SparklineTable({ raceData, standings }: Props) {
  if (raceData.length === 0 || standings.length === 0) return null;

  const weeks = Array.from(new Set(raceData.map(r => r.week))).sort((a, b) => a - b);

  // Build per-team points arrays and compute last week delta
  const teamData = standings.map((s, i) => {
    const pts = weeks.map(w => {
      const row = raceData.find(r => r.teamID === s.teamID && r.week === w);
      return row?.totalPts ?? 0;
    });
    const lastWeekPts = pts.length >= 2 ? pts[pts.length - 1] - pts[pts.length - 2] : 0;
    return {
      ...s,
      pts,
      total: pts[pts.length - 1] ?? 0,
      lastWeekPts,
      color: COLORS[i % COLORS.length],
    };
  });

  return (
    <div className="bg-white border border-navy/10 rounded-lg shadow-sm overflow-x-auto">
      <table className="w-full text-sm font-body">
        <thead>
          <tr className="border-b border-navy/10 bg-navy/[0.02] text-navy/65 text-xs uppercase tracking-wider">
            <th className="px-3 py-2 text-left w-8">#</th>
            <th className="px-3 py-2 text-left">Team</th>
            <th className="px-3 py-2 text-center">Trend</th>
            <th className="px-3 py-2 text-right">Pts</th>
            <th className="px-3 py-2 text-right">Last</th>
          </tr>
        </thead>
        <tbody>
          {teamData.map((t, i) => (
            <tr key={t.teamID} className="border-b border-navy/5 hover:bg-navy/[0.02] transition-colors">
              <td className="px-3 py-1.5 text-navy/50 tabular-nums">{i + 1}</td>
              <td className="px-3 py-1.5">
                <Link href={`/team/${t.teamSlug}`} className="text-navy hover:text-red-600 transition-colors">
                  {t.teamName}
                </Link>
              </td>
              <td className="px-3 py-1.5 text-center">
                <Sparkline points={t.pts} color={t.color} />
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{t.total}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-navy/60">+{t.lastWeekPts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
