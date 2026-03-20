import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const pool = await getDb();
    const result = await pool.request().query(`
      SELECT name, wonAt, attemptCount
      FROM gameWinners
      ORDER BY wonAt DESC
    `);
    return NextResponse.json(result.recordset);
  } catch {
    return NextResponse.json([], { status: 200 }); // Graceful fallback
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, attemptCount } = body;

  // Validate name
  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 50) {
    return NextResponse.json({ error: 'Name required, max 50 characters' }, { status: 400 });
  }
  // Validate attemptCount
  if (attemptCount === undefined || attemptCount === null || typeof attemptCount !== 'number' || attemptCount < 1 || attemptCount > 100) {
    return NextResponse.json({ error: 'Invalid attempt count' }, { status: 400 });
  }

  try {
    const pool = await getDb();
    await pool.request()
      .input('name', name.trim().slice(0, 50))
      .input('attemptCount', attemptCount)
      .query(`
        INSERT INTO gameWinners (name, attemptCount, wonAt)
        VALUES (@name, @attemptCount, GETDATE())
      `);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
