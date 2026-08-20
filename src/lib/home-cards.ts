import type { PostMeta } from './blog';
import { postHref } from './week-writeup';

/**
 * Fallback picture for a post with no cardImage and no heroImage.
 *
 * A real house photo rather than a flat colour block: an empty panel reads as a
 * broken image, and the panel carries the card's only link, so it must always
 * render. Chosen because it is 1200x800 (crops cleanly to both the desktop panel
 * and the h-32 mobile strip), contains no text and no identifiable faces, and is
 * not either homepage hero, so it can never sit directly beneath a copy of itself.
 */
export const DEFAULT_POST_IMAGE = '/bowling-balls-return.jpg';

/** The picture for a post's card panel. Never empty. */
export function postImage(post: PostMeta): string {
  return post.cardImage || post.heroImage || DEFAULT_POST_IMAGE;
}

/**
 * Which post the homepage card should advertise.
 *
 * The hero bar always points at the week page, so the card is only worth giving
 * to a promoted post when that post is somewhere ELSE. When the promoted post is
 * this week's recap, the two would be the same link, so the card falls back to
 * recap behaviour and the anchor on the hero keeps them distinct instead.
 *
 * The fallback is the latest RECAP, not the latest post of any type. Using
 * `posts[0]` let an unpromoted announcement evict the recap card entirely.
 */
export function selectCardPost(opts: {
  posts: PostMeta[];
  promoted: PostMeta | null;
  weekHref: string | null;
}): PostMeta | null {
  const { posts, promoted, weekHref } = opts;
  if (promoted && (weekHref === null || postHref(promoted) !== weekHref)) {
    return promoted;
  }
  return posts.find((p) => p.type === 'recap' && p.week != null) ?? null;
}

/**
 * Badge and call-to-action text for the card's image panel.
 *
 * "New Post" matches the badge PromotedBlogCard already uses, so the two cards
 * agree. Guarded on `week` as well as `type` because a recap without a week
 * would otherwise render the string "Week undefined Recap".
 */
export function cardLabels(post: PostMeta): { badge: string; cta: string } {
  if (post.type === 'recap' && post.week != null) {
    return { badge: `Week ${post.week} Recap`, cta: 'Read the full recap' };
  }
  return { badge: 'New Post', cta: 'Read the post' };
}
