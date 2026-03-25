import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { draftMode } from 'next/headers';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getAllPosts, getPostBySlug, getAdjacentPosts, getPostContent } from '@/lib/blog';
import { getBlogPostBySlug } from '@/lib/admin/blog-db';
import { BlogPostLayout } from '@/components/blog/BlogPostLayout';
import { mdxComponents } from '@/lib/mdx-components';
import { getSiteUpdates } from '@/lib/queries/updates';
import type { PostMeta } from '@/lib/blog';

export const dynamicParams = true;

/** Load an unpublished post from DB for draft preview */
async function getPreviewPost(slug: string): Promise<{ meta: PostMeta; content: string } | null> {
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
      ...(post.cardFocalY != null ? { cardFocalY: post.cardFocalY } : {}),
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
  const { isEnabled: isDraft } = await draftMode();

  // Try published post first
  let meta = await getPostBySlug(slug);
  let content = meta ? await getPostContent(slug) : undefined;

  // If not published and draft mode is on, try preview from DB
  if ((!meta || !content) && isDraft) {
    try {
      const preview = await getPreviewPost(slug);
      if (!preview) notFound();
      meta = preview.meta;
      content = preview.content;
    } catch (err) {
      console.error('Blog preview error:', err);
      notFound();
    }
  }

  if (!meta || !content) notFound();

  const [{ prev, next }, siteUpdates] = await Promise.all([
    getAdjacentPosts(slug),
    getSiteUpdates(),
  ]);

  return (
    <BlogPostLayout meta={meta} prev={prev} next={next} updates={siteUpdates}>
      {!meta.title ? null : (
        <MDXRemote source={content.replace(/<(\/?)bowler>/gi, '<$1Bowler>').replace(/<(\/?)team>/gi, '<$1Team>')} components={mdxComponents} />
      )}
    </BlogPostLayout>
  );
}
