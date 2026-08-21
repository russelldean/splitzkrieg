import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrWriter } from '@/lib/admin/auth';
import { checkBody, findMdxIssues } from '@/lib/admin/mdx-health';

export const dynamic = 'force-dynamic';

/**
 * MDX health, for the editor's live check and for the admin surfaces that
 * report on every stored body.
 *
 *   POST  { content }  -> validation for that draft body, as you type
 *   GET                -> every stored body that would not render cleanly
 *
 * Both go through lib/admin/mdx-health, which calls the SAME compileMDX the
 * week page and /blog/[slug] use, through the SAME normalizeInlineTags
 * pre-pass. Validating with a different parser than the renderer is how you get
 * false confidence, and re-implementing the check in the browser would drag the
 * MDX compiler into the client bundle.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminOrWriter(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  let content = '';
  try {
    ({ content = '' } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  return NextResponse.json(await checkBody(content));
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrWriter(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const issues = await findMdxIssues();
    return NextResponse.json({ issues });
  } catch (err) {
    console.error('MDX health check failed:', err);
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}
