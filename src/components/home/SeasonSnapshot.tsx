import Link from 'next/link';
import { strikeX } from '@/components/ui/StrikeX';
import { MiniHeatCheck } from '@/components/season/MiniHeatCheck';
import type { SeasonSnapshot as SeasonSnapshotType } from '@/lib/queries';

interface SeasonSnapshotProps {
  snapshot: SeasonSnapshotType | null;
}

function StatValue({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="font-heading text-2xl text-navy tabular-nums">{value}</div>
      <div className="text-xs font-body text-navy/60 mt-0.5">{label}</div>
    </div>
  );
}

function LeaderRow({ label, name, slug, value }: { label: string; name: string; slug: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs font-body text-navy/60 uppercase tracking-wider">{label}</span>
      <div className="text-right">
        <Link href={`/bowler/${slug}`} className="text-sm text-navy hover:text-red transition-colors">
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
        <p className="font-body text-sm text-navy/60">
          No season data available yet. Check back when the games start rolling.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-navy/10 shadow-sm px-6 pt-4 pb-6 sm:pb-10 min-h-[180px]">
      <div className="flex items-baseline justify-between mb-5 sm:mb-6">
        <h3 className="font-heading text-lg text-navy">
          Season {strikeX(snapshot.romanNumeral)}
          <span className="text-navy/40 mx-1.5">&middot;</span>
          <span className="text-navy">Week {snapshot.weekNumber}</span>
        </h3>
        <Link
          href={`/stats/${snapshot.slug}`}
          className="text-xs font-body text-navy/60 hover:text-red-600 transition-colors"
        >
          Full leaderboards &rarr;
        </Link>
      </div>

      {/* Heat Check + Weekly Highlights side by side */}
      {snapshot.expectedLeagueAverage > 0 ? (
        <div className="flex items-start gap-5">
          {/* Left: Heat Check */}
          <div className="shrink-0">
            <div className="text-xs font-body text-navy/60 uppercase tracking-wider mb-2">League Heat Check</div>
            <MiniHeatCheck
              pinsOverPerGame={Math.round((snapshot.leagueAverage - snapshot.expectedLeagueAverage) * 10) / 10}
              leagueAvg={snapshot.leagueAverage}
              expectedAvg={snapshot.expectedLeagueAverage}
              bowlerCount={snapshot.totalBowlers}
            />
          </div>

          {/* Right: BOTW / TOTW */}
          <div className="flex-1 min-w-0 border-l border-navy/5 pl-5 space-y-3 sm:space-y-5">
            {snapshot.bowlerOfTheWeek && (
              <div>
                <div className="text-xs font-body text-navy/60 uppercase tracking-wider mb-0.5">Bowler of the Week</div>
                <Link href={`/bowler/${snapshot.bowlerOfTheWeek.slug}`} className="text-sm font-heading text-navy hover:text-red transition-colors">
                  {snapshot.bowlerOfTheWeek.bowlerName}
                </Link>
                <span className="text-sm font-body text-navy/60 ml-1.5 sm:ml-2">{snapshot.bowlerOfTheWeek.score}</span>
              </div>
            )}
            {snapshot.teamOfTheWeek && (
              <div>
                <div className="text-xs font-body text-navy/60 uppercase tracking-wider mb-0.5">Team of the Week</div>
                <Link href={`/team/${snapshot.teamOfTheWeek.teamSlug}`} className="text-sm font-heading text-navy hover:text-red transition-colors">
                  {snapshot.teamOfTheWeek.teamName}
                </Link>
                <span className="text-sm font-body text-navy/60 ml-1.5 sm:ml-2">{snapshot.teamOfTheWeek.score.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex justify-around items-start mb-4 pb-4 border-b border-navy/5">
          <StatValue label="Bowlers" value={snapshot.totalBowlers} />
          <StatValue label="League Avg" value={snapshot.leagueAverage.toFixed(1)} />
        </div>
      )}

    </div>
  );
}
