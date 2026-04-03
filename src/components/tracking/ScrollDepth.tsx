'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';

const THRESHOLDS = [25, 50, 75, 100];

export function ScrollDepth() {
  const posthog = usePostHog();
  const pathname = usePathname();
  const firedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    firedRef.current = new Set();
  }, [pathname]);

  useEffect(() => {
    function handleScroll() {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      const pct = Math.round((window.scrollY / scrollHeight) * 100);

      for (const t of THRESHOLDS) {
        if (pct >= t && !firedRef.current.has(t)) {
          firedRef.current.add(t);
          posthog.capture('scroll_depth', { depth: t, page: pathname });
        }
      }
    }

    let ticking = false;
    function throttled() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
      }
    }

    window.addEventListener('scroll', throttled, { passive: true });
    return () => window.removeEventListener('scroll', throttled);
  }, [pathname, posthog]);

  return null;
}
