import Link from 'next/link';
import { TrailNav } from '@/components/ui/TrailNav';

interface Season {
  seasonID: number;
  slug: string;
  period: string;
  year: number;
  romanNumeral: string;
  teamCount: number;
  bowlerCount: number;
  champion: string | null;
}

interface SeasonDirectoryProps {
  seasons: Season[];
  currentSlug: string | null;
  trailCurrent: string;
  heading: string;
  subheading: (count: number) => string;
}

export function SeasonDirectory({ seasons, currentSlug, trailCurrent, heading, subheading }: SeasonDirectoryProps) {
  const isStats = trailCurrent === '/stats';
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <TrailNav current={trailCurrent} position="top" />
      <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-2">{heading}</h1>
      <p className="font-body text-navy/65 mb-8">
        {subheading(seasons.length)}
      </p>

      {seasons.length === 0 ? (
        <p className="font-body text-navy/65">No seasons found.</p>
      ) : (
        <>
          {/* Featured current season card */}
          {(() => {
            const current = seasons[0];
            return (
              <div className="mb-8 p-6 bg-white border border-navy/10 border-l-4 border-l-red-600/40 rounded-xl shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-body text-xs sm:text-sm uppercase tracking-wider text-navy/70 bg-navy/10 px-1.5 py-0.5 rounded font-semibold">
                    Current Season
                  </span>
                </div>
                <Link href={`/season/${current.slug}`} className="font-heading text-2xl sm:text-3xl text-navy hover:text-red-600 transition-colors">
                  {current.period} {current.year}
                </Link>
                <p className="font-body text-sm text-navy/65 mt-1">
                  Season {current.romanNumeral}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-sm font-body text-navy/60">
                  <span>
                    <span className="text-navy/65">Teams </span>
                    <span className="font-semibold tabular-nums">{current.teamCount}</span>
                  </span>
                  <span>
                    <span className="text-navy/65">Bowlers </span>
                    <span className="font-semibold tabular-nums">{current.bowlerCount}</span>
                  </span>
                  {current.champion && (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-sm">{'🏆'}</span>
                      <span className="font-semibold text-navy/70">{current.champion}</span>
                    </span>
                  )}
                </div>
                <div className="flex gap-4 mt-4">
                  <Link
                    href={`/season/${current.slug}`}
                    className={`text-sm transition-colors ${
                      isStats ? 'font-medium text-navy/40 hover:text-navy' : 'font-semibold text-red-600/70 hover:text-red-600'
                    }`}
                  >
                    Standings &rarr;
                  </Link>
                  <Link
                    href={`/stats/${current.slug}`}
                    className={`text-sm transition-colors ${
                      isStats ? 'font-semibold text-red-600/70 hover:text-red-600' : 'font-medium text-navy/40 hover:text-navy'
                    }`}
                  >
                    Leaderboards &rarr;
                  </Link>
                  <Link
                    href={`/week#season-${current.slug}`}
                    className="text-sm font-medium text-navy/40 hover:text-navy transition-colors"
                  >
                    League Nights &rarr;
                  </Link>
                </div>
              </div>
            );
          })()}

          {/* Gradient divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-navy/15 to-transparent mb-8" />

          {/* Past seasons */}
          {seasons.length > 1 && (
            <div>
              <h2 className="font-heading text-lg text-navy/70 mb-4">Past Seasons</h2>
              <div className="space-y-2">
                {seasons.slice(1).map((season) => (
                  <div
                    key={season.seasonID}
                    className="flex items-center justify-between gap-2 px-4 py-3.5 bg-white rounded-xl border border-navy/8 hover:border-navy/15 hover:shadow-sm transition-all group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <Link
                          href={`/season/${season.slug}`}
                          className="font-heading text-lg text-navy hover:text-red-600 transition-colors"
                        >
                          {season.period} {season.year}
                        </Link>
                        <span className="font-body text-sm text-navy/50">
                          {season.romanNumeral}
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs font-body text-navy/55 mt-0.5">
                        <span className="tabular-nums">{season.teamCount} teams</span>
                        <span className="tabular-nums">{season.bowlerCount} bowlers</span>
                        {season.champion && (
                          <span className="inline-flex items-center gap-1">
                            <span className="text-xs">{'🏆'}</span>
                            <span className="text-navy/65">{season.champion}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3 shrink-0">
                      <Link
                        href={`/season/${season.slug}`}
                        className={`text-xs font-body transition-colors ${
                          isStats ? 'font-medium text-navy/35 hover:text-navy' : 'font-semibold text-red-600/60 hover:text-red-600'
                        }`}
                      >
                        Standings
                      </Link>
                      <Link
                        href={`/stats/${season.slug}`}
                        className={`text-xs font-body transition-colors ${
                          isStats ? 'font-semibold text-red-600/60 hover:text-red-600' : 'font-medium text-navy/35 hover:text-navy'
                        }`}
                      >
                        Stats
                      </Link>
                      <Link
                        href={`/week#season-${season.slug}`}
                        className="text-xs font-body font-medium text-navy/35 hover:text-navy transition-colors"
                      >
                        Nights
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <TrailNav current={trailCurrent} />
    </main>
  );
}
