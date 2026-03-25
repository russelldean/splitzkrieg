import Link from 'next/link';
import { strikeX } from '@/components/ui/StrikeX';
import type { SeasonSnapshot as SeasonSnapshotType } from '@/lib/queries';

interface SeasonSnapshotProps {
  snapshot: SeasonSnapshotType | null;
}

function StatValue({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="font-heading text-2xl text-navy tabular-nums">{value}</div>
      <div className="text-xs font-body text-navy/65 mt-0.5">{label}</div>
    </div>
  );
}

function LeaderRow({ label, name, slug, value }: { label: string; name: string; slug: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs font-body text-navy/65 uppercase tracking-wider">{label}</span>
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
      <div className="bg-white rounded-xl border border-navy/10 shadow-sm p-6 flex flex-col items-center justify-center text-center min-h-[180px]">
        <p className="font-heading text-lg text-navy mb-2">Season Data</p>
        <p className="font-body text-sm text-navy/65">
          No season data available yet. Check back when the games start rolling.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-navy/10 shadow-sm min-h-[180px] overflow-hidden">
      <div className="flex items-baseline justify-between px-6 py-3 bg-amber-50/50 border-b border-amber-200/50">
        <h3 className="font-heading text-lg text-navy">
          Season {strikeX(snapshot.romanNumeral)}
          <span className="ml-2 text-sm font-body text-navy/50">Week {snapshot.weekNumber}</span>
        </h3>
        <Link
          href={`/stats/${snapshot.slug}`}
          className="text-xs font-body text-navy/65 hover:text-red-600 transition-colors"
        >
          Full leaderboards &rarr;
        </Link>
      </div>
      <div className="p-6">

      {/* Aggregate stats */}
      <div className="flex justify-around items-start mb-4 pb-4 border-b border-navy/5">
        <StatValue label="Bowlers" value={snapshot.totalBowlers} />
        {snapshot.expectedLeagueAverage > 0
          ? <StatValue label="League Avg / Expected" value={`${snapshot.leagueAverage.toFixed(1)} / ${snapshot.expectedLeagueAverage.toFixed(1)}`} />
          : <StatValue label="League Avg" value={snapshot.leagueAverage.toFixed(1)} />
        }
        {snapshot.expectedLeagueAverage > 0 && (() => {
          const delta = snapshot.leagueAverage - snapshot.expectedLeagueAverage;
          const sign = delta >= 0 ? '+' : '';
          const label = delta >= 0 ? 'Above Expected' : 'Below Expected';
          const colorClass = delta >= 0 ? 'text-green-600' : 'text-red-600';
          return (
            <div className="text-center">
              <div className={`font-heading text-2xl ${colorClass}`}>{sign}{delta.toFixed(1)}</div>
              <div className="text-xs font-body text-navy/65 mt-0.5">{label}</div>
            </div>
          );
        })()}
      </div>

      {/* Weekly highlights */}
      <div className="space-y-0.5">
        {snapshot.bowlerOfTheWeek && (
          <LeaderRow
            label="Bowler of the Week"
            name={snapshot.bowlerOfTheWeek.bowlerName}
            slug={snapshot.bowlerOfTheWeek.slug}
            value={String(snapshot.bowlerOfTheWeek.score)}
          />
        )}
        {snapshot.teamOfTheWeek && (
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs font-body text-navy/65 uppercase tracking-wider">Team of the Week</span>
            <div className="text-right">
              <Link href={`/team/${snapshot.teamOfTheWeek.teamSlug}`} className="text-sm font-medium text-navy hover:text-red transition-colors">
                {snapshot.teamOfTheWeek.teamName}
              </Link>
              <span className="text-sm text-navy/60 ml-2">{snapshot.teamOfTheWeek.score.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
