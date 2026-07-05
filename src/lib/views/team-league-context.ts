/**
 * Shared league-wide context for the team page (identical for every team).
 * React.cache composition of existing cached reads - no new cache entry.
 */
import { cache } from 'react';
import { getCurrentSeasonSlug } from '@/lib/queries';
import { getActiveTeamIDs, type TeamH2HActiveTeam } from '@/lib/queries/teams/h2h';

export interface TeamLeagueContext {
  activeTeams: TeamH2HActiveTeam[];
  currentSlug: string | undefined;
}

export const getTeamLeagueContext = cache(async (): Promise<TeamLeagueContext> => {
  const [activeTeams, currentSlug] = await Promise.all([
    getActiveTeamIDs(),
    getCurrentSeasonSlug(),
  ]);
  return { activeTeams, currentSlug };
});
