import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrWriter } from '@/lib/admin/auth';
import {
  getAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '@/lib/admin/announcements-db';

export const dynamic = 'force-dynamic';

/**
 * GET: List all announcements for admin.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminOrWriter(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const announcements = await getAllAnnouncements();
    return NextResponse.json({ announcements });
  } catch (err) {
    console.error('Admin announcements GET error:', err);
    return NextResponse.json(
      { error: 'Failed to load announcements' },
      { status: 500 },
    );
  }
}

/**
 * POST: Create a new announcement.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminOrWriter(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { message, type, expires } = await request.json();
    if (!message || !type) {
      return NextResponse.json(
        { error: 'message and type are required' },
        { status: 400 },
      );
    }
    const id = await createAnnouncement({ message, type, expires: expires ?? null });
    return NextResponse.json({ id });
  } catch (err) {
    console.error('Admin announcements POST error:', err);
    return NextResponse.json(
      { error: 'Failed to create announcement' },
      { status: 500 },
    );
  }
}

/**
 * PUT: Update an existing announcement.
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAdminOrWriter(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { id, message, type, expires } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    await updateAnnouncement(id, { message, type, expires });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Admin announcements PUT error:', err);
    return NextResponse.json(
      { error: 'Failed to update announcement' },
      { status: 500 },
    );
  }
}

/**
 * DELETE: Remove an announcement.
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireAdminOrWriter(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    await deleteAnnouncement(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Admin announcements DELETE error:', err);
    return NextResponse.json(
      { error: 'Failed to delete announcement' },
      { status: 500 },
    );
  }
}
