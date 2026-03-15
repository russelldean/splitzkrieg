import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/admin/auth';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    const isAdmin = password && password === process.env.ADMIN_PASSWORD;
    const isWriter =
      !isAdmin && password && process.env.WRITER_PASSWORD && password === process.env.WRITER_PASSWORD;

    if (!isAdmin && !isWriter) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 },
      );
    }

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
