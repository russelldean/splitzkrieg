'use client';

import { useEffect, useRef } from 'react';
import { usePostHog } from 'posthog-js/react';

interface TrackVisibilityProps {
  section: string;
  page: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Set false to render the same markup but capture nothing. Used by the admin
   * draft preview, which reuses the real page body and would otherwise inflate
   * the section-engagement baseline every time Russ proofreads a recap.
   */
  enabled?: boolean;
}

export function TrackVisibility({ section, page, children, className, enabled = true }: TrackVisibilityProps) {
  const ref = useRef<HTMLDivElement>(null);
  const tracked = useRef<boolean>(false);
  const posthog = usePostHog();

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el || tracked.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !tracked.current) {
            tracked.current = true;
            posthog.capture('section_viewed', { section, page });
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
  }, [section, page, posthog, enabled]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
