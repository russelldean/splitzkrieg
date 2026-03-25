'use client';

import { useEffect, useRef } from 'react';
import { usePostHog } from 'posthog-js/react';

export function useTrackVisibility(
  sectionName: string,
  page: string,
): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  const tracked = useRef<boolean>(false);
  const posthog = usePostHog();

  useEffect(() => {
    const el = ref.current;
    if (!el || tracked.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !tracked.current) {
            tracked.current = true;
            posthog.capture('section_viewed', { section: sectionName, page });
            observer.disconnect();
          }
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [sectionName, page, posthog]);

  return ref;
}
