import type { Team, FranchiseNameEntry } from '@/lib/queries';
import { ShareButton } from '@/components/bowler/ShareButton';
import { FranchiseHistory } from '@/components/team/FranchiseHistory';
import { strikeX } from '@/components/ui/StrikeX';

interface Props {
  team: Team;
  rosterCount: number;
  seasonsActive: number;
  franchiseNames: FranchiseNameEntry[];
  shareUrl: string;
}

export function TeamHero({ team, rosterCount, seasonsActive, franchiseNames, shareUrl }: Props) {
  return (
    <section className="pb-8 border-b border-red-600/20">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl text-navy">
          {strikeX(team.teamName)}
        </h1>
        <div className="shrink-0 pt-2">
          <ShareButton url={shareUrl} />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-2 mt-6">
        <StatPill label="Current Roster" value={rosterCount} />
        <StatPill label="Seasons Active" value={seasonsActive} />
        <FranchiseHistory names={franchiseNames} />
      </div>
    </section>
  );
}

function StatPill({ label, value }: { label: string; value: string | number | null }) {
  const display = value === null || value === 0 ? '\u2014' : String(value);

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-navy/5 rounded-full text-sm font-body text-navy">
      <span className="text-navy/50">{label}</span>
      <span className="font-semibold">{display}</span>
    </span>
  );
}
