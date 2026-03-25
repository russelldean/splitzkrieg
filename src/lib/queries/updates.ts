/**
 * Site updates query for the resources page.
 * Hits DB directly (no cachedQuery) since updates are admin-managed
 * and the page is revalidated on demand via revalidatePath.
 */
import { getDb, withRetry } from '../db';

export interface SiteUpdateEntry {
  date: string;
  text: string;
  tag: 'fix' | 'feat';
  href?: string;
  description?: string;
}

/**
 * Get all site updates for display, newest first.
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
          description: string | null;
        }>(`
          SELECT updateDate, text, tag, href, description
          FROM siteUpdates
          ORDER BY updateDate DESC, sortOrder DESC
        `),
      'getSiteUpdates',
    );
    return result.recordset.map((row) => ({
      date: `${row.updateDate.getUTCFullYear()}-${String(row.updateDate.getUTCMonth() + 1).padStart(2, '0')}-${String(row.updateDate.getUTCDate()).padStart(2, '0')}`,
      text: row.text,
      tag: (row.tag as 'fix' | 'feat') ?? 'feat',
      ...(row.href ? { href: row.href } : {}),
      ...(row.description ? { description: row.description } : {}),
    }));
  } catch (err) {
    console.warn('getSiteUpdates: DB unavailable', err);
    return [];
  }
}
