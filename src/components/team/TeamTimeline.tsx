'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import type { TeamSeasonPresence } from '@/lib/queries';

interface Props {
  presenceData: TeamSeasonPresence[];
  currentSeasonID?: number;
}

export function TeamTimeline({ presenceData, currentSeasonID }: Props) {
  const { teams, seasons, presenceSet } = useMemo(() => {
    if (presenceData.length === 0) {
      return { teams: [] as { teamID: number; teamName: string; slug: string }[], seasons: [] as { seasonID: number; slug: string; roman: string }[], presenceSet: new Set<string>() };
    }

    // Unique seasons in reverse chronological order (newest first)
    const seasonMap = new Map<number, { seasonID: number; slug: string; roman: string }>();
    for (const row of presenceData) {
      if (!seasonMap.has(row.seasonID)) {
        seasonMap.set(row.seasonID, {
          seasonID: row.seasonID,
          slug: row.seasonSlug,
          roman: row.romanNumeral,
        });
      }
    }
    const allSeasons = Array.from(seasonMap.values()).sort((a, b) => b.seasonID - a.seasonID);

    // Unique teams sorted alphabetically
    const teamMap = new Map<number, { teamID: number; teamName: string; slug: string }>();
    for (const row of presenceData) {
      if (!teamMap.has(row.teamID)) {
        teamMap.set(row.teamID, {
          teamID: row.teamID,
          teamName: row.teamName,
          slug: row.slug,
        });
      }
    }
    const allTeams = Array.from(teamMap.values()).sort((a, b) =>
      a.teamName.localeCompare(b.teamName)
    );

    // Build presence lookup set: "teamID-seasonID"
    const set = new Set<string>();
    for (const row of presenceData) {
      set.add(`${row.teamID}-${row.seasonID}`);
    }

    return { teams: allTeams, seasons: allSeasons, presenceSet: set };
  }, [presenceData]);

  if (teams.length === 0 || seasons.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="font-heading text-2xl text-navy mb-2">League Timeline</h2>
      <p className="font-body text-sm text-navy/50 mb-4">
        {teams.length} teams across {seasons.length} seasons of Splitzkrieg history.
      </p>

      <div className="overflow-x-auto border border-navy/10 rounded-lg">
        <table className="min-w-max text-xs font-body">
          <thead>
            <tr className="bg-navy/[0.03]">
              <th className="sticky left-0 z-10 bg-cream text-left px-3 py-2 font-heading text-navy text-sm min-w-[160px] border-r border-navy/10">
                Team
              </th>
              {seasons.map(s => (
                <th key={s.seasonID} className="px-1 py-2 text-center text-navy/60 font-normal min-w-[32px]">
                  <Link
                    href={`/season/${s.slug}`}
                    className="hover:text-red-600 transition-colors"
                    title={`Season ${s.roman}`}
                  >
                    {s.roman}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((team, teamIdx) => (
              <tr
                key={team.teamID}
                className={teamIdx % 2 === 0 ? '' : 'bg-navy/[0.02]'}
              >
                <td className="sticky left-0 z-10 bg-cream px-3 py-1.5 border-r border-navy/10">
                  <Link
                    href={`/team/${team.slug}`}
                    className="text-navy hover:text-red-600 transition-colors text-sm"
                  >
                    {team.teamName}
                  </Link>
                </td>
                {seasons.map(s => {
                  const active = presenceSet.has(`${team.teamID}-${s.seasonID}`);
                  const isCurrent = s.seasonID === currentSeasonID;
                  return (
                    <td key={s.seasonID} className="px-1 py-1.5 text-center">
                      {active ? (
                        <div
                          className={`w-5 h-5 mx-auto rounded-sm ${
                            isCurrent
                              ? 'bg-red-600/70'
                              : 'bg-navy/30'
                          }`}
                          title={`${team.teamName} - Season ${s.roman}`}
                        />
                      ) : (
                        <div className="w-5 h-5 mx-auto" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
