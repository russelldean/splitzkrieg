'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import type { TeamSeasonPresence, TeamPlayoffFinish } from '@/lib/queries';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface Props {
  presenceData: TeamSeasonPresence[];
  playoffFinishes: TeamPlayoffFinish[];
  currentSeasonID?: number;
}

export function TeamTimeline({ presenceData, playoffFinishes, currentSeasonID }: Props) {
  const { teams, seasons, presenceSet, finishMap } = useMemo(() => {
    if (presenceData.length === 0) {
      return {
        teams: [] as { teamID: number; teamName: string; slug: string }[],
        seasons: [] as { seasonID: number; slug: string; roman: string }[],
        presenceSet: new Set<string>(),
        finishMap: new Map<string, 'champion' | 'runner-up' | 'semifinalist'>(),
      };
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

    // Unique teams sorted by chronoNumber (earliest teams first)
    const teamMap = new Map<number, { teamID: number; teamName: string; slug: string; chronoNumber: number | null }>();
    for (const row of presenceData) {
      if (!teamMap.has(row.teamID)) {
        teamMap.set(row.teamID, {
          teamID: row.teamID,
          teamName: row.teamName,
          slug: row.slug,
          chronoNumber: row.chronoNumber,
        });
      }
    }
    const allTeams = Array.from(teamMap.values()).sort((a, b) =>
      (a.chronoNumber ?? 999) - (b.chronoNumber ?? 999)
    );

    // Build presence lookup set: "teamID-seasonID"
    const set = new Set<string>();
    for (const row of presenceData) {
      set.add(`${row.teamID}-${row.seasonID}`);
    }

    // Build playoff finish lookup: "teamID-seasonID" -> finish
    const fMap = new Map<string, 'champion' | 'runner-up' | 'semifinalist'>();
    for (const pf of playoffFinishes) {
      fMap.set(`${pf.teamID}-${pf.seasonID}`, pf.finish);
    }

    return { teams: allTeams, seasons: allSeasons, presenceSet: set, finishMap: fMap };
  }, [presenceData, playoffFinishes]);

  if (teams.length === 0 || seasons.length === 0) return null;

  function getCellClass(teamID: number, seasonID: number): string {
    const finish = finishMap.get(`${teamID}-${seasonID}`);
    if (finish === 'runner-up') return 'bg-blue-300';
    if (finish === 'semifinalist') return 'bg-orange-300';
    return 'bg-navy/30';
  }

  function getCellTitle(teamName: string, roman: string, teamID: number, seasonID: number): string {
    const finish = finishMap.get(`${teamID}-${seasonID}`);
    const label = finish
      ? ` - ${finish.charAt(0).toUpperCase() + finish.slice(1)}`
      : '';
    return `${teamName} - Season ${roman}${label}`;
  }

  return (
    <section className="mt-12">
      <SectionHeading className="mb-2">League Timeline</SectionHeading>
      <p className="font-body text-sm text-navy/65 mb-4">
        All teams shown across the Splitzkrieg timeline.
      </p>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-3 text-xs font-body text-navy/60">
        <span className="flex items-center gap-1.5">
          <span className="text-sm leading-none">{'🏆'}</span> Champion
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-300" /> Runner-Up
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-orange-300" /> Semifinalist
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-navy/30" /> Active
        </span>
      </div>

      <div className="overflow-x-auto border border-navy/10 rounded-lg">
        <table className="min-w-max text-xs font-body">
          <thead>
            <tr className="bg-navy/[0.03]">
              <th className="sticky left-0 z-10 bg-cream text-left px-3 py-2 font-heading text-navy text-sm min-w-[120px] max-w-[140px] border-r border-navy/10">
                Team
              </th>
              {seasons.map(s => (
                <th
                  key={s.seasonID}
                  className={`px-1 py-2 text-center text-navy/60 font-normal min-w-[32px]${
                    s.seasonID === currentSeasonID ? ' border-r-2 border-navy/20' : ''
                  }`}
                >
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
                <td className="sticky left-0 z-10 bg-cream px-3 py-1.5 border-r border-navy/10 max-w-[140px]">
                  <Link
                    href={`/team/${team.slug}`}
                    className="text-navy hover:text-red-600 transition-colors text-sm block truncate"
                    title={team.teamName}
                  >
                    {team.teamName}
                  </Link>
                </td>
                {seasons.map(s => {
                  const active = presenceSet.has(`${team.teamID}-${s.seasonID}`);
                  return (
                    <td key={s.seasonID} className={`px-1 py-1.5 text-center${
                      s.seasonID === currentSeasonID ? ' border-r-2 border-navy/20' : ''
                    }`}>
                      {active ? (
                        finishMap.get(`${team.teamID}-${s.seasonID}`) === 'champion' ? (
                          <div
                            className="w-5 h-5 mx-auto flex items-center justify-center text-[1rem] leading-none"
                            title={getCellTitle(team.teamName, s.roman, team.teamID, s.seasonID)}
                          >
                            {'🏆'}
                          </div>
                        ) : (
                          <div
                            className={`w-5 h-5 mx-auto rounded-sm ${getCellClass(team.teamID, s.seasonID)}`}
                            title={getCellTitle(team.teamName, s.roman, team.teamID, s.seasonID)}
                          />
                        )
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
