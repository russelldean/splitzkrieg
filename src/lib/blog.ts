import {
  getPublishedBlogPosts,
  getBlogPostBySlug,
} from '@/lib/admin/blog-db';

export interface PostMeta {
  title: string;
  date: string;
  slug: string;
  excerpt: string;
  type: 'recap' | 'announcement';
  season?: string;
  seasonSlug?: string;
  week?: number;
  heroImage?: string;
  heroFocalY?: number;
}

/**
 * Get all published blog posts, sorted by date descending (newest first).
 * Now reads from DB instead of filesystem.
 */
export async function getAllPosts(): Promise<PostMeta[]> {
  const posts = await getPublishedBlogPosts();

  return posts.map((post) => ({
    title: post.title,
    date: post.publishedAt
      ? post.publishedAt.split('T')[0]
      : new Date().toISOString().split('T')[0],
    slug: post.slug,
    excerpt: post.excerpt ?? '',
    type: post.type ?? 'announcement',
    ...(post.seasonRomanNumeral
      ? { season: post.seasonRomanNumeral }
      : {}),
    ...(post.seasonSlug ? { seasonSlug: post.seasonSlug } : {}),
    ...(post.week != null ? { week: post.week } : {}),
    ...(post.heroImage ? { heroImage: post.heroImage } : {}),
    ...(post.heroFocalY != null ? { heroFocalY: post.heroFocalY } : {}),
  }));
}

/**
 * Get a single post meta by slug.
 */
export async function getPostBySlug(
  slug: string,
): Promise<PostMeta | undefined> {
  const posts = await getAllPosts();
  return posts.find((p) => p.slug === slug);
}

/**
 * Get raw content for a post (MDX/markdown body).
 */
export async function getPostContent(
  slug: string,
): Promise<string | undefined> {
  const post = await getBlogPostBySlug(slug);
  if (!post) return undefined;
  return post.content;
}

/**
 * Get adjacent posts for prev/next navigation.
 * Posts are ordered newest-first, so "prev" is newer and "next" is older.
 */
export async function getAdjacentPosts(
  slug: string,
): Promise<{ prev: PostMeta | null; next: PostMeta | null }> {
  const posts = await getAllPosts();
  const index = posts.findIndex((p) => p.slug === slug);

  if (index === -1) return { prev: null, next: null };

  return {
    prev: index > 0 ? posts[index - 1] : null,
    next: index < posts.length - 1 ? posts[index + 1] : null,
  };
}

/**
 * Find the blog post for a specific season + week (for cross-linking from league night pages).
 */
export async function getPostForWeek(
  season: string,
  week: number,
): Promise<PostMeta | undefined> {
  const posts = await getAllPosts();
  return posts.find((p) => p.season === season && p.week === week);
}
