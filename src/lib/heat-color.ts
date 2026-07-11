/**
 * Weekly-points heat scale (0-9): deep blue (cold) through neutral to red (hot).
 * Matches the season standings weekly heatmap.
 */
const HEAT_COLORS = [
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

export function heatColor(pts: number): string {
  return HEAT_COLORS[Math.min(9, Math.max(0, pts))] ?? '#E5E7EB';
}

/** Light text on the dark ends (0-2, 8-9), dark text on the light middle. */
export function heatTextColor(pts: number): string {
  if (pts <= 2 || pts >= 8) return '#FFFFFF';
  return '#1B2A4A';
}
