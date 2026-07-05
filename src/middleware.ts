import { NextResponse, type NextRequest } from 'next/server';
import { shouldServeMaintenance, MAINTENANCE_HTML } from '@/lib/maintenance';

export function middleware(req: NextRequest) {
  if (shouldServeMaintenance(req.nextUrl.pathname, process.env.MAINTENANCE_MODE)) {
    return new NextResponse(MAINTENANCE_HTML, {
      status: 503,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'retry-after': '86400',
        'cache-control': 'no-store',
      },
    });
  }
  return NextResponse.next();
}

// Run on everything except Next internals and image optimizer; the predicate
// makes the final allow/deny decision (so /api and /evillair pass through).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
