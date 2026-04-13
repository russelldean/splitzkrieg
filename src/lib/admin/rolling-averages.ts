/**
 * Rolling 27-game average calculation for bowlers.
 * Shared by scoresheets, admin bowlers page, etc.
 */

import sql from 'mssql';
import { getDb } from '@/lib/db';

export async function getRollingAverages(
  db: Awaited<ReturnType<typeof getDb>>,
  seasonID: number,
  week: number,
): Promise<Map<number, number>> {
  const avgResult = await db.request()
    .input('seasonID', sql.Int, seasonID)
    .input('week', sql.Int, week)
    .query<{ bowlerID: number; incomingAvg: number }>(
      `SELECT b.bowlerID,
        (SELECT TOP 1 x.avg27 FROM (
          SELECT AVG(CAST(g.val AS FLOAT)) AS avg27
          FROM (
            SELECT TOP 27 x2.val
            FROM scores s2
            CROSS APPLY (VALUES (s2.game1),(s2.game2),(s2.game3)) AS x2(val)
            WHERE s2.bowlerID = b.bowlerID AND s2.isPenalty = 0 AND x2.val IS NOT NULL
              AND (s2.seasonID < @seasonID OR (s2.seasonID = @seasonID AND s2.week < @week))
            ORDER BY s2.seasonID DESC, s2.week DESC
          ) g
        ) x) AS incomingAvg
      FROM bowlers b
      WHERE b.bowlerID IN (SELECT DISTINCT bowlerID FROM scores WHERE isPenalty = 0)`,
    );

  const avgMap = new Map<number, number>();
  for (const row of avgResult.recordset) {
    if (row.incomingAvg != null) {
      avgMap.set(row.bowlerID, Math.floor(row.incomingAvg));
    }
  }
  return avgMap;
}
