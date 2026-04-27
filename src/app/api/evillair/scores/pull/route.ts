import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { lpPullScores } from '@/lib/admin/lp-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { cookie, seasonID, week } = body as {
      cookie: string;
      seasonID: number;
      week: number;
    };

    if (!cookie || !seasonID || !week) {
      return NextResponse.json(
        { error: 'Missing required fields: cookie, seasonID, week' },
        { status: 400 },
      );
    }

    const result = await lpPullScores(cookie, seasonID, week);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('session expired') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
