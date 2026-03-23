/**
 * GET  /api/admin/new-blog-badge — Check if badge is active
 * POST /api/admin/new-blog-badge — Toggle badge on/off
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

  const db = await getDb();
  const result = await db.request().query<{ settingValue: string }>(
    `SELECT settingValue FROM leagueSettings WHERE settingKey = 'newBlogPost'`
  );
  const active = result.recordset[0]?.settingValue === '1';
  return NextResponse.json({ active });
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { active } = (await request.json()) as { active: boolean };
  const db = await getDb();
  await db.request().query(
    `UPDATE leagueSettings SET settingValue = '${active ? '1' : '0'}' WHERE settingKey = 'newBlogPost'`
  );

  // Revalidate all pages that show the header
  revalidatePath('/', 'layout');

  return NextResponse.json({ active });
}
