'use client';

import { useEffect, useRef } from 'react';
import { usePostHog } from 'posthog-js/react';

interface TrackVisibilityProps {
  section: string;
  page: string;
  children: React.ReactNode;
  className?: string;
}

export function TrackVisibility({ section, page, children, className }: TrackVisibilityProps) {
  const ref = useRef<HTMLDivElement>(null);
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
  }, [section, page, posthog]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
