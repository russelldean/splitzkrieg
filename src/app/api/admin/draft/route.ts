import { NextRequest, NextResponse } from 'next/server';
import { draftMode } from 'next/headers';
import { requireAdmin } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

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

  if (slug) {
    return NextResponse.redirect(new URL(`/blog/${slug}`, request.url));
  }

  return NextResponse.json({ ok: true, draftMode: true });
}

/**
 * DELETE: Disable draft mode.
 */
export async function DELETE(request: NextRequest) {
  const draft = await draftMode();
  draft.disable();
  return NextResponse.json({ ok: true, draftMode: false });
}
