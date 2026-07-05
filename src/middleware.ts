import { NextResponse, type NextRequest } from 'next/server';
import {
  shouldServeMaintenance,
  hasValidBypass,
  MAINTENANCE_HTML,
  BYPASS_QUERY_KEY,
  BYPASS_COOKIE,
} from '@/lib/maintenance';

export function middleware(req: NextRequest) {
  if (!shouldServeMaintenance(req.nextUrl.pathname, process.env.MAINTENANCE_MODE)) {
    return NextResponse.next();
  }

  // Trusted bypass: let us and the 404 checker through the wall.
  const secret = process.env.MAINTENANCE_BYPASS;
  const queryToken = req.nextUrl.searchParams.get(BYPASS_QUERY_KEY);
  const cookieToken = req.cookies.get(BYPASS_COOKIE)?.value;
  if (hasValidBypass(queryToken, cookieToken, secret)) {
    const res = NextResponse.next();
    // If unlocked via the query token, persist a cookie so subsequent browser
    // navigation stays unlocked without repeating the token.
    if (queryToken && queryToken === secret) {
      res.cookies.set(BYPASS_COOKIE, secret, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
    }
    return res;
  }

  return new NextResponse(MAINTENANCE_HTML, {
    status: 503,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'retry-after': '86400',
      'cache-control': 'no-store',
    },
  });
}

// Run on everything except Next internals and image optimizer; the predicate
// makes the final allow/deny decision (so /api and /evillair pass through).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
