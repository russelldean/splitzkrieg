/**
 * League-wide bowler-page context, bundled behind one call. Identical for every
 * bowler, so the page fetches it once. React.cache composition of existing
 * independently-cached reads (no new cache entry). Down to 4 calls after the
 * ticker cross-ref and getGameProfiles were removed from the bowler page.
 */
import { cache } from 'react';
import { getBowlerOfTheWeek, getCurrentSeasonID, getCurrentSeasonSlug } from '@/lib/queries';
import { getLeagueGameAvgs, type LeagueGameAvgs } from '@/lib/queries/alltime';

export interface LeagueContext {
  botwIDs: number[];
  currentSeasonID: number | null;
  currentSlug: string | undefined;
  leagueGameAvgs: LeagueGameAvgs;
}

export const getLeagueContext = cache(async (): Promise<LeagueContext> => {
  const [botwIDs, currentSeasonID, currentSlug, leagueGameAvgs] = await Promise.all([
    getBowlerOfTheWeek(),
    getCurrentSeasonID(),
    getCurrentSeasonSlug(),
    getLeagueGameAvgs(),
  ]);
  return { botwIDs, currentSeasonID, currentSlug, leagueGameAvgs };
});
