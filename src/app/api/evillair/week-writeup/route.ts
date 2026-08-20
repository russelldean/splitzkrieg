import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { requireAdminOrWriter } from '@/lib/admin/auth';
import { getDb, withRetry } from '@/lib/db';
import { createBlogPost } from '@/lib/admin/blog-db';
import { recapSlug, recapTitle } from '@/lib/recap-naming';

export const dynamic = 'force-dynamic';

interface WeekPost {
  postID: number;
  heroImage: string | null;
  contentChars: number | string | null;
}

/**
 * Find this week's post. Matches on seasonRomanNumeral as well as seasonID,
 * because blogPosts.seasonID is NULL on all but one row.
 */
async function findWeekPost(seasonSlug: string, week: number): Promise<WeekPost | null> {
  const db = await getDb();
  const result = await withRetry(
    () =>
      db
        .request()
        .input('seasonSlug', sql.VarChar(50), seasonSlug)
        .input('week', sql.Int, week)
        .query<WeekPost>(`
          SELECT TOP 1 postID, heroImage, LEN(ISNULL(content, '')) AS contentChars
          FROM blogPosts
          WHERE week = @week AND seasonSlug = @seasonSlug
        `),
    'week-writeup:find',
  );
  return result.recordset[0] ?? null;
}

async function seasonRoman(seasonSlug: string): Promise<string | null> {
  const db = await getDb();
  const r = await withRetry(
    () =>
      db
        .request()
        .input('slug', sql.VarChar(50), seasonSlug)
        .query<{ romanNumeral: string }>(`
          SELECT TOP 1 romanNumeral FROM seasons
          WHERE LOWER(CONCAT(period, '-', year)) = LOWER(@slug)
        `),
    'week-writeup:season',
  );
  return r.recordset[0]?.romanNumeral ?? null;
}

/** GET: does this week have a writeup and a photo, and which post holds them. */
export async function GET(request: NextRequest) {
  try {
    await requireAdminOrWriter(request);
  } catch {
    // Not an admin. The week page renders nothing rather than revealing that
    // an admin surface exists here at all.
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const seasonSlug = request.nextUrl.searchParams.get('seasonSlug');
  const week = parseInt(request.nextUrl.searchParams.get('week') ?? '', 10);
  if (!seasonSlug || Number.isNaN(week)) {
    return NextResponse.json({ error: 'seasonSlug and week are required' }, { status: 400 });
  }

  try {
    const post = await findWeekPost(seasonSlug, week);
    return NextResponse.json({
      postID: post?.postID ?? null,
      hasPhoto: Boolean(post?.heroImage),
      hasWriteup: Number(post?.contentChars ?? 0) > 0,
    });
  } catch (err) {
    console.error('[WEEK_WRITEUP]', err);
    return NextResponse.json({ error: 'Failed to read week writeup state' }, { status: 500 });
  }
}

/**
 * POST: ensure a post exists for this week and return its ID.
 *
 * Idempotent: if one already exists it is returned untouched rather than
 * duplicated, so double clicking cannot produce two posts for one week.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminOrWriter(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { seasonSlug, week } = (await request.json()) as {
      seasonSlug?: string;
      week?: number;
    };
    if (!seasonSlug || week == null) {
      return NextResponse.json({ error: 'seasonSlug and week are required' }, { status: 400 });
    }

    const existing = await findWeekPost(seasonSlug, week);
    if (existing) return NextResponse.json({ postID: existing.postID, created: false });

    const roman = await seasonRoman(seasonSlug);
    if (!roman) {
      return NextResponse.json({ error: `Unknown season slug: ${seasonSlug}` }, { status: 400 });
    }

    // Empty content on purpose: every stat on the week page comes from the page
    // itself, so a template would only be something to delete.
    const postID = await createBlogPost({
      slug: recapSlug(roman, week),
      title: recapTitle(roman, week),
      content: '',
      excerpt: null,
      type: 'recap',
      seasonRomanNumeral: roman,
      seasonSlug,
      week,
      heroImage: null,
      heroFocalY: null,
      cardImage: null,
      cardFocalY: null,
      publishedAt: null,
      // Column exists but is unread and unwritten; see project_recap_week_merge.
      discoveryLinks: null,
    });

    return NextResponse.json({ postID, created: true });
  } catch (err) {
    console.error('[WEEK_WRITEUP]', err);
    return NextResponse.json({ error: 'Failed to create the week post' }, { status: 500 });
  }
}
