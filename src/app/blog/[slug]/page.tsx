import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getAllPosts, getPostBySlug, getAdjacentPosts, getPostContent } from '@/lib/blog';
import { getBlogPostBySlug } from '@/lib/admin/blog-db';
import { verifyToken } from '@/lib/admin/auth';
import { BlogPostLayout } from '@/components/blog/BlogPostLayout';
import { mdxComponents } from '@/lib/mdx-components';
import type { PostMeta } from '@/lib/blog';

export const dynamicParams = true;
export const revalidate = 3600;

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin-token')?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload?.role === 'admin';
}

/** Try to load a post for preview (unpublished), returns null if not admin or not found */
async function getPreviewPost(slug: string): Promise<{ meta: PostMeta; content: string } | null> {
  if (!(await isAdmin())) return null;
  const post = await getBlogPostBySlug(slug);
  if (!post || !post.content) return null;
  return {
    meta: {
      title: post.title,
      date: post.publishedAt?.split('T')[0] ?? new Date().toISOString().split('T')[0],
      slug: post.slug,
      excerpt: post.excerpt ?? '',
      type: post.type ?? 'announcement',
      ...(post.seasonRomanNumeral ? { season: post.seasonRomanNumeral } : {}),
      ...(post.seasonSlug ? { seasonSlug: post.seasonSlug } : {}),
      ...(post.week != null ? { week: post.week } : {}),
      ...(post.heroImage ? { heroImage: post.heroImage } : {}),
      ...(post.heroFocalY != null ? { heroFocalY: post.heroFocalY } : {}),
      ...(post.cardImage ? { cardImage: post.cardImage } : {}),
    },
    content: post.content,
  };
}

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: 'Post Not Found | Splitzkrieg' };

  return {
    title: `${post.title} | Splitzkrieg Blog`,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Try published post first
  let meta = await getPostBySlug(slug);
  let content = meta ? await getPostContent(slug) : undefined;

  // If not published, try preview (admin only)
  if (!meta || !content) {
    const preview = await getPreviewPost(slug);
    if (!preview) notFound();
    meta = preview.meta;
    content = preview.content;
  }

  const { prev, next } = await getAdjacentPosts(slug);

  return (
    <BlogPostLayout meta={meta} prev={prev} next={next}>
      {!meta.title ? null : (
        <MDXRemote source={content} components={mdxComponents} />
      )}
    </BlogPostLayout>
  );
}
