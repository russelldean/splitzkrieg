'use client';

import { useEffect } from 'react';
import { targetIdFromHash } from '@/lib/hash-target';

/** How long to keep correcting the scroll position after arrival. */
const SETTLE_MS = 2000;

interface Props {
  /**
   * The one id this instance is responsible for.
   *
   * Deliberately not "whatever is in the URL". A page can have more than one
   * thing that reacts to a fragment: the week page also hands `#match-N` links
   * to WeekMatchSummary, which expands the card and scrolls it into view
   * itself. Two uncoordinated mechanisms moving the same element produce jank,
   * so each names what it owns.
   */
  id: string;
}

/**
 * Keeps a fragment link pointed at its target while the page finishes rendering.
 *
 * The App Router scrolls to a hash target once, at navigation commit. On a long
 * page whose content arrives after that commit, the scroll is correct for the
 * page as it exists for that instant and wrong a moment later: the content
 * above the anchor renders, pushes the anchor down, and nothing scrolls again.
 * The reader ends up near the top of the page instead of at the thing they
 * clicked through for. See commit b0ea421 for the measured before and after.
 *
 * This re-applies the scroll while the document is still changing height, then
 * stops. It hands control back the moment the reader does anything deliberate,
 * because fighting someone for the scroll position is worse than landing in the
 * wrong place.
 *
 * Two known limits, both accepted:
 * - A reader who acts in the few hundred milliseconds before this mounts is not
 *   detected, and will be moved to the anchor once. The anchor is where they
 *   asked to go, so that is a tolerable miss.
 * - SETTLE_MS is tuned for a prebuilt page. A cold, never-rendered historical
 *   week could take longer to settle than the window allows, in which case this
 *   simply stops early and behaves as it did before.
 */
export function ScrollToHash({ id }: Props) {
  useEffect(() => {
    if (targetIdFromHash(window.location.hash) !== id) return;

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
      window.removeEventListener('pointerdown', stop);
      window.removeEventListener('keydown', stop);
    };

    // Any deliberate input hands control back. pointerdown rather than click:
    // it fires before a <details> toggle or a match card expands, so the height
    // change that follows is understood as the reader's doing and not mistaken
    // for content still arriving.
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('pointerdown', stop, { passive: true });
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
  }, [id]);

  return null;
}
