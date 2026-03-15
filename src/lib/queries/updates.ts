/**
 * Site updates query for build-time rendering on the resources page.
 */
import { getDb, cachedQuery } from '../db';

export interface SiteUpdateEntry {
  date: string;
  text: string;
  tag: 'fix' | 'feat';
}

const SITE_UPDATES_SQL = `
  SELECT updateDate, text, tag
  FROM siteUpdates
  ORDER BY updateDate DESC, sortOrder DESC
`;

/**
 * Get all site updates for display, newest first.
 * Not marked stable since updates change frequently.
 */
export async function getSiteUpdates(): Promise<SiteUpdateEntry[]> {
  return cachedQuery(
    'getSiteUpdates',
    async () => {
      const db = await getDb();
      const result = await db.request().query<{
        updateDate: Date;
        text: string;
        tag: string;
      }>(SITE_UPDATES_SQL);
      return result.recordset.map((row) => ({
        date: row.updateDate.toISOString().split('T')[0],
        text: row.text,
        tag: (row.tag as 'fix' | 'feat') ?? 'feat',
      }));
    },
    [],
    { sql: SITE_UPDATES_SQL },
  );
}
