/**
 * The full bowler list with this week's rolling average and handicap.
 * Shared by the admin bowlers page and the read-only copy on /lineup/bowlers,
 * so the two can never show different numbers.
 */

import { getDb } from '@/lib/db';
import { getRollingAverages } from '@/lib/admin/rolling-averages';
import { getCurrentLineupContext } from '@/lib/admin/lineups';

export interface BowlerListRow {
  bowlerID: number;
  bowlerName: string;
  isActive: boolean;
  establishedAvg: number | null;
  currentAvg: number | null;
  handicap: number | null;
}

export async function getBowlerListWithAverages(
  db: Awaited<ReturnType<typeof getDb>>,
): Promise<BowlerListRow[]> {
  const result = await db.request().query<BowlerListRow>(
    'SELECT bowlerID, bowlerName, isActive, establishedAvg FROM bowlers ORDER BY bowlerName',
  );
  const rows = result.recordset;

  const context = await getCurrentLineupContext();
  const avgMap = context
    ? await getRollingAverages(db, context.seasonID, context.nextWeek)
    : new Map<number, number>();

  for (const bowler of rows) {
    const avg = avgMap.get(bowler.bowlerID) ?? null;
    bowler.currentAvg = avg;
    bowler.handicap = avg != null ? Math.min(Math.floor((225 - avg) * 0.95), 147) : null;
  }
  return rows;
}
