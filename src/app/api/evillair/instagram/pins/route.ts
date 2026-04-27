/**
 * GET/POST /api/evillair/instagram/pins
 * Read or update the 3 pinned Instagram photos for the homepage.
 * Stored in leagueSettings as JSON: { pins: [{ id, mediaUrl, caption, permalink }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const db = await getDb();
    const result = await db.request().query<{ settingValue: string }>(
      `SELECT settingValue FROM leagueSettings WHERE settingKey = 'instagramPins'`,
    );
    const val = result.recordset[0]?.settingValue;
    const pins = val ? JSON.parse(val).pins ?? [] : [];
    return NextResponse.json({ pins });
  } catch (err) {
    console.error('Instagram pins read error:', err);
    return NextResponse.json({ pins: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { pins } = await request.json();

    if (!Array.isArray(pins) || pins.length > 6) {
      return NextResponse.json({ error: 'Pins must be an array of up to 6 items' }, { status: 400 });
    }

    const db = await getDb();
    const value = JSON.stringify({ pins });

    await db.request().query(`
      IF EXISTS (SELECT 1 FROM leagueSettings WHERE settingKey = 'instagramPins')
        UPDATE leagueSettings SET settingValue = '${value.replace(/'/g, "''")}' WHERE settingKey = 'instagramPins'
      ELSE
        INSERT INTO leagueSettings (settingKey, settingValue) VALUES ('instagramPins', '${value.replace(/'/g, "''")}')
    `);

    // Revalidate homepage so pinned photos appear immediately
    revalidatePath('/', 'page');

    return NextResponse.json({ ok: true, pins });
  } catch (err) {
    console.error('Instagram pins save error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save pins' },
      { status: 500 },
    );
  }
}
