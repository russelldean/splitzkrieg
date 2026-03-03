import Link from 'next/link';
import type { SeasonSnapshot as SeasonSnapshotType } from '@/lib/queries';

interface SeasonSnapshotProps {
  snapshot: SeasonSnapshotType | null;
}

function StatValue({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="font-heading text-2xl text-navy">{value}</div>
      <div className="text-xs font-body text-navy/50 mt-0.5">{label}</div>
    </div>
  );
}

function LeaderRow({ label, name, slug, value }: { label: string; name: string; slug: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs font-body text-navy/50 uppercase tracking-wider">{label}</span>
      <div className="text-right">
        <Link href={`/bowler/${slug}`} className="text-sm font-medium text-navy hover:text-red transition-colors">
          {name}
        </Link>
        <span className="text-sm text-navy/60 ml-2">{value}</span>
      </div>
    </div>
  );
}

export function SeasonSnapshot({ snapshot }: SeasonSnapshotProps) {
  if (!snapshot) {
    return (
      <div className="bg-white rounded-xl border border-navy/10 p-6 flex flex-col items-center justify-center text-center min-h-[180px]">
        <p className="font-heading text-lg text-navy mb-2">Season Data</p>
        <p className="font-body text-sm text-navy/50">
          No season data available yet. Check back when the games start rolling.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-navy/10 p-6 min-h-[180px]">
      <h3 className="font-heading text-lg text-navy mb-4">
        Season {snapshot.romanNumeral}
      </h3>

      {/* Aggregate stats */}
      <div className="flex justify-around mb-4 pb-4 border-b border-navy/5">
        <StatValue label="Bowlers" value={snapshot.totalBowlers} />
        <StatValue label="Games" value={snapshot.totalGames.toLocaleString()} />
        <StatValue label="Nights" value={snapshot.totalNights} />
      </div>

      {/* Top performers */}
      <div className="space-y-0.5">
        {snapshot.topAverage && (
          <LeaderRow
            label="Top Avg"
            name={snapshot.topAverage.bowlerName}
            slug={snapshot.topAverage.slug}
            value={snapshot.topAverage.average.toFixed(1)}
          />
        )}
        {snapshot.highGame && (
          <LeaderRow
            label="High Game"
            name={snapshot.highGame.bowlerName}
            slug={snapshot.highGame.slug}
            value={String(snapshot.highGame.score)}
          />
        )}
        {snapshot.highSeries && (
          <LeaderRow
            label="High Series"
            name={snapshot.highSeries.bowlerName}
            slug={snapshot.highSeries.slug}
            value={String(snapshot.highSeries.score)}
          />
        )}
      </div>
    </div>
  );
}
