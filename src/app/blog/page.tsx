import type { Metadata } from 'next';
import { getAllPosts } from '@/lib/blog';
import { BlogPostCard } from '@/components/blog/BlogPostCard';

export const metadata: Metadata = {
  title: 'Blog | Splitzkrieg',
  description: 'Weekly recaps, league news, and stories from Splitzkrieg Bowling League.',
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-8">
        Blog
      </h1>

      {posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-navy/10 border-l-4 border-l-navy/30 px-8 py-12 shadow-sm">
          <p className="font-body text-lg text-navy/70 leading-relaxed">
            No posts yet. Check back soon.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <BlogPostCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </main>
  );
}
