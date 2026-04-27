/**
 * GET  /api/evillair/new-blog-badge — Check if badge is active
 * POST /api/evillair/new-blog-badge — Toggle badge on/off
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
  const val = result.recordset[0]?.settingValue ?? '0';
  const active = val !== '0';
  const slug = active ? val.split('|')[0] : null;
  return NextResponse.json({ active, slug });
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { slug } = (await request.json()) as { slug?: string };
  const db = await getDb();
  // Store "slug|timestamp" when promoting, '0' to clear
  const value = slug ? `${slug}|${Date.now()}` : '0';
  await db.request().query(
    `UPDATE leagueSettings SET settingValue = '${value}' WHERE settingKey = 'newBlogPost'`
  );

  // Revalidate all pages that show the header
  revalidatePath('/', 'layout');

  return NextResponse.json({ active: !!slug, slug: slug ?? null });
}
