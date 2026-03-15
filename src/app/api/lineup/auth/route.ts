import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/admin/auth';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(
      new URL('/lineup/login?expired=1', request.url),
    );
  }

  // Verify JWT
  const payload = await verifyToken(token);
  if (!payload || payload.role !== 'captain') {
    return NextResponse.redirect(
      new URL('/lineup/login?expired=1', request.url),
    );
  }

  // Check captainSessions table for revocation
  try {
    const db = await getDb();
    const result = await db
      .request()
      .input('token', token)
      .query<{ revoked: boolean }>(
        `SELECT revoked FROM captainSessions WHERE token = @token`,
      );

    if (result.recordset.length > 0 && result.recordset[0].revoked) {
      return NextResponse.redirect(
        new URL('/lineup/login?expired=1', request.url),
      );
    }
  } catch {
    // captainSessions table might not exist yet, allow through
  }

  // Set lineup-token httpOnly cookie and redirect to /lineup
  const response = NextResponse.redirect(new URL('/lineup', request.url));
  response.cookies.set('lineup-token', token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 90 * 24 * 60 * 60, // 90 days
  });

  return response;
}
