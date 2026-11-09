'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * One turkey per turkey, in a single line that waddles in from the right edge
 * of the card and comes to rest, so when the line stops it is the count. Starts
 * when the card scrolls into view. Reduced-motion users just get the row.
 */
export function TurkeyParade({ count }: { count: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [go, setGo] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setGo(true); return () => ro.disconnect(); }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setGo(true); obs.disconnect(); } }, { threshold: 0.4 });
    obs.observe(el);
    return () => { obs.disconnect(); ro.disconnect(); };
  }, []);

  const n = Math.max(0, Math.min(count, 60));
  // One line, however many birds: size them to share the measured card width.
  // An emoji glyph runs about 1.2em wide, so divide by that too.
  const size = width > 0 ? `${Math.min(48, Math.floor(width / Math.max(1, n) / 1.2))}px` : '0px';
  const duration = Math.min(9, 3.5 + n * 0.2);
  return (
    // Fixed 3rem lane, the biggest a bird can be, so the card never changes height
    // between the empty lane, the measured size, and the birds arriving.
    <div ref={ref} className="mt-8 overflow-hidden h-12 flex items-center" aria-label={`${count} turkeys`} role="img">
      <div
        className="flex flex-nowrap justify-start w-full"
        style={{
          fontSize: size,
          opacity: go ? undefined : 0,
          animation: go ? `turkey-line ${duration}s cubic-bezier(.25,.6,.35,1) 0.2s both` : undefined,
        }}
      >
        {Array.from({ length: n }, (_, i) => (
          <span
            key={i}
            className="inline-block leading-none flex-none"
            style={{ animation: go ? `turkey-bob 0.3s ease-in-out ${(i * 0.07).toFixed(2)}s ${Math.round(duration / 0.3)} alternate` : undefined }}
            aria-hidden
          >
            {'\u{1F983}'}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes turkey-line {
          from { transform: translateX(100%); opacity: 1; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes turkey-bob {
          from { transform: translateY(0) rotate(-5deg); }
          to   { transform: translateY(-3px) rotate(5deg); }
        }
      `}</style>
    </div>
  );
}
