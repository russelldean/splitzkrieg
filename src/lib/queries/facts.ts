/**
 * Random facts query — fetches the full fact pool for client-side selection.
 *
 * All facts are sent to the client. The client filters by date window (+/- 4 days)
 * and applies three-tier selection (career high > temp high > milestone).
 * This works because the site is static — "today" can't be computed at build time.
 */
import { cachedQuery, getDb } from '../db';

export interface RandomFact {
  factTypeID: number;
  bowlerName: string;
  bowlerSlug: string;
  seasonSlug: string;
  week: number;
  year: number;
  value: number;
  previousValue: number | null;
  isCareerHigh: boolean;
  /** Month (1-12) and day (1-31) of the reference date, for client-side date matching */
  refMonth: number | null;
  refDay: number | null;
  /** ISO date string for display */
  referenceDate: string | null;
  /** Only set for milestone facts (factTypeID=3) */
  milestoneCategory: string | null;
  milestoneOrdinal: number | null;
}

const RANDOM_FACTS_SQL = `
  SELECT
    f.factTypeID,
    b.bowlerName,
    b.slug AS bowlerSlug,
    LOWER(se.period) + '-' + CAST(se.year AS VARCHAR) AS seasonSlug,
    f.week,
    se.year,
    f.value,
    f.previousValue,
    f.isCareerHigh,
    MONTH(f.referenceDate) AS refMonth,
    DAY(f.referenceDate) AS refDay,
    bm.category AS milestoneCategory,
    bm.ordinal AS milestoneOrdinal
  FROM facts f
  JOIN bowlers b ON b.bowlerID = f.bowlerID
  JOIN seasons se ON se.seasonID = f.seasonID
  LEFT JOIN bowlerMilestones bm
    ON f.factTypeID = 3
    AND bm.bowlerID = f.bowlerID
    AND bm.threshold = f.value
    AND bm.seasonID = f.seasonID
    AND bm.week = f.week
  WHERE f.isActive = 1
    AND (
      (f.factTypeID IN (1, 2) AND f.referenceDate IS NOT NULL)
      OR (f.factTypeID = 3 AND bm.ordinal IS NOT NULL AND bm.ordinal <= 100)
    )
`;

const BOWLER_FACTS_SQL = `
  SELECT
    f.factTypeID,
    b.bowlerName,
    b.slug AS bowlerSlug,
    LOWER(se.period) + '-' + CAST(se.year AS VARCHAR) AS seasonSlug,
    f.week,
    se.year,
    f.value,
    f.previousValue,
    f.isCareerHigh,
    f.referenceDate
  FROM facts f
  JOIN bowlers b ON b.bowlerID = f.bowlerID
  JOIN seasons se ON se.seasonID = f.seasonID
  WHERE f.isActive = 1
    AND f.factTypeID IN (1, 2)
    AND f.bowlerID = @bowlerID
  ORDER BY f.factTypeID, f.seasonID, f.week
`;

export async function getBowlerFacts(bowlerID: number): Promise<RandomFact[]> {
  const params = JSON.stringify({ bowlerID });
  return cachedQuery(
    'getBowlerFacts',
    async () => {
      const db = await getDb();
      const result = await db.request()
        .input('bowlerID', bowlerID)
        .query(BOWLER_FACTS_SQL);
      return result.recordset.map((r: Record<string, unknown>) => ({
        factTypeID: r.factTypeID as number,
        bowlerName: r.bowlerName as string,
        bowlerSlug: r.bowlerSlug as string,
        seasonSlug: r.seasonSlug as string,
        week: r.week as number,
        year: r.year as number,
        value: r.value as number,
        previousValue: (r.previousValue as number) ?? null,
        isCareerHigh: !!(r.isCareerHigh),
        referenceDate: r.referenceDate ? (r.referenceDate as Date).toISOString() : null,
        refMonth: null,
        refDay: null,
        milestoneCategory: null,
        milestoneOrdinal: null,
      }));
    },
    [],
    { sql: BOWLER_FACTS_SQL + params, dependsOn: ['scores'] },
  );
}

export async function getRandomFacts(): Promise<RandomFact[]> {
  return cachedQuery(
    'getRandomFacts',
    async () => {
      const db = await getDb();
      const result = await db.request().query(RANDOM_FACTS_SQL);
      return result.recordset.map((r: Record<string, unknown>) => ({
        factTypeID: r.factTypeID as number,
        bowlerName: r.bowlerName as string,
        bowlerSlug: r.bowlerSlug as string,
        seasonSlug: r.seasonSlug as string,
        week: r.week as number,
        year: r.year as number,
        value: r.value as number,
        previousValue: (r.previousValue as number) ?? null,
        isCareerHigh: !!(r.isCareerHigh),
        referenceDate: null,
        refMonth: (r.refMonth as number) ?? null,
        refDay: (r.refDay as number) ?? null,
        milestoneCategory: (r.milestoneCategory as string) ?? null,
        milestoneOrdinal: (r.milestoneOrdinal as number) ?? null,
      }));
    },
    [],
    { sql: RANDOM_FACTS_SQL, dependsOn: ['scores'] },
  );
}
