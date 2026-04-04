import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrWriter } from '@/lib/admin/auth';
import {
  getAllBlogPosts,
  createBlogPost,
} from '@/lib/admin/blog-db';

export const dynamic = 'force-dynamic';

/**
 * GET: List all blog posts for admin (drafts + published).
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminOrWriter(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const posts = await getAllBlogPosts();
    return NextResponse.json({ posts });
  } catch (err) {
    console.error('Admin blog GET error:', err);
    return NextResponse.json(
      { error: 'Failed to load blog posts' },
      { status: 500 },
    );
  }
}

/**
 * POST: Create a new blog post.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminOrWriter(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      slug,
      title,
      content,
      excerpt,
      type,
      seasonRomanNumeral,
      seasonSlug,
      week,
      heroImage,
      heroFocalY,
      cardImage,
      cardFocalY,
      publishedAt,
    } = body;

    if (!slug || !title) {
      return NextResponse.json(
        { error: 'slug and title are required' },
        { status: 400 },
      );
    }

    const id = await createBlogPost({
      slug,
      title,
      content: content ?? '',
      excerpt: excerpt ?? null,
      type: type ?? 'announcement',
      seasonRomanNumeral: seasonRomanNumeral ?? null,
      seasonSlug: seasonSlug ?? null,
      week: week ?? null,
      heroImage: heroImage ?? null,
      heroFocalY: heroFocalY ?? null,
      cardImage: cardImage ?? null,
      cardFocalY: cardFocalY ?? null,
      discoveryLinks: null,
      publishedAt: publishedAt ?? null,
    });

    return NextResponse.json({ id });
  } catch (err) {
    console.error('Admin blog POST error:', err);
    return NextResponse.json(
      { error: 'Failed to create blog post' },
      { status: 500 },
    );
  }
}
