import { NextRequest, NextResponse } from 'next/server';
import { compileMDX } from 'next-mdx-remote/rsc';
import { requireAdminOrWriter } from '@/lib/admin/auth';
import { mdxComponents } from '@/lib/mdx-components';
import { normalizeInlineTags } from '@/lib/mdx-source';
import { unknownTags, readableMdxError, type MdxValidation } from '@/lib/mdx-validate';

export const dynamic = 'force-dynamic';

/**
 * Checks a draft body the way the render path will, so the editor can show a
 * readable error instead of the author discovering it as a Next digest page
 * twenty minutes later.
 *
 * Runs server-side deliberately: it calls the SAME `compileMDX` the week page
 * and /blog/[slug] use, through the SAME `normalizeInlineTags` pre-pass.
 * Validating with a different parser than the renderer is how you get false
 * confidence, and re-implementing the check in the browser would also drag the
 * MDX compiler into the client bundle.
 *
 * The two failure classes surface differently (see lib/mdx-validate.ts):
 * a syntax error throws out of compileMDX, while an unknown component only
 * throws at render, so it has to be found by scanning.
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

  const normalized = normalizeInlineTags(content);
  const missing = unknownTags(normalized, Object.keys(mdxComponents));

  let error: string | null = null;
  try {
    await compileMDX({
      source: normalized,
      // Unknown names are stubbed so the compile step reports only real syntax
      // problems. They are reported separately via `unknownTags`.
      components: {
        ...mdxComponents,
        ...Object.fromEntries(missing.map((t) => [t, () => null])),
      },
    });
  } catch (err) {
    error = readableMdxError(err);
  }

  const result: MdxValidation = { ok: error === null, error, unknownTags: missing };
  return NextResponse.json(result);
}
