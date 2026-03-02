/**
 * Named SQL query functions for build-time data fetching.
 *
 * All SQL lives here — page components call these functions, never raw SQL.
 * These functions are server-only (imported via db.ts).
 *
 * Phase 1: Minimal queries for static page generation.
 * Phase 2: Expand getBowlerBySlug with full stats, career history, records.
 */
import { getDb } from './db';

export interface BowlerSlug {
  slug: string;
}

export interface Bowler {
  bowlerID: number;
  firstName: string;
  lastName: string;
  slug: string;
  isActive: boolean | null;
}

/**
 * Returns all bowler slugs for generateStaticParams.
 * Includes ALL bowlers (active and inactive) so historical profiles work.
 * Slug format: firstname-lastname (lowercased, spaces replaced with hyphens).
 */
export async function getAllBowlerSlugs(): Promise<BowlerSlug[]> {
  const db = await getDb();
  const result = await db.request().query<{ slug: string }>(`
    SELECT
      LOWER(REPLACE(firstName, ' ', '-')) + '-' + LOWER(REPLACE(lastName, ' ', '-')) AS slug
    FROM bowlers
    ORDER BY lastName, firstName
  `);
  return result.recordset;
}

/**
 * Returns a single bowler record by slug.
 * Slug is matched by reconstructing it from firstName + lastName.
 *
 * Phase 1: Returns minimal fields for scaffold page.
 * Phase 2: Expand with career stats, season history, personal records.
 */
export async function getBowlerBySlug(slug: string): Promise<Bowler | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input('slug', slug)
    .query<Bowler>(`
      SELECT
        bowlerID,
        firstName,
        lastName,
        isActive,
        LOWER(REPLACE(firstName, ' ', '-')) + '-' + LOWER(REPLACE(lastName, ' ', '-')) AS slug
      FROM bowlers
      WHERE LOWER(REPLACE(firstName, ' ', '-')) + '-' + LOWER(REPLACE(lastName, ' ', '-')) = @slug
    `);
  return result.recordset[0] ?? null;
}
