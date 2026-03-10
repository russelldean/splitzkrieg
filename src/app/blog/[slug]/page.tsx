import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getAllPosts, getPostBySlug, getAdjacentPosts, getPostContent } from '@/lib/blog';
import { BlogPostLayout } from '@/components/blog/BlogPostLayout';
import { mdxComponents } from '@/lib/mdx-components';

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

  const content = getPostContent(slug);
  if (!content) notFound();

  const { prev, next } = getAdjacentPosts(slug);

  return (
    <BlogPostLayout meta={meta} prev={prev} next={next}>
      <MDXRemote source={content} components={mdxComponents} />
    </BlogPostLayout>
  );
}
