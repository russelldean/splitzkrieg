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

/** Map 0-9 points to a color from blue (cold) through yellow to red (hot). */
function heatColor(pts: number): string {
  // 0-1: deep blue, 2-3: blue, 4-5: neutral, 6-7: orange, 8-9: red
  const colors = [
    '#1E3A8A', // 0
    '#2563EB', // 1
    '#3B82F6', // 2
    '#93C5FD', // 3
    '#E5E7EB', // 4
    '#FDE68A', // 5
    '#FBBF24', // 6
    '#F59E0B', // 7
    '#EA580C', // 8
    '#DC2626', // 9
  ];
  return colors[Math.min(9, Math.max(0, pts))] ?? '#E5E7EB';
}

function textColor(pts: number): string {
  // Light text on dark backgrounds (0-2, 8-9), dark text on light backgrounds
  if (pts <= 2 || pts >= 8) return '#FFFFFF';
  return '#1B2A4A';
}

export function WeeklyHeatmap({ raceData, standings }: Props) {
  if (raceData.length === 0 || standings.length === 0) return null;

  const weeks = Array.from(new Set(raceData.map(r => r.week))).sort((a, b) => a - b);

  // Compute per-week points (delta from previous week's totalPts)
  const teamWeekPts = standings.map((s) => {
    const weekPts = weeks.map((w, i) => {
      const thisWeek = raceData.find(r => r.teamID === s.teamID && r.week === w)?.totalPts ?? 0;
      const prevWeek = i > 0
        ? (raceData.find(r => r.teamID === s.teamID && r.week === weeks[i - 1])?.totalPts ?? 0)
        : 0;
      return thisWeek - prevWeek;
    });
    const total = raceData.find(r => r.teamID === s.teamID && r.week === weeks[weeks.length - 1])?.totalPts ?? 0;
    return { ...s, weekPts, total };
  });

  return (
    <div>
      <p className="font-body text-sm text-navy/60 mb-4">
        Points earned each week (0-9). Red = team is hot.
      </p>
    <div className="bg-white border border-navy/10 rounded-lg shadow-sm overflow-x-auto">
      <table className="w-full text-sm font-body">
        <thead>
          <tr className="border-b border-navy/10 bg-navy/[0.02] text-navy/65 text-xs uppercase tracking-wider">
            <th className="px-3 py-2 text-left sticky left-0 bg-[#F7F5F0] z-10">Team</th>
            {weeks.map(w => (
              <th key={w} className="px-1 py-2 text-center w-10">Wk{w}</th>
            ))}
            <th className="px-3 py-2 text-right">Tot</th>
          </tr>
        </thead>
        <tbody>
          {teamWeekPts.map((t, i) => (
            <tr key={t.teamID} className="border-b border-navy/5">
              <td className="px-3 py-1 whitespace-nowrap sticky left-0 bg-white z-10">
                <span className="text-navy/50 tabular-nums mr-2">{i + 1}</span>
                <Link href={`/team/${t.teamSlug}`} className="text-navy hover:text-red-600 transition-colors text-xs sm:text-sm">
                  {t.teamName}
                </Link>
              </td>
              {t.weekPts.map((pts, wi) => (
                <td key={wi} className="px-0 py-1 text-center">
                  <div
                    className="mx-auto w-8 h-7 rounded flex items-center justify-center text-xs font-semibold tabular-nums"
                    style={{ backgroundColor: heatColor(pts), color: textColor(pts) }}
                  >
                    {pts}
                  </div>
                </td>
              ))}
              <td className="px-3 py-1 text-right tabular-nums font-semibold">{t.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Legend */}
      <div className="flex items-center justify-center gap-1 px-3 py-2 border-t border-navy/5">
        <span className="text-[10px] text-navy/40 mr-1">0</span>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <div
            key={n}
            className="w-4 h-3 rounded-sm"
            style={{ backgroundColor: heatColor(n) }}
          />
        ))}
        <span className="text-[10px] text-navy/40 ml-1">9</span>
      </div>
    </div>
    </div>
  );
}
