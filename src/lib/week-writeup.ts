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
 * Keyed on seasonSlug + week rather than `type`, because at least one recap
 * (postID 1) carries a custom slug and a title that does not look like a recap.
 */
export function weekPathForPost(post: PostMeta): string | null {
  if (!post.seasonSlug || post.week == null) return null;
  return `/week/${post.seasonSlug}/${post.week}`;
}
