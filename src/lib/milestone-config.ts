/**
 * Milestone configuration and helpers.
 * Shared between queries (server) and components (client).
 */

export const MILESTONE_THRESHOLDS = {
  totalGames: {
    label: 'Career Games',
    thresholds: [100, 250, 500, 750, 1000],
    proximity: 9,
  },
  totalPins: {
    label: 'Career Pins',
    thresholds: [10_000, 25_000, 50_000, 75_000, 100_000, 150_000, 200_000],
    proximity: 650,
  },
  games200Plus: {
    label: '200+ Games',
    thresholds: [10, 25, 50, 75, 100, 150, 200, 250, 300],
    proximity: 1,
  },
  series600Plus: {
    label: '600+ Series',
    thresholds: [10, 25, 50, 75, 100],
    proximity: 2,
  },
  totalTurkeys: {
    label: 'Career Turkeys',
    thresholds: [25, 50, 100, 150, 200, 250, 300, 350, 400],
    proximity: 2,
  },
} as const;

export type MilestoneCategory = keyof typeof MILESTONE_THRESHOLDS;

export interface PersonalMilestone {
  category: MilestoneCategory;
  label: string;
  current: number;
  nextThreshold: number | null;
  needed: number;
  achieved: number[];
  pct: number;
}

/**
 * Compute milestone progress for a single bowler from their career stats.
 * Used on bowler profile pages — no DB call needed, just existing career summary data.
 */
export function computePersonalMilestones(stats: {
  totalGamesBowled: number | null;
  totalPins: number | null;
  games200Plus: number | null;
  series600Plus: number | null;
  totalTurkeys: number | null;
}): PersonalMilestone[] {
  const statMap: Record<MilestoneCategory, number> = {
    totalGames: stats.totalGamesBowled ?? 0,
    totalPins: stats.totalPins ?? 0,
    games200Plus: stats.games200Plus ?? 0,
    series600Plus: stats.series600Plus ?? 0,
    totalTurkeys: stats.totalTurkeys ?? 0,
  };

  return (Object.entries(MILESTONE_THRESHOLDS) as [MilestoneCategory, (typeof MILESTONE_THRESHOLDS)[MilestoneCategory]][])
    .map(([key, config]) => {
      const current = statMap[key];
      const achieved = config.thresholds.filter((t) => current >= t) as number[];
      const nextThreshold = config.thresholds.find((t) => current < t) ?? null;
      const prevThreshold = achieved.length > 0 ? achieved[achieved.length - 1] : 0;
      const needed = nextThreshold ? nextThreshold - current : 0;
      const pct = nextThreshold
        ? Math.min(100, Math.round(((current - prevThreshold) / (nextThreshold - prevThreshold)) * 100))
        : 100;

      return { category: key, label: config.label, current, nextThreshold, needed, achieved, pct, proximity: config.proximity };
    })
    .filter((m) => m.nextThreshold !== null && m.needed <= m.proximity);
}
