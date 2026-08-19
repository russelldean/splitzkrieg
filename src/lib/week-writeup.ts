import type { PostMeta } from './blog';

/**
 * Should the writeup block start expanded?
 *
 * Current season expands, past seasons collapse. This is deliberately seasonal
 * rather than an age in days: the site is statically prebuilt, so any day-count
 * rule would be evaluated at BUILD time and would silently depend on how recently
 * we deployed. A season rule flips once per page, at changeover, which already
 * has a cold rebuild in the ritual.
 */
export function shouldExpandWriteup(
  postSeasonSlug: string | undefined,
  currentSeasonSlug: string | undefined,
): boolean {
  if (!postSeasonSlug) return false;
  // Unknown current season: expand rather than hide Russ's writing by accident.
  if (!currentSeasonSlug) return true;
  return postSeasonSlug === currentSeasonSlug;
}

/**
 * The week page a post belongs to, or null if it is not week-scoped.
 *
 * Used by the redirect in /blog/[slug] to decide WHETHER to redirect at all.
 * Do not swap in postHref there: it never returns null, so every post would
 * redirect, and an announcement would redirect to the URL it is already on.
 * Keyed on seasonSlug + week rather than `type`, because at least one recap
 * (postID 1) carries a custom slug and a title that does not look like a recap.
 */
export function weekPathForPost(post: PostMeta): string | null {
  if (!post.seasonSlug || post.week == null) return null;
  return `/week/${post.seasonSlug}/${post.week}`;
}

/**
 * The canonical link for displaying a post: its week page when it has one,
 * otherwise its own blog URL. Distinct from weekPathForPost, which returns
 * null so the redirect in /blog/[slug] can decide whether to redirect at all.
 */
export function postHref(post: PostMeta): string {
  return weekPathForPost(post) ?? `/blog/${post.slug}`;
}

/** Lowercase alphanumerics only, so punctuation and spacing stop mattering. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The excerpt to show under a collapsed writeup label, or null to show nothing.
 *
 * The collapsed block is meant to advertise itself, but in practice the stored
 * excerpt for a recap restates the title ("Season XXXVI Week 3 recap" under a
 * label reading "Week 3 Recap"), which reads as a duplicated heading. Seven of
 * the eight recaps in the table are exactly that, so suppress an excerpt whose
 * words are already in the title and keep the ones that say something new.
 */
export function excerptWorthShowing(
  excerpt: string | null | undefined,
  title: string,
): string | null {
  if (!excerpt) return null;
  const trimmed = excerpt.trim();
  const normalized = normalize(trimmed);
  if (!normalized) return null;
  return normalize(title).includes(normalized) ? null : trimmed;
}

/**
 * Where the editor's Preview button should land for a given post.
 *
 * Week-scoped posts preview on the week page, because that is what readers get
 * once the post is published. Announcements have no week page, so they keep
 * previewing on their own blog URL.
 *
 * The slug rides along as a query param: the preview route is keyed on season
 * and week, and looking up "the post for this week" would find the PUBLISHED
 * one, which is exactly the thing a draft is replacing.
 */
export function draftDestinationForPost(post: PostMeta): string {
  const weekPath = weekPathForPost(post);
  // No week page: postHref already falls back to the blog URL for exactly
  // this case, so reuse it instead of rebuilding the same string here.
  if (!weekPath) return postHref(post);
  return `/evillair/preview${weekPath}?slug=${encodeURIComponent(post.slug)}`;
}
