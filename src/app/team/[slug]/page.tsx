/**
 * Static team profile page.
 *
 * All team pages are pre-rendered at build time via generateStaticParams.
 * dynamicParams = false ensures unknown slugs return 404 immediately --
 * the DB is never queried at runtime.
 *
 * Phase 4: Complete team profile with six sections:
 * Hero header, franchise history, current roster, season-by-season,
 * all-time roster, head-to-head.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getAllTeamSlugs,
  getTeamBySlug,
  getTeamCurrentRoster,
  getTeamSeasonByseason,
  getTeamSeasonBowlers,
  getTeamAllTimeRoster,
  getTeamFranchiseHistory,
  getTeamCurrentStanding,
  getTeamH2H,
  getActiveTeamIDs,
  getGhostTeamH2H,
  getCurrentSeasonSlug,
  type TeamSeasonBowler,
} from '@/lib/queries';
import { TeamHero } from '@/components/team/TeamHero';
import { CurrentRoster } from '@/components/team/CurrentRoster';
import { TeamSeasonByseason } from '@/components/team/TeamSeasonByseason';
import { AllTimeRoster } from '@/components/team/AllTimeRoster';
import { HeadToHead } from '@/components/team/HeadToHead';
import { GhostTeamH2H } from '@/components/team/GhostTeamH2H';
import { TrailNav } from '@/components/ui/TrailNav';
import { SectionHeading } from '@/components/ui/SectionHeading';
import type { GhostTeamMatchup } from '@/lib/queries';

function GhostTeamAllTime({ ghostH2H, ghostWinPct }: { ghostH2H: GhostTeamMatchup[]; ghostWinPct: number | null }) {
  let wins = 0, losses = 0, ties = 0;
  for (const m of ghostH2H) {
    const threshold = m.teamAvg - 20;
    for (const scratch of [m.scratchGame1, m.scratchGame2, m.scratchGame3]) {
      if (scratch < threshold) wins++;
      else if (scratch > threshold) losses++;
      else ties++;
    }
  }
  const totalNights = ghostH2H.length;

  return (
    <section>
      <SectionHeading>All-Time Record</SectionHeading>
      <div className="bg-white border border-navy/10 rounded-xl p-5">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="font-heading text-3xl text-navy tabular-nums">
              {ghostWinPct != null ? `${ghostWinPct.toFixed(1)}%` : '\u2014'}
            </div>
            <div className="text-xs font-body text-navy/65 mt-0.5">Win Rate</div>
          </div>
          <div className="border-l border-navy/10 pl-6">
            <div className="font-body text-sm text-navy tabular-nums">
              <span className="text-green-600 font-semibold">{wins}W</span>
              {' \u2013 '}
              <span className="text-navy/65">{losses}L</span>
              {ties > 0 && <>{' \u2013 '}<span className="text-amber-600">{ties}T</span></>}
            </div>
            <div className="font-body text-xs text-navy/55 mt-1">
              {totalNights} matchup {totalNights === 1 ? 'night' : 'nights'} &middot; {wins + losses + ties} games
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function GhostTeamExplainer() {
  return (
    <section>
      <SectionHeading>About the Ghost Team</SectionHeading>
      <div className="bg-white border border-navy/10 rounded-xl p-5 space-y-3 font-body text-navy/75 text-base leading-relaxed">
        <p>
          When a team forfeits (or there&rsquo;s an odd number of teams in the league), they receive no points &mdash; but
          the opposing team doesn&rsquo;t automatically get three free wins. They bowl against the
          dreaded <span className="font-semibold text-navy">Ghost Team</span>.
        </p>
        <p>
          To earn a win in each game, the team&rsquo;s total must come within <span className="font-semibold text-navy tabular-nums">20 pins</span> of
          their combined team average.
        </p>
      </div>
    </section>
  );
}

// Unknown slugs return 404 -- never attempt to render or hit the DB at runtime.
export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getAllTeamSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);
  if (!team) return { title: 'Team Not Found | Splitzkrieg' };

  return {
    title: `${team.teamName} | Splitzkrieg`,
    description: `${team.teamName} team profile. Splitzkrieg Bowling League.`,
    openGraph: {
      title: `${team.teamName} | Splitzkrieg Bowling`,
      description: `${team.teamName} -- roster, season history, and all-time stats.`,
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/team/${slug}`,
      siteName: 'Splitzkrieg Bowling League',
      type: 'profile',
    },
  };
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);
  if (!team) notFound();

  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/team/${slug}`;

  const isGhostTeam = team.teamID === 45;

  // Parallel build-time data fetching
  const [currentRoster, teamSeasons, allTimeRoster, franchiseHistory, currentStanding, currentSlug, h2hMatchups, activeTeams, ghostH2H] = await Promise.all([
    getTeamCurrentRoster(team.teamID),
    getTeamSeasonByseason(team.teamID),
    getTeamAllTimeRoster(team.teamID),
    getTeamFranchiseHistory(team.teamID),
    getTeamCurrentStanding(team.teamID),
    getCurrentSeasonSlug(),
    isGhostTeam ? Promise.resolve([]) : getTeamH2H(team.teamID),
    getActiveTeamIDs(),
    isGhostTeam ? getGhostTeamH2H() : Promise.resolve([]),
  ]);

  // Pre-fetch bowler data for all seasons (static build handles the load)
  const bowlersBySeason: Record<number, TeamSeasonBowler[]> = {};
  await Promise.all(
    teamSeasons.map(async (s) => {
      bowlersBySeason[s.seasonID] = await getTeamSeasonBowlers(team.teamID, s.seasonID);
    })
  );

  // Derive counts for hero
  const rosterCount = currentRoster.length;
  const seasonsActive = teamSeasons.length;

  // Ghost Team all-time win percentage
  let ghostWinPct: number | null = null;
  if (isGhostTeam && ghostH2H.length > 0) {
    let wins = 0, total = 0;
    for (const m of ghostH2H) {
      const threshold = m.teamAvg - 20;
      for (const scratch of [m.scratchGame1, m.scratchGame2, m.scratchGame3]) {
        total++;
        if (scratch < threshold) wins++;
      }
    }
    ghostWinPct = total > 0 ? (wins / total) * 100 : null;
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
      <TrailNav current="/teams" seasonSlug={currentSlug} position="top" />
      <TeamHero
        team={team}
        rosterCount={rosterCount}
        seasonsActive={seasonsActive}
        franchiseNames={franchiseHistory}
        shareUrl={shareUrl}
        currentStanding={currentStanding}
        isGhostTeam={isGhostTeam}
      />

      <div className="mt-8 space-y-8">
        {team.teamName === 'Ghost Team' ? (
          <GhostTeamExplainer />
        ) : (
          <CurrentRoster roster={currentRoster} />
        )}

        {isGhostTeam && ghostH2H.length > 0 ? (
          <GhostTeamAllTime ghostH2H={ghostH2H} ghostWinPct={ghostWinPct} />
        ) : (
          <TeamSeasonByseason
            seasons={teamSeasons}
            bowlersBySeason={bowlersBySeason}
            currentTeamName={team.teamName}
          />
        )}

        {!isGhostTeam && <AllTimeRoster roster={allTimeRoster} />}

        {isGhostTeam ? (
          <GhostTeamH2H matchups={ghostH2H} />
        ) : (
          <HeadToHead matchups={h2hMatchups} activeTeams={activeTeams} currentTeamID={team.teamID} />
        )}
      </div>

      <TrailNav current="/teams" seasonSlug={currentSlug} />
    </main>
  );
}
