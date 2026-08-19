/**
 * Page-level admin auth. Split from auth.ts on purpose.
 *
 * This module imports next/headers, which makes it Node-only and illegal to
 * import from middleware. auth.ts holds signToken/verifyToken, which are
 * exactly what a future middleware auth check would reach for, so keeping the
 * cookies() call out of that file means importing a token helper can never drag
 * a Node-only dependency into the Edge runtime. The separation is the
 * enforcement; do not move this function back.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from './auth';
import type { TokenPayload } from './types';

/**
 * Require an authenticated admin or writer for a PAGE (not an API route).
 *
 * The guards in auth.ts take a NextRequest; a server component has to read
 * cookies() instead. Shared so a page outside the (dashboard) route group can
 * be gated without inheriting that group's AdminShell chrome.
 *
 * NEVER call this from an API route. It reports failure by throwing
 * NEXT_REDIRECT, and the standard `catch { return 401 }` wrapper every API
 * route uses would silently swallow that, leaving a guard that looks like it
 * works while actually doing something else entirely. API routes use
 * requireAdmin or requireAdminOrWriter from auth.ts.
 */
export async function requireAdminOrWriterPage(): Promise<TokenPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin-token')?.value;
  if (!token) redirect('/evillair/login');

  const payload = await verifyToken(token);
  if (!payload || (payload.role !== 'admin' && payload.role !== 'writer')) {
    redirect('/evillair/login');
  }

  return payload;
}
