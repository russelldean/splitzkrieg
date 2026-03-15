'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showAutoDraft, setShowAutoDraft] = useState(false);
  const [autoDraftSeasonID, setAutoDraftSeasonID] = useState('35');
  const [autoDraftWeek, setAutoDraftWeek] = useState('');
  const [autoDraftLoading, setAutoDraftLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/blog');
      if (!res.ok) throw new Error('Failed to load posts');
      const data = await res.json();
      setPosts(data.posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  async function handleNewPost() {
    setCreating(true);
    try {
      const res = await fetch('/api/admin/blog', {
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
      router.push(`/admin/blog/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
      setCreating(false);
    }
  }

  async function handleAutoDraft() {
    if (!autoDraftWeek) return;
    setAutoDraftLoading(true);
    setError(null);
    try {
      // Generate draft content
      const draftRes = await fetch('/api/admin/blog/auto-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonID: parseInt(autoDraftSeasonID, 10),
          week: parseInt(autoDraftWeek, 10),
        }),
      });
      if (!draftRes.ok) {
        const data = await draftRes.json();
        throw new Error(data.error || 'Failed to generate draft');
      }
      const draft = await draftRes.json();

      // Create the post
      const createRes = await fetch('/api/admin/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          excerpt: `Season ${draft.seasonRomanNumeral} Week ${draft.week} recap`,
        }),
      });
      if (!createRes.ok) throw new Error('Failed to create post');
      const { id } = await createRes.json();
      router.push(`/admin/blog/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to auto-draft');
      setAutoDraftLoading(false);
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
            onClick={() => setShowAutoDraft(!showAutoDraft)}
            className="px-4 py-2 rounded-lg font-body text-sm bg-navy/10 text-navy hover:bg-navy/20 transition-colors"
          >
            Auto-Draft from Scores
          </button>
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
      {showAutoDraft && (
        <div className="mb-6 p-4 rounded-lg border border-navy/10 bg-white shadow-sm">
          <h3 className="font-heading text-lg text-navy mb-3">
            Auto-Draft from Confirmed Scores
          </h3>
          <div className="flex gap-4 items-end">
            <div>
              <label className="block font-body text-xs text-navy/60 mb-1">
                Season ID
              </label>
              <input
                type="number"
                value={autoDraftSeasonID}
                onChange={(e) => setAutoDraftSeasonID(e.target.value)}
                className="px-3 py-2 rounded-md border border-navy/20 font-body text-sm w-24"
              />
            </div>
            <div>
              <label className="block font-body text-xs text-navy/60 mb-1">
                Week
              </label>
              <input
                type="number"
                value={autoDraftWeek}
                onChange={(e) => setAutoDraftWeek(e.target.value)}
                className="px-3 py-2 rounded-md border border-navy/20 font-body text-sm w-24"
              />
            </div>
            <button
              onClick={handleAutoDraft}
              disabled={autoDraftLoading || !autoDraftWeek}
              className="px-4 py-2 rounded-lg font-body text-sm bg-navy text-cream hover:bg-navy/90 transition-colors disabled:opacity-50"
            >
              {autoDraftLoading ? 'Generating...' : 'Generate Draft'}
            </button>
            <button
              onClick={() => setShowAutoDraft(false)}
              className="px-4 py-2 rounded-lg font-body text-sm text-navy/50 hover:text-navy transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
              onClick={() => router.push(`/admin/blog/${post.id}`)}
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
