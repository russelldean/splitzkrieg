/**
 * Next.js 16 proxy (replaces middleware.ts).
 * Performs lightweight cookie-existence checks for protected routes.
 * Full JWT verification happens in layout.tsx and API route handlers.
 */

import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin pages (except login) - check for admin-token cookie
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get('admin-token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // Lineup pages (except login) - check for lineup-token cookie
  if (pathname.startsWith('/lineup') && !pathname.startsWith('/lineup/login')) {
    const token = request.cookies.get('lineup-token')?.value;
    if (!token) {
      return NextResponse.redirect(
        new URL('/lineup/login?expired=1', request.url),
      );
    }
  }

  // Admin API routes - check for admin-token cookie
  if (pathname.startsWith('/api/admin')) {
    const token = request.cookies.get('admin-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/lineup/:path*', '/api/admin/:path*'],
};
