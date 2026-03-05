'use client';

import type { SeasonFullStatsRow } from '@/lib/queries';

interface Props {
  stats: SeasonFullStatsRow[];
}

/**
 * Placeholder for full stats table -- implemented in Task 2.
 */
export function FullStatsTable({ stats }: Props) {
  if (stats.length === 0) {
    return (
      <section>
        <h2 className="font-heading text-2xl text-navy mb-4">Full Stats</h2>
        <p className="font-body text-navy/50">No stats data available.</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-heading text-2xl text-navy mb-4">Full Stats</h2>
      <p className="font-body text-navy/50">Loading stats table...</p>
    </section>
  );
}
