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
