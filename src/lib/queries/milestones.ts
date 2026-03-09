/**
 * League-wide milestone queries.
 * Computes approaching + recently-achieved milestones for active bowlers.
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../db';
import { MILESTONE_THRESHOLDS, type MilestoneCategory } from '../milestone-config';
import type { TickerItem } from './home';

/* ───────────────────────────────────────────────────────────
 * Types
 * ─────────────────────────────────────────────────────────── */

export interface LeagueMilestone {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  category: MilestoneCategory;
  categoryLabel: string;
  current: number;
  threshold: number;
  needed: number;
}

export interface LeagueMilestones {
  approaching: LeagueMilestone[];
  achieved: LeagueMilestone[];
}

/* ───────────────────────────────────────────────────────────
 * SQL: Active bowler career stats
 * ─────────────────────────────────────────────────────────── */

const ACTIVE_BOWLER_STATS_SQL = `
  SELECT
    v.bowlerID,
    v.bowlerName,
    v.slug,
    v.totalGamesBowled,
    v.totalPins,
    v.games200Plus,
    v.series600Plus,
    v.totalTurkeys
  FROM vw_BowlerCareerSummary v
  JOIN bowlers b ON v.bowlerID = b.bowlerID
  WHERE b.isActive = 1
    AND EXISTS (
      SELECT 1 FROM scores sc
      WHERE sc.bowlerID = v.bowlerID AND sc.isPenalty = 0
        AND sc.seasonID IN (
          SELECT TOP 2 seasonID FROM seasons
          ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
        )
    )
`;

/* ───────────────────────────────────────────────────────────
 * SQL: Latest week contributions per bowler
 * ─────────────────────────────────────────────────────────── */

const LATEST_WEEK_CONTRIB_SQL = `
  WITH LatestWeek AS (
    SELECT TOP 1 sc.seasonID, sc.week
    FROM scores sc
    JOIN seasons s ON sc.seasonID = s.seasonID
    WHERE sc.isPenalty = 0
    ORDER BY s.year DESC, CASE s.period WHEN 'Fall' THEN 2 ELSE 1 END DESC, sc.week DESC
  )
  SELECT
    sc.bowlerID,
    3 AS gamesAdded,
    sc.scratchSeries AS pinsAdded,
    (CASE WHEN sc.game1 >= 200 THEN 1 ELSE 0 END
     + CASE WHEN sc.game2 >= 200 THEN 1 ELSE 0 END
     + CASE WHEN sc.game3 >= 200 THEN 1 ELSE 0 END) AS g200Added,
    CASE WHEN sc.scratchSeries >= 600 THEN 1 ELSE 0 END AS s600Added,
    ISNULL(sc.turkeys, 0) AS turkeysAdded
  FROM scores sc
  CROSS JOIN LatestWeek lw
  WHERE sc.seasonID = lw.seasonID AND sc.week = lw.week AND sc.isPenalty = 0
`;

// Include config in hash so threshold/proximity changes auto-invalidate cache
const CONFIG_FINGERPRINT = JSON.stringify(MILESTONE_THRESHOLDS);
const COMBINED_SQL = ACTIVE_BOWLER_STATS_SQL + LATEST_WEEK_CONTRIB_SQL + CONFIG_FINGERPRINT;

/* ───────────────────────────────────────────────────────────
 * Compute milestones from raw data
 * ─────────────────────────────────────────────────────────── */

interface BowlerStats {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  totalGamesBowled: number;
  totalPins: number;
  games200Plus: number;
  series600Plus: number;
  totalTurkeys: number;
}

interface WeekContrib {
  bowlerID: number;
  gamesAdded: number;
  pinsAdded: number;
  g200Added: number;
  s600Added: number;
  turkeysAdded: number;
}

const STAT_KEY_MAP: Record<MilestoneCategory, keyof BowlerStats> = {
  totalGames: 'totalGamesBowled',
  totalPins: 'totalPins',
  games200Plus: 'games200Plus',
  series600Plus: 'series600Plus',
  totalTurkeys: 'totalTurkeys',
};

const CONTRIB_KEY_MAP: Record<MilestoneCategory, keyof WeekContrib> = {
  totalGames: 'gamesAdded',
  totalPins: 'pinsAdded',
  games200Plus: 'g200Added',
  series600Plus: 's600Added',
  totalTurkeys: 'turkeysAdded',
};

function computeLeagueMilestones(
  allStats: BowlerStats[],
  weekContribs: WeekContrib[],
): LeagueMilestones {
  const contribMap = new Map(weekContribs.map((w) => [w.bowlerID, w]));
  const approaching: LeagueMilestone[] = [];
  const achieved: LeagueMilestone[] = [];

  for (const bowler of allStats) {
    const contrib = contribMap.get(bowler.bowlerID);

    for (const [category, config] of Object.entries(MILESTONE_THRESHOLDS) as [
      MilestoneCategory,
      (typeof MILESTONE_THRESHOLDS)[MilestoneCategory],
    ][]) {
      const current = bowler[STAT_KEY_MAP[category]] as number;
      const weekAdded = contrib ? (contrib[CONTRIB_KEY_MAP[category]] as number) : 0;
      const prior = current - weekAdded;

      for (const threshold of config.thresholds) {
        // Recently achieved: was below threshold before this week, now at or above
        if (current >= threshold && prior < threshold) {
          achieved.push({
            bowlerID: bowler.bowlerID,
            bowlerName: bowler.bowlerName,
            slug: bowler.slug,
            category,
            categoryLabel: config.label,
            current,
            threshold,
            needed: 0,
          });
        }
        // Approaching: below threshold, within proximity
        else if (current < threshold && threshold - current <= config.proximity) {
          approaching.push({
            bowlerID: bowler.bowlerID,
            bowlerName: bowler.bowlerName,
            slug: bowler.slug,
            category,
            categoryLabel: config.label,
            current,
            threshold,
            needed: threshold - current,
          });
        }
      }
    }
  }

  // Sort approaching: by category order, then threshold, then closest first
  const categoryOrder: MilestoneCategory[] = [
    'totalGames',
    'totalPins',
    'games200Plus',
    'series600Plus',
    'totalTurkeys',
  ];
  approaching.sort((a, b) => {
    const catDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    if (a.threshold !== b.threshold) return a.threshold - b.threshold;
    return a.needed - b.needed;
  });

  return { approaching, achieved };
}

/* ───────────────────────────────────────────────────────────
 * Exported query
 * ─────────────────────────────────────────────────────────── */

export const getLeagueMilestones = cache(async (): Promise<LeagueMilestones> => {
  return cachedQuery(
    'getLeagueMilestones',
    async () => {
      const db = await getDb();
      const statsResult = await db.request().query<BowlerStats>(ACTIVE_BOWLER_STATS_SQL);
      const contribResult = await db.request().query<WeekContrib>(LATEST_WEEK_CONTRIB_SQL);
      return computeLeagueMilestones(statsResult.recordset, contribResult.recordset);
    },
    { approaching: [], achieved: [] },
    { sql: COMBINED_SQL },
  );
});

/**
 * Convert recently-achieved milestones into ticker items for the home page.
 */
export function milestoneTickerItems(milestones: LeagueMilestones): TickerItem[] {
  return milestones.achieved.map((m) => ({
    text: `${m.bowlerName}: ${m.threshold.toLocaleString()} ${m.categoryLabel}!`,
    href: `/bowler/${m.slug}`,
    icon: 'milestone' as const,
  }));
}
