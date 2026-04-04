/**
 * Blog CRUD operations against Azure SQL.
 * Maps between the DB schema (postID, publishedDate, etc.)
 * and the BlogPost interface used by the admin UI.
 */

import sql from 'mssql';
import { getDb, withRetry } from '@/lib/db';
import type { BlogPost } from './types';

/** Map a DB row to a BlogPost interface object. */
function rowToPost(row: Record<string, unknown>): BlogPost {
  return {
    id: row.postID as number,
    slug: row.slug as string,
    title: row.title as string,
    content: (row.content as string) ?? '',
    excerpt: (row.excerpt as string) ?? null,
    type: (row.type as 'recap' | 'announcement') ?? 'announcement',
    seasonRomanNumeral: (row.seasonRomanNumeral as string) ?? null,
    seasonSlug: (row.seasonSlug as string) ?? null,
    week: (row.week as number) ?? null,
    heroImage: (row.heroImage as string) ?? null,
    heroFocalY: row.heroFocalY != null ? Number(row.heroFocalY) : null,
    cardImage: (row.cardImage as string) ?? null,
    cardFocalY: row.cardFocalY != null ? Number(row.cardFocalY) : null,
    discoveryLinks: (row.discoveryLinks as string) ?? null,
    publishedAt: row.publishedDate
      ? (row.publishedDate as Date).toISOString()
      : null,
    createdAt: row.createdDate
      ? (row.createdDate as Date).toISOString()
      : new Date().toISOString(),
    updatedAt: row.modifiedDate
      ? (row.modifiedDate as Date).toISOString()
      : new Date().toISOString(),
  };
}

const SELECT_COLS = `
  postID, slug, title, content, excerpt, type,
  seasonRomanNumeral, seasonSlug, week,
  heroImage, heroFocalY, cardImage, cardFocalY, discoveryLinks,
  publishedDate, isPublished, createdDate, modifiedDate
`;

/**
 * Get all blog posts (admin view), newest first by createdDate.
 */
export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const db = await getDb();
  const result = await withRetry(
    () =>
      db
        .request()
        .query(
          `SELECT ${SELECT_COLS} FROM blogPosts ORDER BY createdDate DESC`,
        ),
    'getAllBlogPosts',
  );
  return result.recordset.map(rowToPost);
}

/**
 * Get published blog posts, ordered by publishedDate DESC.
 */
export async function getPublishedBlogPosts(): Promise<BlogPost[]> {
  const db = await getDb();
  const result = await withRetry(
    () =>
      db
        .request()
        .query(
          `SELECT ${SELECT_COLS} FROM blogPosts WHERE isPublished = 1 AND publishedDate IS NOT NULL ORDER BY publishedDate DESC`,
        ),
    'getPublishedBlogPosts',
  );
  return result.recordset.map(rowToPost);
}

/**
 * Get a single blog post by slug (for public pages).
 */
export async function getBlogPostBySlug(
  slug: string,
): Promise<BlogPost | null> {
  const db = await getDb();
  const result = await withRetry(
    () =>
      db
        .request()
        .input('slug', sql.VarChar(255), slug)
        .query(`SELECT ${SELECT_COLS} FROM blogPosts WHERE slug = @slug`),
    'getBlogPostBySlug',
  );
  return result.recordset.length > 0 ? rowToPost(result.recordset[0]) : null;
}

/**
 * Get a single blog post by ID (for admin editor).
 */
export async function getBlogPostById(
  id: number,
): Promise<BlogPost | null> {
  const db = await getDb();
  const result = await withRetry(
    () =>
      db
        .request()
        .input('id', sql.Int, id)
        .query(`SELECT ${SELECT_COLS} FROM blogPosts WHERE postID = @id`),
    'getBlogPostById',
  );
  return result.recordset.length > 0 ? rowToPost(result.recordset[0]) : null;
}

/**
 * Create a new blog post. Returns the new post ID.
 */
export async function createBlogPost(
  data: Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<number> {
  const db = await getDb();
  const result = await withRetry(
    () =>
      db
        .request()
        .input('slug', sql.VarChar(255), data.slug)
        .input('title', sql.VarChar(255), data.title)
        .input('content', sql.NVarChar(sql.MAX), data.content)
        .input('excerpt', sql.NVarChar(500), data.excerpt)
        .input('type', sql.VarChar(20), data.type ?? 'announcement')
        .input(
          'seasonRomanNumeral',
          sql.VarChar(10),
          data.seasonRomanNumeral,
        )
        .input('seasonSlug', sql.VarChar(50), data.seasonSlug)
        .input('week', sql.Int, data.week)
        .input('heroImage', sql.VarChar(255), data.heroImage)
        .input('heroFocalY', sql.Decimal(3, 2), data.heroFocalY)
        .input('cardImage', sql.VarChar(500), data.cardImage)
        .input('cardFocalY', sql.Decimal(3, 2), data.cardFocalY ?? null)
        .input(
          'publishedDate',
          sql.DateTime2,
          data.publishedAt ? new Date(data.publishedAt) : null,
        )
        .input('isPublished', sql.Bit, data.publishedAt ? 1 : 0)
        .query(`
          INSERT INTO blogPosts
            (slug, title, content, excerpt, type, seasonRomanNumeral, seasonSlug, week,
             heroImage, heroFocalY, cardImage, cardFocalY, publishedDate, isPublished, createdDate, modifiedDate)
          VALUES
            (@slug, @title, @content, @excerpt, @type, @seasonRomanNumeral, @seasonSlug, @week,
             @heroImage, @heroFocalY, @cardImage, @cardFocalY, @publishedDate, @isPublished, GETDATE(), GETDATE());
          SELECT SCOPE_IDENTITY() AS id;
        `),
    'createBlogPost',
  );
  return result.recordset[0].id;
}

/**
 * Update a blog post by ID. Only updates provided fields.
 * Always sets modifiedDate to current time.
 */
export async function updateBlogPost(
  id: number,
  data: Partial<BlogPost>,
): Promise<void> {
  const db = await getDb();
  const setClauses: string[] = ['modifiedDate = GETDATE()'];
  const req = db.request().input('id', sql.Int, id);

  if (data.slug !== undefined) {
    req.input('slug', sql.VarChar(255), data.slug);
    setClauses.push('slug = @slug');
  }
  if (data.title !== undefined) {
    req.input('title', sql.VarChar(255), data.title);
    setClauses.push('title = @title');
  }
  if (data.content !== undefined) {
    req.input('content', sql.NVarChar(sql.MAX), data.content);
    setClauses.push('content = @content');
  }
  if (data.excerpt !== undefined) {
    req.input('excerpt', sql.NVarChar(500), data.excerpt);
    setClauses.push('excerpt = @excerpt');
  }
  if (data.type !== undefined) {
    req.input('type', sql.VarChar(20), data.type);
    setClauses.push('type = @type');
  }
  if (data.seasonRomanNumeral !== undefined) {
    req.input(
      'seasonRomanNumeral',
      sql.VarChar(10),
      data.seasonRomanNumeral,
    );
    setClauses.push('seasonRomanNumeral = @seasonRomanNumeral');
  }
  if (data.seasonSlug !== undefined) {
    req.input('seasonSlug', sql.VarChar(50), data.seasonSlug);
    setClauses.push('seasonSlug = @seasonSlug');
  }
  if (data.week !== undefined) {
    req.input('week', sql.Int, data.week);
    setClauses.push('week = @week');
  }
  if (data.heroImage !== undefined) {
    req.input('heroImage', sql.VarChar(255), data.heroImage);
    setClauses.push('heroImage = @heroImage');
  }
  if (data.heroFocalY !== undefined) {
    req.input('heroFocalY', sql.Decimal(3, 2), data.heroFocalY);
    setClauses.push('heroFocalY = @heroFocalY');
  }
  if (data.cardImage !== undefined) {
    req.input('cardImage', sql.VarChar(500), data.cardImage);
    setClauses.push('cardImage = @cardImage');
  }
  if (data.cardFocalY !== undefined) {
    req.input('cardFocalY', sql.Decimal(3, 2), data.cardFocalY);
    setClauses.push('cardFocalY = @cardFocalY');
  }
  if (data.discoveryLinks !== undefined) {
    req.input('discoveryLinks', sql.NVarChar(sql.MAX), data.discoveryLinks);
    setClauses.push('discoveryLinks = @discoveryLinks');
  }
  if (data.publishedAt !== undefined) {
    const pubDate = data.publishedAt ? new Date(data.publishedAt) : null;
    req.input('publishedDate', sql.DateTime2, pubDate);
    req.input('isPublished', sql.Bit, pubDate ? 1 : 0);
    setClauses.push('publishedDate = @publishedDate');
    setClauses.push('isPublished = @isPublished');
  }

  await withRetry(
    () =>
      req.query(
        `UPDATE blogPosts SET ${setClauses.join(', ')} WHERE postID = @id`,
      ),
    'updateBlogPost',
  );
}

/**
 * Delete a blog post by ID.
 */
export async function deleteBlogPost(id: number): Promise<void> {
  const db = await getDb();
  await withRetry(
    () =>
      db
        .request()
        .input('id', sql.Int, id)
        .query('DELETE FROM blogPosts WHERE postID = @id'),
    'deleteBlogPost',
  );
}
