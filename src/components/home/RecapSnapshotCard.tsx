import Link from 'next/link';
import Image from 'next/image';
import { MiniHeatCheck } from '@/components/season/MiniHeatCheck';
import type { PostMeta } from '@/lib/blog';
import type { SeasonSnapshot } from '@/lib/queries';

interface Props {
  post: PostMeta;
  snapshot: SeasonSnapshot;
}

export function RecapSnapshotCard({ post, snapshot }: Props) {
  const image = post.cardImage || post.heroImage;

  return (
    <div className="bg-white rounded-xl border border-navy/10 shadow-sm overflow-hidden">
      <div className="md:flex">
        {/* Left: recap image + link */}
        {image && (
          <Link
            href={`/blog/${post.slug}`}
            className="relative block md:flex-1 h-40 md:h-auto md:min-h-[180px] overflow-hidden group"
          >
            <Image
              src={image}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              style={post.cardFocalY != null ? { objectPosition: `center ${Math.min(1, post.cardFocalY + 0.1) * 100}%` } : undefined}
              sizes="(max-width: 768px) 100vw, 45vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-black/10" />
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-3 md:bottom-0">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-body uppercase tracking-wider bg-red-600 text-white mb-1">
                Week {post.week} Recap
              </span>
              <div className="font-heading text-sm text-white group-hover:text-red-300 transition-colors">
                Read the full recap &rarr;
              </div>
            </div>
          </Link>
        )}

        {/* Right: snapshot data */}
        <div className="md:w-[55%] md:flex-shrink-0 px-6 pt-4 pb-4">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-heading text-lg text-navy">
              Week {snapshot.weekNumber} Highlights
            </h3>
            <Link
              href={`/stats/${snapshot.slug}`}
              className="text-xs font-body text-navy/60 hover:text-red-600 transition-colors"
            >
              Full leaderboards &rarr;
            </Link>
          </div>

          <div className="flex items-start gap-5">
            {/* Heat Check */}
            {snapshot.expectedLeagueAverage > 0 && (
              <div className="shrink-0">
                <div className="text-xs font-body text-navy/60 uppercase tracking-wider mb-2">League Heat Check</div>
                <MiniHeatCheck
                  pinsOverPerGame={Math.round((snapshot.leagueAverage - snapshot.expectedLeagueAverage) * 10) / 10}
                  leagueAvg={snapshot.leagueAverage}
                  expectedAvg={snapshot.expectedLeagueAverage}
                  bowlerCount={snapshot.totalBowlers}
                />
              </div>
            )}

            {/* BOTW / TOTW side by side */}
            <div className="flex-1 min-w-0 border-l border-navy/5 pl-5 flex flex-col sm:flex-row gap-3 sm:gap-6">
              {(() => {
                const botw = snapshot.bowlersOfTheWeek ?? [];
                if (botw.length === 0) return null;
                return (
                  <div className="flex-1">
                    <div className="text-xs font-body text-navy/60 uppercase tracking-wider mb-0.5">
                      {botw.length > 1 ? 'Bowlers of the Week' : 'Bowler of the Week'}
                    </div>
                    <div className="text-lg">
                      {botw.map((b, i) => (
                        <span key={b.slug}>
                          <Link href={`/bowler/${b.slug}`} className="font-heading text-navy hover:text-red transition-colors">
                            {b.bowlerName}
                          </Link>
                          {i < botw.length - 1 && <span className="font-body text-navy/60"> &amp; </span>}
                        </span>
                      ))}
                    </div>
                    <div className="text-sm font-body text-navy/60 mt-0.5">{botw[0].score}</div>
                  </div>
                );
              })()}
              {snapshot.teamOfTheWeek && (
                <div className="flex-1">
                  <div className="text-xs font-body text-navy/60 uppercase tracking-wider mb-0.5">Team of the Week</div>
                  <Link href={`/team/${snapshot.teamOfTheWeek.teamSlug}`} className="text-lg font-heading text-navy hover:text-red transition-colors">
                    {snapshot.teamOfTheWeek.teamName}
                  </Link>
                  <div className="text-sm font-body text-navy/60 mt-0.5">{snapshot.teamOfTheWeek.score.toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
