#!/usr/bin/env node
/**
 * Migrate existing MDX blog posts from content/blog/ to the blogPosts DB table.
 * Runs idempotently: skips posts whose slug already exists in the DB.
 *
 * Usage: node scripts/migrate-blog-to-db.mjs
 */

import sql from 'mssql';
import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const BLOG_DIR = resolve(PROJECT_ROOT, 'content', 'blog');

// ---- Load env ----
const envContent = readFileSync(resolve(PROJECT_ROOT, '.env.local'), 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
};

async function main() {
  const pool = await sql.connect(config);
  console.log('Connected to DB');

  const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx'));
  console.log(`Found ${files.length} MDX file(s) in content/blog/`);

  let inserted = 0;
  let skipped = 0;

  for (const filename of files) {
    const filePath = resolve(BLOG_DIR, filename);
    const raw = readFileSync(filePath, 'utf8');
    const { data, content } = matter(raw);

    const slug = data.slug || filename.replace('.mdx', '');

    // Check if slug already exists
    const existing = await pool
      .request()
      .input('slug', sql.VarChar(255), slug)
      .query('SELECT postID FROM blogPosts WHERE slug = @slug');

    if (existing.recordset.length > 0) {
      console.log(`  SKIP: ${slug} (already exists as postID ${existing.recordset[0].postID})`);
      skipped++;
      continue;
    }

    // Determine seasonID from romanNumeral if available
    let seasonID = null;
    if (data.season) {
      const seasonResult = await pool
        .request()
        .input('rn', sql.VarChar(10), data.season)
        .query('SELECT seasonID FROM seasons WHERE romanNumeral = @rn');
      if (seasonResult.recordset.length > 0) {
        seasonID = seasonResult.recordset[0].seasonID;
      }
    }

    const publishedDate = data.date ? new Date(data.date + 'T12:00:00Z') : null;

    await pool
      .request()
      .input('slug', sql.VarChar(255), slug)
      .input('title', sql.VarChar(255), data.title || filename.replace('.mdx', ''))
      .input('content', sql.NVarChar(sql.MAX), content.trim())
      .input('excerpt', sql.NVarChar(500), data.excerpt || null)
      .input('type', sql.VarChar(20), data.type || 'announcement')
      .input('seasonRomanNumeral', sql.VarChar(10), data.season || null)
      .input('seasonSlug', sql.VarChar(50), data.seasonSlug || null)
      .input('seasonID', sql.Int, seasonID)
      .input('week', sql.Int, data.week ?? null)
      .input('heroImage', sql.VarChar(255), data.heroImage || null)
      .input('heroFocalY', sql.Decimal(3, 2), data.heroFocalY ?? null)
      .input('publishedDate', sql.DateTime2, publishedDate)
      .input('isPublished', sql.Bit, publishedDate ? 1 : 0)
      .query(`
        INSERT INTO blogPosts
          (slug, title, content, excerpt, type, seasonRomanNumeral, seasonSlug, seasonID, week,
           heroImage, heroFocalY, publishedDate, isPublished, createdDate, modifiedDate)
        VALUES
          (@slug, @title, @content, @excerpt, @type, @seasonRomanNumeral, @seasonSlug, @seasonID, @week,
           @heroImage, @heroFocalY, @publishedDate, @isPublished, GETDATE(), GETDATE())
      `);

    console.log(`  INSERT: ${slug} (${data.title})`);
    inserted++;
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped`);
  await pool.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
