/**
 * Central tag vocabulary for taggedQuery + revalidateTag. One place so tag
 * strings never drift between where they are set and where they are revalidated.
 */
export const tags = {
  scoresForSeason: (seasonId: number) => `scores-${seasonId}`,
  scheduleForSeason: (seasonId: number) => `schedule-${seasonId}`,
  bowler: (bowlerId: number) => `bowler-${bowlerId}`,
  team: (teamId: number) => `team-${teamId}`,
  season: (seasonId: number) => `season-${seasonId}`,
} as const;
