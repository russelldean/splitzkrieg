'use client';
import dynamic from 'next/dynamic';
import type { RollingAvgPoint } from '@/lib/queries';

const AverageProgressionChart = dynamic(
  () => import('./AverageProgressionChart').then(m => m.AverageProgressionChart),
  { ssr: false }
);

export function AverageProgressionChartLazy({ history, bowlerName }: { history: RollingAvgPoint[]; bowlerName?: string }) {
  return <AverageProgressionChart history={history} bowlerName={bowlerName} />;
}
