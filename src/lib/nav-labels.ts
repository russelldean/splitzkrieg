/**
 * Canonical names for the season-scoped destinations.
 *
 * TrailNav (top of page) and the Up next nudge (bottom) both point at these
 * pages, and they used to name them differently: the trail said "Standings &
 * Highlights" while the nudge said "Season Standings". One page advertised two
 * names for one destination, which is exactly the confusion the trail exists to
 * prevent. Both import from here so they cannot drift apart again.
 */
export const DESTINATION_LABELS = {
  season: 'Standings & Highlights',
  stats: 'Leaderboards & Stats',
} as const;

export interface NextStop {
  href: string;
  title: string;
  description: string;
}

/** The next page along the trail, or null when there is nowhere further to go. */
export function getNextStop(currentPage: string, seasonSlug?: string): NextStop | null {
  const stops: Record<string, NextStop> = {
    week: {
      href: seasonSlug ? `/season/${seasonSlug}` : '/seasons',
      title: DESTINATION_LABELS.season,
      description: 'See where every team stands after this week',
    },
    season: {
      href: seasonSlug ? `/stats/${seasonSlug}` : '/stats',
      title: DESTINATION_LABELS.stats,
      description: 'Full season averages, high games, and series',
    },
    stats: {
      href: '/milestones',
      title: 'Milestones',
      description: 'Career landmarks hit this season',
    },
    milestones: {
      href: '/stats/all-time',
      title: 'All-Time Records',
      description: 'The best across 35 seasons of Splitzkrieg',
    },
  };

  return stops[currentPage] ?? null;
}
