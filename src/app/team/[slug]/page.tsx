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
  getCurrentSeasonSlug,
  type TeamSeasonBowler,
} from '@/lib/queries';
import { TeamHero } from '@/components/team/TeamHero';
import { CurrentRoster } from '@/components/team/CurrentRoster';
import { TeamSeasonByseason } from '@/components/team/TeamSeasonByseason';
import { AllTimeRoster } from '@/components/team/AllTimeRoster';
import { HeadToHead } from '@/components/team/HeadToHead';
import { TrailNav } from '@/components/ui/TrailNav';
import { SectionHeading } from '@/components/ui/SectionHeading';

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

  // Parallel build-time data fetching
  const [currentRoster, teamSeasons, allTimeRoster, franchiseHistory, currentStanding, currentSlug, h2hMatchups, activeTeams] = await Promise.all([
    getTeamCurrentRoster(team.teamID),
    getTeamSeasonByseason(team.teamID),
    getTeamAllTimeRoster(team.teamID),
    getTeamFranchiseHistory(team.teamID),
    getTeamCurrentStanding(team.teamID),
    getCurrentSeasonSlug(),
    getTeamH2H(team.teamID),
    getActiveTeamIDs(),
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

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <TrailNav current="/teams" seasonSlug={currentSlug} position="top" />
      <TeamHero
        team={team}
        rosterCount={rosterCount}
        seasonsActive={seasonsActive}
        franchiseNames={franchiseHistory}
        shareUrl={shareUrl}
        currentStanding={currentStanding}
      />

      <div className="mt-8 space-y-8">
        {team.teamName === 'Ghost Team' ? (
          <GhostTeamExplainer />
        ) : (
          <CurrentRoster roster={currentRoster} />
        )}

        <TeamSeasonByseason
          seasons={teamSeasons}
          bowlersBySeason={bowlersBySeason}
          currentTeamName={team.teamName}
        />

        <AllTimeRoster roster={allTimeRoster} />

        <HeadToHead matchups={h2hMatchups} activeTeams={activeTeams} currentTeamID={team.teamID} />
      </div>

      <TrailNav current="/teams" seasonSlug={currentSlug} />
    </main>
  );
}
