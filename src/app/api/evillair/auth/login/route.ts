import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/admin/auth';
import {
  checkRateLimit,
  extractIp,
  recordFailedLogin,
  recordSuccessfulLogin,
} from '@/lib/admin/rate-limit';

export async function POST(request: NextRequest) {
  const ip = extractIp(request);

  const gate = checkRateLimit(ip);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(gate.retryAfterSec) },
      },
    );
  }

  try {
    const { password } = await request.json();

    const isAdmin = password && password === process.env.ADMIN_PASSWORD;
    const isWriter =
      !isAdmin && password && process.env.WRITER_PASSWORD && password === process.env.WRITER_PASSWORD;

    if (!isAdmin && !isWriter) {
      await recordFailedLogin(request, ip);
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 },
      );
    }

    recordSuccessfulLogin(ip);

    const role = isAdmin ? 'admin' : 'writer';
    const token = await signToken({ role } as { role: 'admin' | 'writer' });

    const response = NextResponse.json({ success: true, role });
    response.cookies.set('admin-token', token, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
