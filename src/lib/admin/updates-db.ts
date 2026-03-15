/**
 * Site Updates CRUD operations against Azure SQL.
 * Maps between the DB schema (updateID, updateDate, etc.)
 * and the SiteUpdate interface used by the admin UI.
 */

import sql from 'mssql';
import { getDb, withRetry } from '@/lib/db';

export interface SiteUpdate {
  id: number;
  date: string;       // YYYY-MM-DD
  text: string;
  tag: 'fix' | 'feat';
  sortOrder: number;
  createdAt: string;
}

function rowToUpdate(row: Record<string, unknown>): SiteUpdate {
  const d = row.updateDate as Date;
  return {
    id: row.updateID as number,
    date: d.toISOString().split('T')[0],
    text: row.text as string,
    tag: (row.tag as 'fix' | 'feat') ?? 'feat',
    sortOrder: (row.sortOrder as number) ?? 0,
    createdAt: row.createdDate
      ? (row.createdDate as Date).toISOString()
      : new Date().toISOString(),
  };
}

/**
 * Get all updates ordered by date DESC, then sortOrder DESC (newest first).
 */
export async function getAllUpdates(): Promise<SiteUpdate[]> {
  const db = await getDb();
  const result = await withRetry(
    () =>
      db
        .request()
        .query(
          'SELECT updateID, updateDate, text, tag, sortOrder, createdDate FROM siteUpdates ORDER BY updateDate DESC, sortOrder DESC',
        ),
    'getAllUpdates',
  );
  return result.recordset.map(rowToUpdate);
}

/**
 * Create a new update. Returns the new ID.
 */
export async function createUpdate(data: {
  date: string;
  text: string;
  tag: string;
}): Promise<number> {
  const db = await getDb();
  // sortOrder = max existing sortOrder for that date + 1
  const result = await withRetry(
    () =>
      db
        .request()
        .input('date', sql.Date, data.date)
        .input('text', sql.NVarChar(500), data.text)
        .input('tag', sql.VarChar(10), data.tag)
        .query(`
          DECLARE @maxSort INT;
          SELECT @maxSort = ISNULL(MAX(sortOrder), -1) FROM siteUpdates WHERE updateDate = @date;
          INSERT INTO siteUpdates (updateDate, text, tag, sortOrder)
          VALUES (@date, @text, @tag, @maxSort + 1);
          SELECT SCOPE_IDENTITY() AS id;
        `),
    'createUpdate',
  );
  return result.recordset[0].id;
}

/**
 * Create multiple updates in a single transaction. Returns array of new IDs.
 */
export async function createUpdates(
  items: Array<{ date: string; text: string; tag: string }>,
): Promise<number[]> {
  const db = await getDb();
  const ids: number[] = [];
  const tx = db.transaction();
  await tx.begin();
  try {
    for (const item of items) {
      const result = await tx
        .request()
        .input('date', sql.Date, item.date)
        .input('text', sql.NVarChar(500), item.text)
        .input('tag', sql.VarChar(10), item.tag)
        .query(`
          DECLARE @maxSort INT;
          SELECT @maxSort = ISNULL(MAX(sortOrder), -1) FROM siteUpdates WHERE updateDate = @date;
          INSERT INTO siteUpdates (updateDate, text, tag, sortOrder)
          VALUES (@date, @text, @tag, @maxSort + 1);
          SELECT SCOPE_IDENTITY() AS id;
        `);
      ids.push(result.recordset[0].id);
    }
    await tx.commit();
    return ids;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/**
 * Update an existing update by ID.
 */
export async function updateUpdate(
  id: number,
  data: Partial<{ date: string; text: string; tag: string }>,
): Promise<void> {
  const db = await getDb();
  const setClauses: string[] = [];
  const req = db.request().input('id', sql.Int, id);

  if (data.date !== undefined) {
    req.input('date', sql.Date, data.date);
    setClauses.push('updateDate = @date');
  }
  if (data.text !== undefined) {
    req.input('text', sql.NVarChar(500), data.text);
    setClauses.push('text = @text');
  }
  if (data.tag !== undefined) {
    req.input('tag', sql.VarChar(10), data.tag);
    setClauses.push('tag = @tag');
  }

  if (setClauses.length === 0) return;

  await withRetry(
    () =>
      req.query(
        `UPDATE siteUpdates SET ${setClauses.join(', ')} WHERE updateID = @id`,
      ),
    'updateUpdate',
  );
}

/**
 * Delete an update by ID.
 */
export async function deleteUpdate(id: number): Promise<void> {
  const db = await getDb();
  await withRetry(
    () =>
      db
        .request()
        .input('id', sql.Int, id)
        .query('DELETE FROM siteUpdates WHERE updateID = @id'),
    'deleteUpdate',
  );
}
