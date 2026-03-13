/**
 * Build-time search index generation for client-side fuzzy search.
 *
 * Queries Azure SQL for all bowlers and returns a lightweight array
 * of {id, name, slug, seasonsActive} entries. This runs ONLY at build
 * time via the /api/search-index static route handler.
 *
 * The resulting JSON is served as a static file — no DB queries at runtime.
 */
import { getDb } from './db';

export interface SearchEntry {
  id: number;
  name: string;
  slug: string;
  seasonsActive: number;
  type: 'bowler' | 'team';
}

/**
 * Generate the search index from Azure SQL bowler data.
 *
 * Uses the slug column directly from the bowlers table (same as
 * getAllBowlerSlugs and getBowlerBySlug in queries.ts) to ensure
 * search result links match pre-rendered bowler pages exactly.
 *
 * Returns empty array if DB credentials are not configured.
 */
export async function generateSearchIndex(): Promise<SearchEntry[]> {
  if (!process.env.AZURE_SQL_SERVER) {
    return [];
  }
  try {
    const db = await getDb();
    const [bowlerResult, teamResult] = await Promise.all([
      db.request().query<{
        bowlerID: number;
        bowlerName: string;
        slug: string;
        seasonsActive: number;
      }>(`
        SELECT
          b.bowlerID,
          b.bowlerName,
          b.slug,
          COUNT(DISTINCT r.seasonID) AS seasonsActive
        FROM bowlers b
        LEFT JOIN teamRosters r ON r.bowlerID = b.bowlerID
        GROUP BY b.bowlerID, b.bowlerName, b.slug
        ORDER BY b.bowlerName
      `),
      db.request().query<{
        teamID: number;
        teamName: string;
        slug: string;
        seasonsActive: number;
      }>(`
        SELECT
          t.teamID,
          t.teamName,
          t.slug,
          COUNT(DISTINCT h.seasonID) AS seasonsActive
        FROM teams t
        LEFT JOIN teamNameHistory h ON h.teamID = t.teamID
        WHERE t.slug IS NOT NULL
        GROUP BY t.teamID, t.teamName, t.slug
        ORDER BY t.teamName
      `),
    ]);
    const bowlers: SearchEntry[] = bowlerResult.recordset.map((row) => ({
      id: row.bowlerID,
      name: row.bowlerName,
      slug: row.slug,
      seasonsActive: row.seasonsActive,
      type: 'bowler',
    }));
    const teams: SearchEntry[] = teamResult.recordset.map((row) => ({
      id: row.teamID,
      name: row.teamName,
      slug: row.slug,
      seasonsActive: row.seasonsActive,
      type: 'team',
    }));
    return [...bowlers, ...teams];
  } catch (err) {
    console.warn('generateSearchIndex: DB unavailable, returning empty list.', err);
    return [];
  }
}
