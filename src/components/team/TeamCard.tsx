import Link from 'next/link';
import type { DirectoryTeam } from '@/lib/queries';


interface Props {
  team: DirectoryTeam;
}

const GHOST_TEAM_NAME = 'Ghost Team';

export function TeamCard({ team }: Props) {
  const isGhost = team.teamName === GHOST_TEAM_NAME;

  return (
    <Link
      href={`/team/${team.slug}`}
      className="group block bg-white border border-navy/10 rounded-lg p-5 hover:shadow-md hover:border-navy/20 transition-all"
    >
      <h3 className="font-heading text-lg text-navy group-hover:text-red-600 transition-colors mb-2">
        {isGhost ? (
          <span>
            <span className="mr-1.5" aria-hidden="true">{'👻'}</span>
            {team.teamName}
          </span>
        ) : (
          <span>
            {team.teamName}
            {team.championships > 0 && (
              <span className="ml-1.5 text-amber-600 text-sm" title={`${team.championships} championship${team.championships > 1 ? 's' : ''}`}>
                {'🏆'.repeat(team.championships)}
              </span>
            )}
          </span>
        )}
      </h3>

      {isGhost ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-body text-navy/50 italic">
          {'👻 👻 👻'}
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-body text-navy/60">
          <span>
            <span className="text-navy/50">Bowlers </span>
            <span className="tabular-nums">{team.rosterCount}</span>
          </span>
          <span>
            <span className="text-navy/50">Seasons </span>
            <span className="tabular-nums">{team.seasonsActive}</span>
          </span>
          <span>
            <span className="text-navy/50">Games </span>
            <span className="tabular-nums">{team.totalGames.toLocaleString()}</span>
          </span>
          {team.establishedSeason && (
            <span>
              <span className="text-navy/50">Est. </span>
              <span className="tabular-nums">{team.establishedSeason}</span>
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
