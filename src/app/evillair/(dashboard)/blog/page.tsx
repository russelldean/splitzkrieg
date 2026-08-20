'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { BlogPost } from '@/lib/admin/types';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Draft';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdminBlogPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/evillair/blog');
      if (!res.ok) throw new Error('Failed to load posts');
      const data = await res.json();
      setPosts(data.posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch whenever this page is navigated to (pathname triggers on SPA navigation back)
  useEffect(() => {
    loadPosts();
  }, [loadPosts, pathname]);

  async function handleNewPost() {
    setCreating(true);
    try {
      const res = await fetch('/api/evillair/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled Post',
          slug: `untitled-${Date.now()}`,
          content: '',
          type: 'announcement',
        }),
      });
      if (!res.ok) throw new Error('Failed to create post');
      const { id } = await res.json();
      router.push(`/evillair/blog/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
      setCreating(false);
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="font-body text-navy/50">Loading blog posts...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl text-navy">Blog Posts</h1>
        <div className="flex gap-3">
          <button
            onClick={handleNewPost}
            disabled={creating}
            className="px-4 py-2 rounded-lg font-body text-sm bg-red text-white hover:bg-red/90 transition-colors disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'New Post'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red/10 text-red font-body text-sm">
          {error}
        </div>
      )}

      {/* Auto-Draft Modal */}

      {/* Posts List */}
      {posts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-navy/10">
          <p className="font-body text-navy/50 mb-4">No blog posts yet.</p>
          <button
            onClick={handleNewPost}
            disabled={creating}
            className="px-4 py-2 rounded-lg font-body text-sm bg-red text-white hover:bg-red/90 transition-colors"
          >
            Create your first post
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => router.push(`/evillair/blog/${post.id}`)}
              className="w-full text-left p-4 rounded-lg bg-white border border-navy/10 hover:border-navy/20 hover:shadow-sm transition-all flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-heading text-base text-navy truncate">
                    {post.title}
                  </h3>
                  <span
                    className={`shrink-0 inline-block px-2 py-0.5 text-xs font-body font-medium uppercase tracking-wide rounded ${
                      post.type === 'recap'
                        ? 'bg-red/10 text-red'
                        : 'bg-navy/10 text-navy/60'
                    }`}
                  >
                    {post.type}
                  </span>
                </div>
                <p className="font-body text-xs text-navy/50">
                  {post.excerpt || 'No excerpt'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-body rounded ${
                    post.publishedAt
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {post.publishedAt ? 'Published' : 'Draft'}
                </span>
                <p className="font-body text-xs text-navy/40 mt-1">
                  {formatDate(post.publishedAt || post.createdAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
