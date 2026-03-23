'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { BlogPost } from '@/lib/admin/types';

// Dynamically import MD editor to avoid SSR issues
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), {
  ssr: false,
  loading: () => (
    <div className="h-96 bg-navy/5 rounded-lg flex items-center justify-center">
      <p className="font-body text-navy/50">Loading editor...</p>
    </div>
  ),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function BlogEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showDelete, setShowDelete] = useState(false);
  const [postId, setPostId] = useState<number | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);

  // Fields
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [type, setType] = useState<'recap' | 'announcement'>('announcement');
  const [seasonRomanNumeral, setSeasonRomanNumeral] = useState('');
  const [seasonSlug, setSeasonSlug] = useState('');
  const [week, setWeek] = useState('');
  const [heroImage, setHeroImage] = useState('');
  const [heroFocalY, setHeroFocalY] = useState('');

  // Resolve params
  useEffect(() => {
    params.then(({ id }) => setPostId(parseInt(id, 10)));
  }, [params]);

  const loadPost = useCallback(async () => {
    if (postId == null) return;
    try {
      const res = await fetch(`/api/admin/blog/${postId}`);
      if (!res.ok) throw new Error('Failed to load post');
      const data = await res.json();
      const p: BlogPost = data.post;
      setPost(p);
      setTitle(p.title);
      setSlug(p.slug);
      setContent(p.content);
      setExcerpt(p.excerpt ?? '');
      setType(p.type ?? 'announcement');
      setSeasonRomanNumeral(p.seasonRomanNumeral ?? '');
      setSeasonSlug(p.seasonSlug ?? '');
      setWeek(p.week != null ? String(p.week) : '');
      setHeroImage(p.heroImage ?? '');
      setHeroFocalY(p.heroFocalY != null ? String(p.heroFocalY) : '');
    } catch {
      setSaveStatus('error');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  // Auto-slug from title (unless manually edited)
  useEffect(() => {
    if (!slugEdited && title) {
      setSlug(slugify(title));
    }
  }, [title, slugEdited]);

  // Auto-save after 30s of idle — only after post has loaded
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loading && post) loadedRef.current = true;
  }, [loading, post]);

  useEffect(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (postId && !saving && loadedRef.current) {
        handleSaveRef.current(false);
      }
    }, 30000);
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [title, content, excerpt, type, postId, saving]);

  // Ctrl+S handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (postId && !saving && loadedRef.current) handleSaveRef.current(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [postId, saving]);

  async function handleSave(publish: boolean | null) {
    if (!postId) return;
    setSaving(true);
    setSaveStatus('saving');

    const body: Record<string, unknown> = {
      title,
      slug,
      content,
      excerpt: excerpt || null,
      type,
      seasonRomanNumeral: seasonRomanNumeral || null,
      seasonSlug: seasonSlug || null,
      week: week ? parseInt(week, 10) : null,
      heroImage: heroImage || null,
      heroFocalY: heroFocalY ? parseFloat(heroFocalY) : null,
    };

    // Handle publish state
    if (publish === true) {
      body.publishedAt = new Date().toISOString();
    } else if (publish === false) {
      body.publishedAt = null;
    }
    // publish === null means don't change publish state (just save)

    try {
      const res = await fetch(`/api/admin/blog/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaveStatus('saved');

      // Update local post state for publish/unpublish
      if (publish !== null) {
        setPost((prev) =>
          prev
            ? {
                ...prev,
                publishedAt: publish ? body.publishedAt as string : null,
              }
            : prev,
        );
      }

      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!postId) return;
    try {
      const res = await fetch(`/api/admin/blog/${postId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      router.push('/admin/blog');
    } catch {
      setSaveStatus('error');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="font-body text-navy/50">Loading editor...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="font-body text-red">Post not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push('/admin/blog')}
          className="font-body text-sm text-navy/50 hover:text-navy transition-colors"
        >
          &larr; All Posts
        </button>
        <div className="flex items-center gap-3">
          {/* Save status indicator */}
          <span
            className={`font-body text-xs ${
              saveStatus === 'saving'
                ? 'text-amber-600'
                : saveStatus === 'saved'
                  ? 'text-green-600'
                  : saveStatus === 'error'
                    ? 'text-red'
                    : 'text-navy/30'
            }`}
          >
            {saveStatus === 'saving'
              ? 'Saving...'
              : saveStatus === 'saved'
                ? 'Saved'
                : saveStatus === 'error'
                  ? 'Error saving'
                  : ''}
          </span>

          <button
            onClick={() => handleSave(null)}
            disabled={saving}
            className="px-4 py-2 rounded-lg font-body text-sm bg-navy/10 text-navy hover:bg-navy/20 transition-colors disabled:opacity-50"
          >
            Save Draft
          </button>

          {post.publishedAt ? (
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-4 py-2 rounded-lg font-body text-sm bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors disabled:opacity-50"
            >
              Unpublish
            </button>
          ) : (
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="px-4 py-2 rounded-lg font-body text-sm bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Publish
            </button>
          )}

          <button
            onClick={() => setShowDelete(true)}
            className="px-4 py-2 rounded-lg font-body text-sm text-red/60 hover:text-red hover:bg-red/10 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Metadata fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block font-body text-xs text-navy/60 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-navy/20 font-body text-sm focus:outline-none focus:border-navy/40"
            placeholder="Post title"
          />
        </div>
        <div>
          <label className="block font-body text-xs text-navy/60 mb-1">
            Slug
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugEdited(true);
            }}
            className="w-full px-3 py-2 rounded-md border border-navy/20 font-body text-sm font-mono focus:outline-none focus:border-navy/40"
            placeholder="post-slug"
          />
        </div>
        <div>
          <label className="block font-body text-xs text-navy/60 mb-1">
            Type
          </label>
          <select
            value={type}
            onChange={(e) =>
              setType(e.target.value as 'recap' | 'announcement')
            }
            className="w-full px-3 py-2 rounded-md border border-navy/20 font-body text-sm focus:outline-none focus:border-navy/40"
          >
            <option value="announcement">Announcement</option>
            <option value="recap">Recap</option>
          </select>
        </div>
        <div>
          <label className="block font-body text-xs text-navy/60 mb-1">
            Excerpt
          </label>
          <input
            type="text"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-navy/20 font-body text-sm focus:outline-none focus:border-navy/40"
            placeholder="Short description"
          />
        </div>
      </div>

      {/* Optional fields */}
      <details className="mb-6">
        <summary className="font-body text-sm text-navy/50 cursor-pointer hover:text-navy transition-colors">
          Optional fields (season, hero image)
        </summary>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
          <div>
            <label className="block font-body text-xs text-navy/60 mb-1">
              Season
            </label>
            <input
              type="text"
              value={seasonRomanNumeral}
              onChange={(e) => setSeasonRomanNumeral(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-navy/20 font-body text-sm focus:outline-none focus:border-navy/40"
              placeholder="XXXV"
            />
          </div>
          <div>
            <label className="block font-body text-xs text-navy/60 mb-1">
              Season Slug
            </label>
            <input
              type="text"
              value={seasonSlug}
              onChange={(e) => setSeasonSlug(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-navy/20 font-body text-sm focus:outline-none focus:border-navy/40"
              placeholder="spring-2026"
            />
          </div>
          <div>
            <label className="block font-body text-xs text-navy/60 mb-1">
              Week
            </label>
            <input
              type="number"
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-navy/20 font-body text-sm focus:outline-none focus:border-navy/40"
              placeholder="4"
            />
          </div>
          <div>
            <label className="block font-body text-xs text-navy/60 mb-1">
              Hero Image
            </label>
            <input
              type="text"
              value={heroImage}
              onChange={(e) => setHeroImage(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-navy/20 font-body text-sm focus:outline-none focus:border-navy/40"
              placeholder="/image.jpg"
            />
          </div>
          <div>
            <label className="block font-body text-xs text-navy/60 mb-1">
              Hero Focal Y
            </label>
            <input
              type="number"
              step="0.01"
              value={heroFocalY}
              onChange={(e) => setHeroFocalY(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-navy/20 font-body text-sm focus:outline-none focus:border-navy/40"
              placeholder="0.45"
            />
          </div>
        </div>
      </details>

      {/* Markdown Editor */}
      <div data-color-mode="light" className="mb-8">
        <MDEditor
          value={content}
          onChange={(val) => setContent(val ?? '')}
          preview="live"
          height={500}
          visibleDragbar={false}
        />
      </div>

      {/* Delete confirmation modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="font-heading text-lg text-navy mb-2">
              Delete Post?
            </h3>
            <p className="font-body text-sm text-navy/60 mb-4">
              This will permanently delete &ldquo;{title}&rdquo;. This action
              cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDelete(false)}
                className="px-4 py-2 rounded-lg font-body text-sm text-navy/50 hover:text-navy transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg font-body text-sm bg-red text-white hover:bg-red/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
