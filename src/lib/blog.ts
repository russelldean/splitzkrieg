import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface PostMeta {
  title: string;
  date: string;
  slug: string;
  excerpt: string;
  type: 'recap' | 'announcement';
  season?: string;
  week?: number;
}

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

/**
 * Get all blog posts, sorted by date descending (newest first).
 */
export function getAllPosts(): PostMeta[] {
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx'));

  const posts = files.map((filename) => {
    const filePath = path.join(BLOG_DIR, filename);
    const raw = fs.readFileSync(filePath, 'utf8');
    const { data } = matter(raw);

    return {
      title: data.title,
      date: data.date,
      slug: data.slug,
      excerpt: data.excerpt,
      type: data.type ?? 'announcement',
      ...(data.season ? { season: data.season } : {}),
      ...(data.week != null ? { week: data.week } : {}),
    } as PostMeta;
  });

  // Reverse chronological (newest first)
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Get a single post by slug.
 */
export function getPostBySlug(slug: string): PostMeta | undefined {
  return getAllPosts().find((p) => p.slug === slug);
}

/**
 * Get adjacent posts for prev/next navigation.
 * Posts are ordered newest-first, so "prev" is newer and "next" is older.
 */
export function getAdjacentPosts(slug: string): { prev: PostMeta | null; next: PostMeta | null } {
  const posts = getAllPosts();
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
export function getPostForWeek(season: string, week: number): PostMeta | undefined {
  return getAllPosts().find((p) => p.season === season && p.week === week);
}
