'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface ParallaxBgProps {
  src: string;
  /** Vertical focal point as a fraction (0 = top, 1 = bottom). Default 0.65 */
  focalY?: number;
}

/**
 * Parallax background that works on both desktop and mobile.
 * - Desktop: CSS background-attachment: fixed
 * - Mobile (touch devices): JS-driven translateY since iOS ignores bg-fixed
 *
 * Usage: Place inside a positioned container with overflow-hidden.
 * <div className="relative overflow-hidden h-40">
 *   <ParallaxBg src="/my-image.jpg" />
 *   <div className="relative z-10">Content on top</div>
 * </div>
 */
export function ParallaxBg({ src, focalY = 0.65 }: ParallaxBgProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (isMobile) {
    return <MobileParallax ref={ref} src={src} focalY={focalY} />;
  }

  return <DesktopParallax ref={ref} src={src} focalY={focalY} />;
}

/* ── Desktop: bg-fixed approach ─────────────────────────────── */

const IMG_W = 640;
const IMG_H = 478;

function DesktopParallax({
  ref,
  src,
  focalY,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  src: string;
  focalY: number;
}) {
  const [style, setStyle] = useState<React.CSSProperties>({
    backgroundImage: `url(${src})`,
    backgroundSize: 'cover',
    backgroundPosition: `center ${focalY * 100}%`,
    backgroundRepeat: 'no-repeat',
  });

  useEffect(() => {
    function compute() {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const scale = Math.max(rect.width / IMG_W, rect.height / IMG_H);
      const imgH = IMG_H * scale;
      const excessY = imgH - rect.height;
      const offsetY = excessY * focalY;
      const bgPosY = rect.top + window.scrollY - offsetY;

      setStyle({
        backgroundImage: `url(${src})`,
        backgroundSize: `${IMG_W * scale}px ${imgH}px`,
        backgroundPosition: `center ${bgPosY}px`,
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
      });
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [src, focalY, ref]);

  return <div ref={ref} className="absolute inset-0" style={style} />;
}

/* ── Mobile: simulate bg-fixed via translateY ───────────────── */
// iOS ignores background-attachment:fixed, so we manually keep the
// background locked to the viewport by translating it to counteract
// the container's scroll movement. The container's overflow:hidden
// clips it to the visible window — same visual result as bg-fixed.
//
// We use the exact same image sizing/positioning math as the desktop
// bg-fixed path so both platforms show the same crop of the image.

function MobileParallax({
  ref,
  src,
  focalY,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  src: string;
  focalY: number;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!ref.current || !innerRef.current) return;
      const rect = ref.current.getBoundingClientRect();

      // Same image sizing as desktop — scale to cover the container
      const scale = Math.max(rect.width / IMG_W, rect.height / IMG_H);
      const imgW = IMG_W * scale;
      const imgH = IMG_H * scale;

      // Same focal-point positioning as desktop
      const excessY = imgH - rect.height;
      const offsetY = excessY * focalY;
      const pageTop = rect.top + window.scrollY;
      const bgPosY = pageTop - offsetY;

      // Pin to viewport by counteracting container scroll
      const el = innerRef.current;
      el.style.transform = `translateY(${-rect.top}px)`;
      el.style.backgroundSize = `${imgW}px ${imgH}px`;
      el.style.backgroundPosition = `center ${bgPosY}px`;
    });
  }, [ref, focalY]);

  useEffect(() => {
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll]);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <div
        ref={innerRef}
        className="absolute inset-x-0 top-0 will-change-transform"
        style={{
          height: '100vh',
          backgroundImage: `url(${src})`,
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
}
