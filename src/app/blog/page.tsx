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
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 min-h-[calc(100vh-4rem)]">
      {/* Hero area — fun intro while posts are few */}
      <div className="text-center mb-10">
        <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-2">
          The Weekly Email
        </h1>
        <p className="font-body text-navy/50 text-sm max-w-md mx-auto">
          Recaps from the league nights, not strictly emailed anymore.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-navy/10 border-l-4 border-l-navy/30 px-8 py-12 shadow-sm text-center">
          <p className="font-body text-lg text-navy/70 leading-relaxed">
            No posts yet. Check back after the next league night.
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
