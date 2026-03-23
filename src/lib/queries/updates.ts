/**
 * Site updates query for the resources page.
 * Hits DB directly (no cachedQuery) since updates are admin-managed
 * and the page is revalidated on demand via revalidatePath.
 *
 * Special href markers resolved at render time:
 *   @team  -> /team/{random-active-team-slug}
 *   @bowler -> /bowler/{random-active-bowler-slug}
 */
import { getDb, withRetry } from '../db';

export interface SiteUpdateEntry {
  date: string;
  text: string;
  tag: 'fix' | 'feat';
  href?: string;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get all site updates for display, newest first.
 * Resolves @team and @bowler markers to random active slugs.
 */
export async function getSiteUpdates(): Promise<SiteUpdateEntry[]> {
  if (!process.env.AZURE_SQL_SERVER) return [];

  try {
    const db = await getDb();
    const result = await withRetry(
      () =>
        db.request().query<{
          updateDate: Date;
          text: string;
          tag: string;
          href: string | null;
        }>(`
          SELECT updateDate, text, tag, href
          FROM siteUpdates
          ORDER BY updateDate DESC, sortOrder DESC
        `),
      'getSiteUpdates',
    );

    // Check if we need to resolve any @team or @bowler markers
    const needsTeam = result.recordset.some(r => r.href?.startsWith('@team'));
    const needsBowler = result.recordset.some(r => r.href?.startsWith('@bowler'));

    let teamSlugs: string[] = [];
    let bowlerSlugs: string[] = [];

    if (needsTeam) {
      const teams = await db.request().query<{ slug: string }>(`
        SELECT DISTINCT t.slug FROM teams t
        JOIN scores sc ON sc.teamID = t.teamID
        WHERE sc.seasonID = (SELECT MAX(seasonID) FROM seasons)
      `);
      teamSlugs = teams.recordset.map(r => r.slug);
    }

    if (needsBowler) {
      const bowlers = await db.request().query<{ slug: string }>(`
        SELECT slug FROM bowlers WHERE isActive = 1 AND isPublic = 1
      `);
      bowlerSlugs = bowlers.recordset.map(r => r.slug);
    }

    return result.recordset.map((row) => {
      let href = row.href;
      if (href === '@team' && teamSlugs.length) {
        href = `/team/${pickRandom(teamSlugs)}`;
      } else if (href === '@bowler' && bowlerSlugs.length) {
        href = `/bowler/${pickRandom(bowlerSlugs)}`;
      }

      return {
        date: `${row.updateDate.getFullYear()}-${String(row.updateDate.getMonth() + 1).padStart(2, '0')}-${String(row.updateDate.getDate()).padStart(2, '0')}`,
        text: row.text,
        tag: (row.tag as 'fix' | 'feat') ?? 'feat',
        ...(href ? { href } : {}),
      };
    });
  } catch (err) {
    console.warn('getSiteUpdates: DB unavailable', err);
    return [];
  }
}
