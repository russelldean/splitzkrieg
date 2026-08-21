import { compileMDX } from 'next-mdx-remote/rsc';
import { mdxComponents } from '@/lib/mdx-components';
import { normalizeInlineTags } from '@/lib/mdx-source';
import {
  unknownTags,
  readableMdxError,
  type MdxValidation,
} from '@/lib/mdx-validate';
import { getAllBlogPosts } from './blog-db';

/**
 * Server-side MDX health for stored post bodies.
 *
 * One implementation behind three surfaces (the editor's live check, the blog
 * list badges, the dashboard warning) so they can never disagree about whether
 * a body is fine.
 *
 * Deliberately re-derives health from the bodies rather than reading the
 * [MDX_UNKNOWN_TAG] / [MDX_FAIL] build-log lines. Logs are a record of the last
 * build; the bodies are the truth right now, and a problem saved five minutes
 * ago has not reached a build log yet.
 */

/** Checks one body the way the render path will. */
export async function checkBody(content: string): Promise<MdxValidation> {
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

  return { ok: error === null, error, unknownTags: missing };
}

export interface PostMdxIssue {
  postId: number;
  slug: string;
  title: string;
  isPublished: boolean;
  /** False means the body will not compile and renders as a placeholder note. */
  ok: boolean;
  error: string | null;
  /** Tags that render as a marker chip instead of the content the author meant. */
  unknownTags: string[];
}

/**
 * Every stored body that would not render cleanly. Empty array is the healthy
 * state, so callers can treat length as the badge count.
 */
export async function findMdxIssues(): Promise<PostMdxIssue[]> {
  const posts = await getAllBlogPosts();
  const issues: PostMdxIssue[] = [];

  for (const post of posts) {
    if (!post.content?.trim()) continue;
    const result = await checkBody(post.content);
    if (result.ok && result.unknownTags.length === 0) continue;
    issues.push({
      postId: post.id,
      slug: post.slug,
      title: post.title,
      isPublished: post.publishedAt !== null,
      ...result,
    });
  }

  // A published problem is live on the site; a draft one is not yet.
  return issues.sort(
    (a, b) => Number(b.isPublished) - Number(a.isPublished) || Number(a.ok) - Number(b.ok),
  );
}
