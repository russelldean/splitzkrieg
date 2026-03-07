'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper for horizontally-scrollable tables.
 * Shows a right-edge gradient fade + "Scroll" pill when content overflows.
 */
export function ScrollableTable({ children, className = '' }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  // Re-check when children change (tab switches, etc.)
  useEffect(() => {
    requestAnimationFrame(checkScroll);
  }, [children, checkScroll]);

  return (
    <div className={`relative ${className}`}>
      <div ref={scrollRef} className="overflow-x-auto -mx-4 sm:mx-0">
        {children}
      </div>
      {canScrollRight && (
        <>
          <div className="absolute top-0 right-0 bottom-0 w-8 pointer-events-none bg-gradient-to-l from-white to-transparent" />
          <div className="absolute top-2 right-1 pointer-events-none">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-body font-medium text-navy/50 bg-navy/5 rounded-full border border-navy/10 animate-pulse">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
