'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

const STORAGE_KEY = 'splitz-blog-seen';

/**
 * The "New" blog badge.
 *
 * Fetches its own state instead of taking it as a prop from a server
 * component. Resolving it during prerender meant the header changed, so
 * promoting a post had to purge every route under the root layout, which
 * with BUILD_ALL=1 threw away all ~1179 prebuilt pages. It also froze the
 * 14 day expiry in home.ts at build time, since that Date.now() comparison
 * ran during prerender rather than when someone loaded the page.
 *
 * Nothing changes visually: the badge already started hidden and only
 * appeared once an effect ran.
 *
 * The request is shared across instances (the desktop header and the mobile
 * nav both render one) so a page load makes at most one call.
 */
let badgeRequest: Promise<string | null> | null = null;

function loadBadgeId(): Promise<string | null> {
  badgeRequest ??= fetch('/api/blog-badge')
    .then((r) => (r.ok ? r.json() : { badgeId: null }))
    .then((d: { badgeId: string | null }) => d.badgeId ?? null)
    .catch(() => null);
  return badgeRequest;
}

export function NewBlogBadge() {
  const [badgeId, setBadgeId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    loadBadgeId().then((id) => {
      if (!cancelled) setBadgeId(id);
    });
    return () => { cancelled = true; };
  }, []);

  // Badge hides once the user has visited that specific promoted post.
  useEffect(() => {
    if (!badgeId) {
      setVisible(false);
      return;
    }
    setVisible(localStorage.getItem(STORAGE_KEY) !== badgeId);
  }, [badgeId]);

  // Mark as seen when visiting /blog or any blog post
  useEffect(() => {
    if (badgeId && pathname?.startsWith('/blog')) {
      localStorage.setItem(STORAGE_KEY, badgeId);
      setVisible(false);
    }
  }, [pathname, badgeId]);

  if (!visible) return null;

  return (
    <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white rounded-full leading-none">
      New
    </span>
  );
}
