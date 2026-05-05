import Link from 'next/link';
import { formatMatchDate } from '@/lib/bowling-time';

interface PlayoffSeed {
  teamName: string;
  teamSlug: string;
}

interface PlayoffMatchup {
  divisionName: string;
  topSeed: PlayoffSeed;
  secondSeed: PlayoffSeed;
}

interface Props {
  matchups: PlayoffMatchup[];
  matchDate: string | Date | null;
}

export function PlayoffsNextWeek({ matchups, matchDate }: Props) {
  if (matchups.length === 0) return null;

  const dateStr = formatMatchDate(matchDate, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="bg-white rounded-xl border border-red-600/20 shadow-sm px-6 pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <h3 className="font-heading text-lg text-navy">Up Next</h3>
          <p className="text-xs font-body text-navy/60">
            Playoffs &middot; Round 1{dateStr && <> &middot; {dateStr}</>}
          </p>
        </div>
        <span className="text-[10px] font-body uppercase tracking-wider text-red-600 font-semibold">
          Playoffs
        </span>
      </div>

      <div className="space-y-3 mt-4">
        {matchups.map((m) => (
          <div key={m.divisionName} className="border-t border-navy/5 pt-3 first:border-t-0 first:pt-0">
            <div className="text-[11px] font-body uppercase tracking-wider text-navy/50 mb-1">
              {m.divisionName}
            </div>
            <div className="flex items-center justify-between py-1">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-body text-navy/40 mr-1.5 tabular-nums">#1</span>
                <Link
                  href={`/team/${m.topSeed.teamSlug}`}
                  className="text-sm text-navy hover:text-red-600 transition-colors"
                >
                  {m.topSeed.teamName}
                </Link>
              </div>
              <span className="text-navy/60 text-xs px-2">vs</span>
              <div className="flex-1 min-w-0 text-right">
                <Link
                  href={`/team/${m.secondSeed.teamSlug}`}
                  className="text-sm text-navy hover:text-red-600 transition-colors"
                >
                  {m.secondSeed.teamName}
                </Link>
                <span className="text-[10px] font-body text-navy/40 ml-1.5 tabular-nums">#2</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
