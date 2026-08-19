import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { draftMode } from 'next/headers';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getAllPosts, getPostBySlug, getAdjacentPosts, getPostContent, getDraftPostBySlug } from '@/lib/blog';
import { weekPathForPost } from '@/lib/week-writeup';
import { BlogPostLayout } from '@/components/blog/BlogPostLayout';
import { mdxComponents } from '@/lib/mdx-components';
import { getSiteUpdates } from '@/lib/queries/updates';

export const dynamicParams = true;

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
      const preview = await getDraftPostBySlug(slug);
      if (!preview) notFound();
      meta = preview.meta;
      content = preview.content;
    } catch (err) {
      console.error('Blog preview error:', err);
      notFound();
    }
  }

  if (!meta || !content) notFound();

  // Weekly recaps now live on the week page. Old /blog/<slug> links are in every
  // weekly email ever sent, so they must keep resolving.
  // Draft previews are exempt: Russ needs to proof an unpublished recap in place.
  const weekPath = weekPathForPost(meta);
  if (weekPath && !isDraft) redirect(weekPath);

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
