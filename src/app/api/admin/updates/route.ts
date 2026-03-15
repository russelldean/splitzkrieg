import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { getAllUpdates, createUpdate, createUpdates } from '@/lib/admin/updates-db';

export const dynamic = 'force-dynamic';

/**
 * GET: List all site updates (newest first).
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const updates = await getAllUpdates();
    return NextResponse.json({ updates });
  } catch (err) {
    console.error('Admin updates GET error:', err);
    return NextResponse.json(
      { error: 'Failed to load updates' },
      { status: 500 },
    );
  }
}

/**
 * POST: Create one or more updates.
 * Body: { date, text, tag } for single, or { items: [...] } for bulk.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Bulk create
    if (Array.isArray(body.items)) {
      for (const item of body.items) {
        if (!item.date || !item.text) {
          return NextResponse.json(
            { error: 'Each item requires date and text' },
            { status: 400 },
          );
        }
      }
      const ids = await createUpdates(body.items);
      revalidatePath('/resources', 'page');
      return NextResponse.json({ ids });
    }

    // Single create
    const { date, text, tag } = body;
    if (!date || !text) {
      return NextResponse.json(
        { error: 'date and text are required' },
        { status: 400 },
      );
    }

    const id = await createUpdate({ date, text, tag: tag ?? 'feat' });
    revalidatePath('/resources', 'page');
    return NextResponse.json({ id });
  } catch (err) {
    console.error('Admin updates POST error:', err);
    return NextResponse.json(
      { error: 'Failed to create update' },
      { status: 500 },
    );
  }
}
