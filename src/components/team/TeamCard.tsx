import Link from 'next/link';
import type { DirectoryTeam } from '@/lib/queries';
import { strikeX } from '@/components/ui/StrikeX';

interface Props {
  team: DirectoryTeam;
}

export function TeamCard({ team }: Props) {
  return (
    <Link
      href={`/team/${team.slug}`}
      className="block bg-white border border-navy/10 rounded-lg p-5 hover:shadow-md hover:border-navy/20 transition-all"
    >
      <h3 className="font-heading text-lg text-navy mb-2">
        {strikeX(team.teamName)}
      </h3>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-body text-navy/60">
        <span>
          <span className="text-navy/40">Roster </span>
          <span className="tabular-nums">{team.rosterCount}</span>
        </span>
        <span>
          <span className="text-navy/40">Seasons </span>
          <span className="tabular-nums">{team.seasonsActive}</span>
        </span>
        <span>
          <span className="text-navy/40">Games </span>
          <span className="tabular-nums">{team.totalGames.toLocaleString()}</span>
        </span>
      </div>
    </Link>
  );
}
