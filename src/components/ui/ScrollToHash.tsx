'use client';

import { useEffect } from 'react';
import { targetIdFromHash } from '@/lib/hash-target';

/** How long to keep correcting the scroll position after arrival. */
const SETTLE_MS = 2000;

/**
 * Keeps a fragment link pointed at its target while the page finishes rendering.
 *
 * The App Router scrolls to a hash target once, at navigation commit. On a long
 * page whose content arrives after that commit, the scroll is correct for the
 * page as it exists for that instant and wrong a moment later. Measured on the
 * live week page: the router scrolled to 65px, which is exactly where #results
 * sat (145px, less its 80px scroll-margin) before the hero image, the writeup
 * and the awards block rendered. Those pushed the target to 1299px and nothing
 * scrolled again, so the reader landed near the top of the page.
 *
 * This re-applies the scroll whenever the document changes height, for a short
 * window after arrival. It gives up the moment the reader scrolls themselves,
 * because fighting someone for control of the page is worse than landing in the
 * wrong place.
 *
 * Known limit: a reader who scrolls in the few hundred milliseconds before this
 * mounts is not detected, since there is no listener yet, and will be moved to
 * the anchor once. That was judged acceptable because the anchor is the place
 * they asked to go by clicking the link. Verified on the live week page: after
 * mount, a wheel event hands control back and it stays handed back.
 */
export function ScrollToHash() {
  useEffect(() => {
    const id = targetIdFromHash(window.location.hash);
    if (!id) return;

    let done = false;
    let observer: ResizeObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const align = () => {
      // Re-read every time: the element can be replaced as content streams in.
      document.getElementById(id)?.scrollIntoView();
    };

    const stop = () => {
      if (done) return;
      done = true;
      observer?.disconnect();
      if (timer) clearTimeout(timer);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('keydown', stop);
    };

    // Any deliberate input hands control back immediately.
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('keydown', stop);

    align();

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        if (!done) align();
      });
      observer.observe(document.documentElement);
    }

    timer = setTimeout(stop, SETTLE_MS);

    return stop;
  }, []);

  return null;
}
