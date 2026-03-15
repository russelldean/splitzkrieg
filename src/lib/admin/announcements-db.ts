/**
 * Announcements CRUD operations against Azure SQL.
 * Replaces the static content/announcements.ts file.
 */

import sql from 'mssql';
import { getDb, withRetry } from '@/lib/db';

export interface Announcement {
  id: number;
  message: string;
  type: 'info' | 'urgent' | 'celebration';
  expires: string | null;
  createdAt: string;
}

function rowToAnnouncement(row: Record<string, unknown>): Announcement {
  return {
    id: row.announcementID as number,
    message: row.message as string,
    type: row.type as 'info' | 'urgent' | 'celebration',
    expires: row.expires
      ? (row.expires as Date).toISOString().slice(0, 10)
      : null,
    createdAt: row.createdDate
      ? (row.createdDate as Date).toISOString()
      : new Date().toISOString(),
  };
}

/**
 * Get all announcements (admin view), newest first.
 */
export async function getAllAnnouncements(): Promise<Announcement[]> {
  const db = await getDb();
  const result = await withRetry(
    () =>
      db
        .request()
        .query(
          'SELECT announcementID, message, type, expires, createdDate FROM announcements ORDER BY createdDate DESC',
        ),
    'getAllAnnouncements',
  );
  return result.recordset.map(rowToAnnouncement);
}

/**
 * Get active (non-expired) announcements for public display.
 */
export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const db = await getDb();
  const result = await withRetry(
    () =>
      db
        .request()
        .query(
          `SELECT announcementID, message, type, expires, createdDate
           FROM announcements
           WHERE expires IS NULL OR expires > CAST(GETDATE() AS DATE)
           ORDER BY createdDate DESC`,
        ),
    'getActiveAnnouncements',
  );
  return result.recordset.map(rowToAnnouncement);
}

/**
 * Create a new announcement. Returns the new ID.
 */
export async function createAnnouncement(data: {
  message: string;
  type: 'info' | 'urgent' | 'celebration';
  expires: string | null;
}): Promise<number> {
  const db = await getDb();
  const result = await withRetry(
    () =>
      db
        .request()
        .input('message', sql.NVarChar(500), data.message)
        .input('type', sql.VarChar(20), data.type)
        .input('expires', sql.Date, data.expires ? new Date(data.expires) : null)
        .query(`
          INSERT INTO announcements (message, type, expires, createdDate)
          VALUES (@message, @type, @expires, GETDATE());
          SELECT SCOPE_IDENTITY() AS id;
        `),
    'createAnnouncement',
  );
  return result.recordset[0].id;
}

/**
 * Update an announcement by ID.
 */
export async function updateAnnouncement(
  id: number,
  data: { message?: string; type?: string; expires?: string | null },
): Promise<void> {
  const db = await getDb();
  const setClauses: string[] = [];
  const req = db.request().input('id', sql.Int, id);

  if (data.message !== undefined) {
    req.input('message', sql.NVarChar(500), data.message);
    setClauses.push('message = @message');
  }
  if (data.type !== undefined) {
    req.input('type', sql.VarChar(20), data.type);
    setClauses.push('type = @type');
  }
  if (data.expires !== undefined) {
    req.input('expires', sql.Date, data.expires ? new Date(data.expires) : null);
    setClauses.push('expires = @expires');
  }

  if (setClauses.length === 0) return;

  await withRetry(
    () =>
      req.query(
        `UPDATE announcements SET ${setClauses.join(', ')} WHERE announcementID = @id`,
      ),
    'updateAnnouncement',
  );
}

/**
 * Delete an announcement by ID.
 */
export async function deleteAnnouncement(id: number): Promise<void> {
  const db = await getDb();
  await withRetry(
    () =>
      db
        .request()
        .input('id', sql.Int, id)
        .query('DELETE FROM announcements WHERE announcementID = @id'),
    'deleteAnnouncement',
  );
}
