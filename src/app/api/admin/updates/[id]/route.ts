import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { updateUpdate, deleteUpdate } from '@/lib/admin/updates-db';

export const dynamic = 'force-dynamic';

/**
 * PUT: Update a site update entry.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    await updateUpdate(id, body);
    revalidatePath('/resources', 'page');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Admin updates PUT error:', err);
    return NextResponse.json(
      { error: 'Failed to update' },
      { status: 500 },
    );
  }
}

/**
 * DELETE: Remove a site update entry.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    await deleteUpdate(id);
    revalidatePath('/resources', 'page');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Admin updates DELETE error:', err);
    return NextResponse.json(
      { error: 'Failed to delete' },
      { status: 500 },
    );
  }
}
