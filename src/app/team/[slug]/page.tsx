/**
 * Static team profile page.
 *
 * Team pages render fully on demand (dynamicParams = true, nothing prebuilt).
 * Their current-season data is live and each page is query-heavy, so prebuilding
 * re-queries the DB cold every build. On-demand keeps the read throttled to one
 * page per request. This page notFound()s unknown slugs.
 *
 * Phase 4: Complete team profile with six sections:
 * Hero header, franchise history, current roster, season-by-season,
 * all-time roster, head-to-head.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTeamBySlug, getGhostTeamH2H, getAllTeamSlugs, getCurrentSeasonTeamIDs, getTeamCurrentSeasonSchedule, getCurrentSeasonID, type GhostTeamMatchup } from '@/lib/queries';
import { getTeamPageView } from '@/lib/views/team-page';
import { getTeamLeagueContext } from '@/lib/views/team-league-context';
import { TeamHero } from '@/components/team/TeamHero';
import { CurrentRoster } from '@/components/team/CurrentRoster';
import { TeamSchedule } from '@/components/team/TeamSchedule';
import { TeamSeasonByseason } from '@/components/team/TeamSeasonByseason';
import { AllTimeRoster } from '@/components/team/AllTimeRoster';
import { HeadToHead } from '@/components/team/HeadToHead';
import { GhostTeamH2H } from '@/components/team/GhostTeamH2H';
import { PlayoffH2H } from '@/components/team/PlayoffH2H';
import { TrailNav } from '@/components/ui/TrailNav';
import { StickyContextBar } from '@/components/ui/StickyContextBar';
import { SectionHeading } from '@/components/ui/SectionHeading';

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
      <div className="bg-white border border-navy/10 rounded-xl shadow-sm p-5">
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
      <div className="bg-white border border-navy/10 rounded-xl shadow-sm p-5 space-y-3 font-body text-navy/75 text-base leading-relaxed">
        <p>
          When a team forfeits (or there&rsquo;s an odd number of teams in the league), they receive no points - but
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

// Historical slugs render on demand; unknown slugs still 404 via the page body.
export const dynamicParams = true;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  // BUILD_ALL=1 prebuilds every team (full static build). Default = nothing
  // prebuilt: team pages are query-heavy and current-season data is live, so
  // per-deploy prebuilding re-queries cold. Render on demand otherwise.
  if (process.env.BUILD_ALL === '1') {
    const teams = await getAllTeamSlugs();
    return teams.map((t) => ({ slug: t.slug }));
  }
  return [];
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
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splitzkrieg.com'}/team/${slug}`,
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

  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splitzkrieg.com'}/team/${slug}`;

  const isGhostTeam = team.teamID === 45;

  const [view, league] = await Promise.all([
    getTeamPageView(team.teamID),
    getTeamLeagueContext(),
  ]);

  const { currentRoster, teamSeasons, allTimeRoster, franchiseHistory, currentStanding, h2hMatchups, playoffH2H, bowlersBySeason } = view;
  const { activeTeams, currentSlug } = league;

  // Ghost Team (teamID 45) uses a bespoke matchup query; unused for all other teams.
  const ghostH2H = isGhostTeam ? await getGhostTeamH2H() : [];

  // Current-season schedule (schedule-based gate so it shows in preseason too).
  const currentSeasonTeamIDs = await getCurrentSeasonTeamIDs();
  const isCurrentSeasonTeam = !isGhostTeam && currentSeasonTeamIDs.has(team.teamID);
  let teamSchedule: Awaited<ReturnType<typeof getTeamCurrentSeasonSchedule>> = [];
  if (isCurrentSeasonTeam) {
    const currentSeasonID = await getCurrentSeasonID();
    if (currentSeasonID != null) {
      teamSchedule = await getTeamCurrentSeasonSchedule(team.teamID, currentSeasonID);
    }
  }

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
      <StickyContextBar name={team.teamName} />
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
        {teamSchedule.length > 0 && currentSlug && (
          <TeamSchedule schedule={teamSchedule} seasonSlug={currentSlug} />
        )}

        {team.teamName === 'Ghost Team' && <GhostTeamExplainer />}

        {isGhostTeam && ghostH2H.length > 0 ? (
          <GhostTeamAllTime ghostH2H={ghostH2H} ghostWinPct={ghostWinPct} />
        ) : (
          <TeamSeasonByseason
            seasons={teamSeasons}
            bowlersBySeason={bowlersBySeason}
            currentTeamName={team.teamName}
            isActive={currentRoster.length > 0}
          />
        )}

        {!isGhostTeam && <AllTimeRoster roster={allTimeRoster} />}

        {isGhostTeam ? (
          <GhostTeamH2H matchups={ghostH2H} />
        ) : (
          <>
            <HeadToHead matchups={h2hMatchups} activeTeams={activeTeams} currentTeamID={team.teamID} isActive={currentRoster.length > 0} />
            <PlayoffH2H matchups={playoffH2H} />
          </>
        )}
      </div>

    </main>
  );
}
