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

interface Final {
  team1Name: string;
  team1Slug: string;
  team2Name: string;
  team2Slug: string;
}

interface BracketField {
  title: string;
  bowlers: Array<{ bowlerName: string; slug: string }>;
}

interface Props {
  matchups: PlayoffMatchup[];
  matchDate: string | Date | null;
  seasonSlug: string;
  /** When semifinals are complete and a Final matchup exists, render the
   *  upcoming championship instead of the original semi seeds. */
  final?: Final | null;
  finalDate?: string | Date | null;
  brackets?: BracketField[];
}

export function PlayoffsNextWeek({ matchups, matchDate, seasonSlug, final, finalDate, brackets }: Props) {
  if (final) {
    const dateStr = formatMatchDate(finalDate ?? null, { weekday: 'short', month: 'short', day: 'numeric' });
    return (
      <Link
        href={`/playoffs/${seasonSlug}/2`}
        className="group flex flex-col bg-white rounded-xl border border-amber-300/60 shadow-sm hover:shadow-md hover:border-amber-400 transition-all px-6 pt-4 pb-6 md:h-full"
      >
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <h3 className="font-heading text-lg text-navy group-hover:text-red-600 transition-colors">Up Next</h3>
            <p className="text-xs font-body text-navy/60">
              Championship Night{dateStr && <> &middot; {dateStr}</>}
            </p>
          </div>
          <span className="text-[10px] font-heading uppercase tracking-wider text-amber-700 font-semibold">
            Finals
          </span>
        </div>

        {/* Team final - big focal point */}
        <div className="mt-3 mb-3 pb-3 border-b border-amber-200/60">
          <div className="text-[10px] uppercase tracking-wider text-amber-700/80 font-heading mb-1.5 text-center">Team Final</div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0 text-center">
              <div className="font-heading text-base text-navy truncate">{final.team1Name}</div>
            </div>
            <span className="font-heading text-sm uppercase tracking-wider text-amber-700 shrink-0">vs</span>
            <div className="flex-1 min-w-0 text-center">
              <div className="font-heading text-base text-navy truncate">{final.team2Name}</div>
            </div>
          </div>
        </div>

        {/* Individual brackets */}
        {brackets && brackets.length > 0 && (
          <div className="flex-1 flex flex-col justify-around gap-3">
            {brackets.map((bracket, idx) => {
              const half = Math.ceil(bracket.bowlers.length / 2);
              const left = bracket.bowlers.slice(0, half);
              const right = bracket.bowlers.slice(half);
              return (
                <div
                  key={bracket.title}
                  className={idx < brackets.length - 1 ? 'pb-3 border-b border-amber-200/60' : ''}
                >
                  <div className="text-[10px] uppercase tracking-wider text-amber-700/80 font-heading mb-1.5 text-center">
                    {bracket.title}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-heading text-sm text-navy text-center">
                    <div className="space-y-1">
                      {left.map(b => <div key={b.slug}>{b.bowlerName}</div>)}
                    </div>
                    <div className="space-y-1">
                      {right.map(b => <div key={b.slug}>{b.bowlerName}</div>)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Link>
    );
  }

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
                <Link href={`/team/${m.topSeed.teamSlug}`} className="text-sm text-navy hover:text-red-600 transition-colors">
                  {m.topSeed.teamName}
                </Link>
              </div>
              <span className="text-navy/60 text-xs px-2">vs</span>
              <div className="flex-1 min-w-0 text-right">
                <Link href={`/team/${m.secondSeed.teamSlug}`} className="text-sm text-navy hover:text-red-600 transition-colors">
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
