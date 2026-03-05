import type { Metadata } from 'next';
import { getAllTeamsDirectory } from '@/lib/queries';
import { TeamCard } from '@/components/team/TeamCard';

export const metadata: Metadata = {
  title: 'Teams | Splitzkrieg',
  description: 'Browse all Splitzkrieg Bowling League teams -- active rosters, season history, and franchise profiles.',
};

export default async function TeamsPage() {
  const teams = await getAllTeamsDirectory();

  const activeTeams = teams.filter(t => t.isActive);
  const historicalTeams = teams.filter(t => !t.isActive);

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-8">Teams</h1>

      {activeTeams.length > 0 && (
        <section className="mb-12">
          <h2 className="font-heading text-xl text-navy mb-4">Active Teams</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTeams.map(team => (
              <TeamCard key={team.teamID} team={team} />
            ))}
          </div>
        </section>
      )}

      {historicalTeams.length > 0 && (
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
    </main>
  );
}
