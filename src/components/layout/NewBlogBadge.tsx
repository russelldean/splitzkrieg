'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

const STORAGE_KEY = 'splitz-blog-seen';

/**
 * Client wrapper for the "New" blog badge.
 * badgeId is the slug of the promoted post.
 * Badge hides once the user visits that specific post.
 */
export function NewBlogBadge({ badgeId }: { badgeId: string }) {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen !== badgeId) {
      setVisible(true);
    }
  }, [badgeId]);

  // Mark as seen when visiting /blog or any blog post
  useEffect(() => {
    if (pathname?.startsWith('/blog')) {
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
