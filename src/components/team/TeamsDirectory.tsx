'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TeamCard } from '@/components/team/TeamCard';
import type { DirectoryTeam } from '@/lib/queries';

export function TeamsDirectory({ teams }: { teams: DirectoryTeam[] }) {
  const searchParams = useSearchParams();
  const [showCurrent, setShowCurrent] = useState(searchParams.get('filter') === 'current');
  const activeTeams = teams.filter(t => t.isActive);
  const historicalTeams = teams.filter(t => !t.isActive);
  const showAll = !showCurrent;

  return (
    <>
      <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-2">
        {showAll ? 'Teams' : 'Current Teams'}
      </h1>
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => setShowCurrent(true)}
          className={`text-sm font-body transition-colors ${showCurrent ? 'text-navy font-semibold' : 'text-navy/40 hover:text-red-600'}`}
        >
          Current
        </button>
        <span className="text-navy/20">|</span>
        <button
          onClick={() => setShowCurrent(false)}
          className={`text-sm font-body transition-colors ${!showCurrent ? 'text-navy font-semibold' : 'text-navy/40 hover:text-red-600'}`}
        >
          All Teams
        </button>
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
        <p className="font-body text-navy/65 text-center py-12">
          No teams found. Check back when the season starts.
        </p>
      )}
    </>
  );
}
