import { NextResponse } from 'next/server';
import { getActiveAnnouncements } from '@/lib/admin/announcements-db';

export const dynamic = 'force-dynamic';

/**
 * Public endpoint: returns active (non-expired) announcements.
 * Called client-side by AnnouncementBanner.
 */
export async function GET() {
  try {
    const announcements = await getActiveAnnouncements();
    return NextResponse.json({ announcements });
  } catch (err) {
    console.error('Announcements GET error:', err);
    return NextResponse.json({ announcements: [] });
  }
}
