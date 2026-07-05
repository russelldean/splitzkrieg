/**
 * Central tag vocabulary for taggedQuery + revalidateTag. One place so tag
 * strings never drift between where they are set and where they are revalidated.
 *
 * Per-season tags scope invalidation to one season (Rule B). Coarse channel
 * tags (scoresAll/scheduleAll/playoffsAll) cover cross-season queries (Rule C):
 * an import revalidates BOTH the per-season tag and the coarse tag. Entity tags
 * (bowler/team) let a rename or single-bowler edit refresh precisely (Rule A/D).
 */
export const tags = {
  // per-season channel tags (Rule B)
  scoresForSeason: (seasonId: number) => `scores-${seasonId}`,
  scheduleForSeason: (seasonId: number) => `schedule-${seasonId}`,
  playoffsForSeason: (seasonId: number) => `playoffs-${seasonId}`,
  // coarse channel tags for cross-season reads (Rule C)
  scoresAll: 'scores',
  scheduleAll: 'schedule',
  playoffsAll: 'playoffs',
  // entity tags (Rule A / rename ritual killer)
  bowler: (bowlerId: number) => `bowler-${bowlerId}`,
  team: (teamId: number) => `team-${teamId}`,
  // identity / pointers (Rule D)
  season: (seasonId: number) => `season-${seasonId}`,
  currentSeasonPointer: 'current-season',
} as const;
