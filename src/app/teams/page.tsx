import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllTeamsDirectory, getTeamSeasonPresence, getTeamPlayoffFinishes, getCurrentSeasonID } from '@/lib/queries';
import { TeamCard } from '@/components/team/TeamCard';
import { TeamTimeline } from '@/components/team/TeamTimeline';

export const metadata: Metadata = {
  title: 'Teams | Splitzkrieg',
  description: 'Browse all Splitzkrieg Bowling League teams -- active rosters, season history, and franchise profiles.',
};

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const [teams, presenceData, playoffFinishes, currentSeasonID] = await Promise.all([
    getAllTeamsDirectory(),
    getTeamSeasonPresence(),
    getTeamPlayoffFinishes(),
    getCurrentSeasonID(),
  ]);

  const activeTeams = teams.filter(t => t.isActive);
  const historicalTeams = teams.filter(t => !t.isActive);
  const showAll = filter !== 'current';

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-2">
        {showAll ? 'Teams' : 'Current Teams'}
      </h1>
      <div className="flex gap-3 mb-8">
        <Link
          href="/teams?filter=current"
          className={`text-sm font-body transition-colors ${!showAll ? 'text-navy font-semibold' : 'text-navy/40 hover:text-red-600'}`}
        >
          Current
        </Link>
        <span className="text-navy/20">|</span>
        <Link
          href="/teams"
          className={`text-sm font-body transition-colors ${showAll ? 'text-navy font-semibold' : 'text-navy/40 hover:text-red-600'}`}
        >
          All Teams
        </Link>
      </div>

      {activeTeams.length > 0 && (
        <section className="mb-12">
          {showAll && <h2 className="font-heading text-xl text-navy mb-4">Active Teams</h2>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTeams.map(team => (
              <TeamCard key={team.teamID} team={team} />
            ))}
          </div>
        </section>
      )}

      {showAll && historicalTeams.length > 0 && (
        <section>
          <h2 className="font-heading text-xl text-navy/70 mb-4">Past Teams</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75">
            {historicalTeams.map(team => (
              <TeamCard key={team.teamID} team={team} />
            ))}
          </div>
        </section>
      )}

      {teams.length === 0 && (
        <p className="font-body text-navy/50 text-center py-12">
          No teams found. Check back when the season starts.
        </p>
      )}

      {presenceData.length > 0 && (
        <TeamTimeline
          presenceData={presenceData}
          playoffFinishes={playoffFinishes}
          currentSeasonID={currentSeasonID ?? undefined}
        />
      )}
    </main>
  );
}
