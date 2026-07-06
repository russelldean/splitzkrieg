import type { WeeklyMatchScore, SeasonScheduleWeek, WeeklyMatchupResult } from '@/lib/queries';

/** Group scores by week, then by team within each week. */
export function organizeByWeek(scores: WeeklyMatchScore[]) {
  const weekMap = new Map<number, Map<number, WeeklyMatchScore[]>>();
  for (const row of scores) {
    if (!weekMap.has(row.week)) weekMap.set(row.week, new Map());
    const teamMap = weekMap.get(row.week)!;
    if (!teamMap.has(row.teamID)) teamMap.set(row.teamID, []);
    teamMap.get(row.teamID)!.push(row);
  }
  return weekMap;
}

/** Index match results by "week-homeTeamID-awayTeamID" for fast lookup. */
export function indexMatchResults(results: WeeklyMatchupResult[]) {
  const map = new Map<string, WeeklyMatchupResult>();
  for (const r of results) {
    map.set(`${r.week}-${r.homeTeamID}-${r.awayTeamID}`, r);
  }
  return map;
}

/** Get matchups from schedule for a given week. */
export function getMatchups(schedule: SeasonScheduleWeek[], week: number) {
  return schedule.filter(s => s.week === week);
}

export interface DateGroup<T> {
  date: string | null;
  items: T[];
}

/**
 * Canonical YYYY-MM-DD key for a match date. Match dates arrive as a JS Date
 * (mssql returns SQL `date` columns as Date objects) in server components and
 * as an ISO string once serialized to a client component; both must key/compare
 * the same, so Date objects can't be used as Map/Set keys directly (reference
 * equality would split every match into its own group).
 */
export function toDateKey(d: string | Date | null): string | null {
  if (d == null) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return typeof d === 'string' ? d : null;
  return date.toISOString().slice(0, 10);
}

/**
 * Group items by their match date, returned in ascending date order (null last).
 * Within-group order is preserved. Order-independent: does not assume the input
 * is pre-sorted. A single-date input returns one group.
 */
export function groupByMatchDate<T>(
  items: T[],
  getDate: (item: T) => string | Date | null,
): DateGroup<T>[] {
  const map = new Map<string | null, T[]>();
  const order: (string | null)[] = [];
  for (const item of items) {
    const d = toDateKey(getDate(item));
    if (!map.has(d)) {
      map.set(d, []);
      order.push(d);
    }
    map.get(d)!.push(item);
  }
  order.sort((a, b) => {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a < b ? -1 : 1;
  });
  return order.map((date) => ({ date, items: map.get(date)! }));
}

/** Find bowler with highest handicap series across both teams in a matchup. */
export function findMatchMVP(
  homeBowlers: WeeklyMatchScore[],
  awayBowlers: WeeklyMatchScore[]
): number | null {
  let bestID: number | null = null;
  let bestSeries = -1;
  for (const b of [...homeBowlers, ...awayBowlers]) {
    if (b.isPenalty) continue;
    if (b.handSeries != null && b.handSeries > bestSeries) {
      bestSeries = b.handSeries;
      bestID = b.bowlerID;
    }
  }
  return bestID;
}
