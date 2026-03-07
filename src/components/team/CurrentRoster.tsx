import Link from 'next/link';
import type { TeamRosterMember } from '@/lib/queries';
import { EmptyState } from '@/components/ui/EmptyState';

interface Props {
  roster: TeamRosterMember[];
}

export function CurrentRoster({ roster }: Props) {
  if (roster.length === 0) {
    return (
      <section>
        <h2 className="font-heading text-2xl text-navy mb-4">Current Roster</h2>
        <EmptyState
          title="No current roster"
          message="This team doesn't have any bowlers in the current season. Check back when the next season starts."
        />
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-heading text-2xl text-navy mb-4">Current Roster</h2>
      <ul className="space-y-2">
        {roster.map((member) => (
          <li
            key={member.bowlerID}
            className="flex items-center justify-between px-4 py-3 bg-white border border-navy/10 rounded-lg"
          >
            <div className="flex flex-col">
              <Link
                href={`/bowler/${member.slug}`}
                className="text-navy hover:text-red-600 transition-colors font-body"
              >
                {member.bowlerName}
              </Link>
              {member.firstSeason && (
                <span className="text-xs font-body text-navy/50">
                  since {member.firstSeason}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm font-body text-navy/60">
              <span>
                <span className="text-navy/50">Avg </span>
                <span className="tabular-nums font-semibold text-navy">
                  {member.seasonAverage?.toFixed(1) ?? '\u2014'}
                </span>
              </span>
              <span>
                <span className="text-navy/50">Games </span>
                <span className="tabular-nums font-semibold text-navy">
                  {member.gamesBowled}
                </span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
