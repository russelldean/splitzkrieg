/**
 * All-Time Stats hub page.
 * Directory linking to all-time leaderboards, records, and deep cuts.
 * Each section shows a mini preview of the data behind the link.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { SectionHeading } from '@/components/ui/SectionHeading';
import {
  getAllTimeLeaderboard,
  getHighGameProgression,
  getGameProfiles,
  getAllPlayoffHistory,
  getAllIndividualChampions,
} from '@/lib/queries';

export const metadata: Metadata = {
  title: 'All-Time Stats | Splitzkrieg',
  description:
    'All-time leaderboards, records, and championship history across 35+ seasons of Splitzkrieg Bowling League.',
};

export default async function AllTimeStatsPage() {
  const [leaderboard, playoffHistory, individualChampions, highGameData, profileData] = await Promise.all([
    getAllTimeLeaderboard(),
    getAllPlayoffHistory(),
    getAllIndividualChampions(),
    getHighGameProgression(),
    getGameProfiles(),
  ]);

  // Career Leaderboard preview: top 3 by games bowled
  const top3Games = [...leaderboard].sort((a, b) => b.gamesBowled - a.gamesBowled).slice(0, 3);

  // Team Championships preview: most recent champion
  const latestPlayoff = playoffHistory[0];

  // Individual Champions preview: most recent season
  const latestIndividual = individualChampions[0];

  // High Game Record: all holders of the current record score
  const currentRecordScore = highGameData.records[highGameData.records.length - 1]?.score;
  const recordHolders = currentRecordScore
    ? highGameData.records.filter(r => r.score === currentRecordScore)
    : [];

  // Game Profiles: archetype distribution
  const archetypeCounts = { 'Fast Starter': 0, 'Middle Child': 0, 'Late Bloomer': 0, 'Flatliner': 0 };
  for (const row of profileData.leaderboard) {
    archetypeCounts[row.archetype]++;
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
      <div className="flex items-center gap-2 text-sm font-body text-navy/65 mb-4">
        <Link href="/stats" className="hover:text-red-600 transition-colors">Stats</Link>
        <span className="text-navy/60">/</span>
        <span className="text-navy/70">All-Time</span>
      </div>

      <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy">
        All-Time Stats
      </h1>
      <p className="font-body text-lg text-navy/60 mt-1">
        35+ seasons of Splitzkrieg bowling history
      </p>

      {/* Leaderboards & Championships */}
      <div className="mt-10">
        <SectionHeading>Leaderboards &amp; Championships</SectionHeading>
        <div className="space-y-6">

          {/* Career Leaderboard */}
          <div>
            <h3 className="font-heading text-lg text-navy">Career Leaderboard</h3>
            <p className="font-body text-sm text-navy/65 mt-1">All-time career stats for every bowler in league history</p>
            {top3Games.length > 0 && (
              <div className="mt-2 bg-white border border-navy/10 rounded-lg shadow-sm overflow-hidden">
                {top3Games.map((row, i) => (
                  <div key={row.slug} className="flex items-center justify-between px-3 py-1.5 text-sm font-body border-b border-navy/5 last:border-b-0">
                    <span className="truncate">
                      <span className="text-navy/65 tabular-nums mr-1.5">{i + 1}.</span>
                      <Link href={`/bowler/${row.slug}`} className={`text-navy hover:text-red-600 transition-colors ${i === 0 ? 'font-bold' : ''}`}>
                        {row.bowlerName}
                      </Link>
                    </span>
                    <span className={`tabular-nums shrink-0 ml-2 ${i === 0 ? 'font-bold text-navy' : 'text-navy/60'}`}>
                      {row.gamesBowled.toLocaleString()} games
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Link href="/stats/all-time/career-leaderboard" className="inline-block mt-2 text-sm text-red-600 hover:text-red-700 font-body">
              Full leaderboard &rarr;
            </Link>
          </div>

          {/* Team Championships */}
          <div>
            <h3 className="font-heading text-lg text-navy">Team Championships</h3>
            <p className="font-body text-sm text-navy/65 mt-1">Playoff and championship history across all seasons</p>
            {latestPlayoff && (
              <div className="mt-2 bg-white border border-navy/10 rounded-lg shadow-sm px-3 py-2">
                <p className="font-body text-sm text-navy">
                  <span className="text-navy/65">Latest:</span>{' '}
                  <span className="font-semibold">{latestPlayoff.championHistoricName ?? latestPlayoff.championName}</span>
                  <span className="text-navy/60"> def. </span>
                  <span>{latestPlayoff.runnerUpHistoricName ?? latestPlayoff.runnerUpName}</span>
                  <span className="text-navy/60"> ({latestPlayoff.displayName})</span>
                </p>
              </div>
            )}
            <Link href="/stats/all-time/team-championships" className="inline-block mt-2 text-sm text-red-600 hover:text-red-700 font-body">
              Full championship history &rarr;
            </Link>
          </div>

          {/* Individual Champions */}
          <div>
            <h3 className="font-heading text-lg text-navy">Individual Champions</h3>
            <p className="font-body text-sm text-navy/65 mt-1">Scratch and handicap champions across all seasons</p>
            {latestIndividual && (
              <div className="mt-2 bg-white border border-navy/10 rounded-lg shadow-sm px-3 py-2 font-body text-sm">
                <p className="text-navy/65 mb-1">{latestIndividual.displayName}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {latestIndividual.mensScratchName && (
                    <span className="text-navy">
                      <span className="text-navy/60">Men's: </span>
                      <Link href={`/bowler/${latestIndividual.mensScratchSlug}`} className="font-semibold hover:text-red-600 transition-colors">{latestIndividual.mensScratchName}</Link>
                    </span>
                  )}
                  {latestIndividual.womensScratchName && (
                    <span className="text-navy">
                      <span className="text-navy/60">Women's: </span>
                      <Link href={`/bowler/${latestIndividual.womensScratchSlug}`} className="font-semibold hover:text-red-600 transition-colors">{latestIndividual.womensScratchName}</Link>
                    </span>
                  )}
                  {latestIndividual.handicapName && (
                    <span className="text-navy">
                      <span className="text-navy/60">Handicap: </span>
                      <Link href={`/bowler/${latestIndividual.handicapSlug}`} className="font-semibold hover:text-red-600 transition-colors">{latestIndividual.handicapName}</Link>
                    </span>
                  )}
                </div>
              </div>
            )}
            <Link href="/stats/all-time/individual-champions" className="inline-block mt-2 text-sm text-red-600 hover:text-red-700 font-body">
              All individual champions &rarr;
            </Link>
          </div>

        </div>
      </div>

      {/* Deep Cuts */}
      <div className="mt-10">
        <SectionHeading>Deep Cuts</SectionHeading>
        <p className="font-body text-sm text-navy/65 -mt-2 mb-6">
          Statistical one-offs and record progressions
        </p>
        <div className="space-y-6">

          {/* High Game Record */}
          <div>
            <h3 className="font-heading text-lg text-navy">High Game Record</h3>
            <p className="font-body text-sm text-navy/65 mt-1">How the all-time high scratch game record has progressed across seasons</p>
            {recordHolders.length > 0 && (
              <div className="mt-2 bg-white border border-navy/10 rounded-lg shadow-sm px-3 py-2">
                <p className="font-body text-sm text-navy">
                  <span className="text-navy/65">Current record:</span>{' '}
                  <span className="font-bold text-2xl tabular-nums">{currentRecordScore}</span>
                </p>
                <div className="mt-1 space-y-0.5">
                  {recordHolders.map((r, i) => (
                    <p key={`${r.slug}-${i}`} className="font-body text-sm text-navy">
                      <Link href={`/bowler/${r.slug}`} className="font-semibold hover:text-red-600 transition-colors">{r.bowlerName}</Link>
                      <span className="text-navy/60"> ({r.displayName})</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
            <Link href="/stats/all-time/high-game-record" className="inline-block mt-2 text-sm text-red-600 hover:text-red-700 font-body">
              Full record progression &rarr;
            </Link>
          </div>

          {/* League Night Profiles */}
          <div>
            <h3 className="font-heading text-lg text-navy">League Night Profiles</h3>
            <p className="font-body text-sm text-navy/65 mt-1">Are you a Fast Starter, Middle Child, Late Bloomer, or Flatliner?</p>
            <div className="mt-2 bg-white border border-navy/10 rounded-lg shadow-sm px-3 py-2">
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-body text-sm">
                {(Object.entries(archetypeCounts) as [string, number][]).map(([archetype, count]) => (
                  <span key={archetype} className="text-navy">
                    <span className="font-semibold tabular-nums">{count}</span>
                    <span className="text-navy/60 ml-1">{count !== 1 && archetype === 'Middle Child' ? 'Middle Children' : `${archetype}${count !== 1 ? 's' : ''}`}</span>
                  </span>
                ))}
              </div>
            </div>
            <Link href="/stats/all-time/game-profiles" className="inline-block mt-2 text-sm text-red-600 hover:text-red-700 font-body">
              Find your profile &rarr;
            </Link>
          </div>

        </div>
      </div>

    </main>
  );
}
