'use client';

import { useState, useEffect, useRef } from 'react';

interface StickyContextBarProps {
  name: string;
  /** Optional subtitle (e.g. team abbreviation, current avg) */
  detail?: string;
}

/**
 * Renders an invisible sentinel at mount position + a sticky bar
 * that slides in below the site header when the sentinel scrolls out of view.
 */
export function StickyContextBar({ name, detail }: StickyContextBarProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-64px 0px 0px 0px' } // 64px = header height
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Invisible sentinel — placed near top of hero */}
      <div ref={sentinelRef} className="h-0 w-0" aria-hidden />

      {/* Sticky bar — slides in when hero scrolls away */}
      <div
        className={`fixed top-16 left-0 right-0 z-40 transition-all duration-300 ${
          visible
            ? 'translate-y-0 opacity-100'
            : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-navy/95 backdrop-blur-sm border-b border-white/10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-3">
            <span className="font-heading text-sm sm:text-base text-cream tracking-wide truncate">
              {name}
            </span>
            {detail && (
              <span className="font-body text-xs text-cream/70">
                {detail}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
