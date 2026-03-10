import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllPosts, getPostBySlug, getAdjacentPosts } from '@/lib/blog';
import { BlogPostLayout } from '@/components/blog/BlogPostLayout';

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
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
  const meta = getPostBySlug(slug);
  if (!meta) notFound();

  const { prev, next } = getAdjacentPosts(slug);

  // Dynamic import of the MDX file — the static prefix is critical for webpack resolution
  const Post = (await import(`@content/blog/${slug}.mdx`)).default;

  return (
    <BlogPostLayout meta={meta} prev={prev} next={next}>
      <Post />
    </BlogPostLayout>
  );
}
