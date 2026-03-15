import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminOrWriter } from '@/lib/admin/auth';
import {
  getBlogPostById,
  updateBlogPost,
  deleteBlogPost,
} from '@/lib/admin/blog-db';

export const dynamic = 'force-dynamic';

/**
 * GET: Single blog post by ID (for admin editor).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminOrWriter(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const postId = parseInt(id, 10);
    if (isNaN(postId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const post = await getBlogPostById(postId);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (err) {
    console.error('Admin blog GET [id] error:', err);
    return NextResponse.json(
      { error: 'Failed to load blog post' },
      { status: 500 },
    );
  }
}

/**
 * PUT: Update a blog post by ID.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminOrWriter(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const postId = parseInt(id, 10);
    if (isNaN(postId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    await updateBlogPost(postId, body);

    // Revalidate blog pages when publish state changes
    if ('publishedAt' in body) {
      revalidatePath('/blog', 'page');
      if (body.slug) {
        revalidatePath(`/blog/${body.slug}`, 'page');
      }
    }

    return NextResponse.json({ updated: true });
  } catch (err) {
    console.error('Admin blog PUT error:', err);
    return NextResponse.json(
      { error: 'Failed to update blog post' },
      { status: 500 },
    );
  }
}

/**
 * DELETE: Delete a blog post by ID.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminOrWriter(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const postId = parseInt(id, 10);
    if (isNaN(postId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await deleteBlogPost(postId);
    revalidatePath('/blog', 'page');
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('Admin blog DELETE error:', err);
    return NextResponse.json(
      { error: 'Failed to delete blog post' },
      { status: 500 },
    );
  }
}
