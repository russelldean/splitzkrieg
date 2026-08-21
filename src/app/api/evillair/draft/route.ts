import { NextRequest, NextResponse } from 'next/server';
import { draftMode } from 'next/headers';
import { requireAdmin } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

/**
 * Draft mode is NOT per-page. Enabling it sets an httpOnly cookie that opts
 * EVERY route on the site out of static rendering for that browser, so the
 * whole site starts rendering live against Azure SQL. On 2026-08-20 that made
 * production feel broken for Russ: the week index took ~50s, while the same
 * URL over curl (no cookie) returned in 0.2s. Measured, same browser:
 *
 *   draft ON   /week RSC:  30KB, still streaming at 12s
 *   draft OFF  /week RSC: 145KB, complete in 75ms
 *
 * Nothing in the UI ever called DELETE, so one click of Preview left the site
 * crippled indefinitely. `sk_draft` mirrors the state in a readable cookie so
 * DraftModeBanner can warn about it client-side. It must NOT be httpOnly, and
 * the banner must stay client-side: calling draftMode() in a layout would make
 * every route dynamic, which is the very problem this is about.
 */

/**
 * GET: Enable draft mode and optionally redirect.
 * ?slug=some-post-slug → enables draft mode, redirects to /blog/some-post-slug
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const slug = request.nextUrl.searchParams.get('slug');
  const draft = await draftMode();
  draft.enable();

  const res = slug
    ? NextResponse.redirect(new URL(`/blog/${slug}`, request.url))
    : NextResponse.json({ ok: true, draftMode: true });
  res.cookies.set('sk_draft', '1', { path: '/', httpOnly: false, sameSite: 'lax' });
  return res;
}

/**
 * DELETE: Disable draft mode.
 */
export async function DELETE(request: NextRequest) {
  const draft = await draftMode();
  draft.disable();
  const res = NextResponse.json({ ok: true, draftMode: false });
  res.cookies.set('sk_draft', '', { path: '/', httpOnly: false, maxAge: 0 });
  return res;
}

/**
 * Exit via a plain link, so getting unstuck never needs devtools or a fetch.
 * Deliberately unauthenticated: turning preview OFF can only make the site
 * faster and more correct, so there is nothing to protect.
 */
export async function POST(request: NextRequest) {
  const draft = await draftMode();
  draft.disable();
  const res = NextResponse.redirect(new URL('/', request.url));
  res.cookies.set('sk_draft', '', { path: '/', httpOnly: false, maxAge: 0 });
  return res;
}
