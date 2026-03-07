import Link from 'next/link';
import type { AllTimeRosterMember } from '@/lib/queries';

interface Props {
  roster: AllTimeRosterMember[];
}

export function AllTimeRoster({ roster }: Props) {
  if (roster.length === 0) return null;

  return (
    <section>
      <h2 className="font-heading text-2xl text-navy mb-4">All-Time Roster</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="border-b border-navy/10">
              <th className="text-left px-4 py-2 text-navy/60 font-normal w-12">#</th>
              <th className="text-left px-4 py-2 text-navy/60 font-normal">Bowler</th>
              <th className="text-right px-4 py-2 text-navy/60 font-normal">Games</th>
              <th className="text-right px-4 py-2 text-navy/60 font-normal">Pins</th>
              <th className="text-right px-4 py-2 text-navy/60 font-normal">Avg</th>
              <th className="text-right px-4 py-2 text-navy/60 font-normal">Seasons</th>
              <th className="text-right px-4 py-2 text-navy/60 font-normal hidden sm:table-cell">Tenure</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((member, i) => {
              const tenure = member.firstSeason === member.lastSeason
                ? member.firstSeason
                : `${member.firstSeason} \u2013 ${member.lastSeason}`;

              return (
                <tr key={member.bowlerID} className="border-b border-navy/5 hover:bg-navy/[0.02]">
                  <td className="px-4 py-2 text-navy/50 tabular-nums">{i + 1}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/bowler/${member.slug}`}
                      className="text-navy hover:text-red-600 transition-colors"
                    >
                      {member.bowlerName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-navy">
                    {member.totalGames.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-navy">
                    {member.totalPins.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-navy">
                    {member.average?.toFixed(1) ?? '\u2014'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-navy">
                    {member.seasonsWithTeam}
                  </td>
                  <td className="px-4 py-2 text-right text-navy/50 text-xs hidden sm:table-cell whitespace-nowrap">
                    {tenure ?? '\u2014'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
