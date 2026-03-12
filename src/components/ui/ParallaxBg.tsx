'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface ParallaxBgProps {
  src: string;
  /** Vertical focal point as a fraction (0 = top, 1 = bottom). Default 0.65 */
  focalY?: number;
  /** Native image width for positioning math. Default 640 */
  imgW?: number;
  /** Native image height for positioning math. Default 478 */
  imgH?: number;
  /** Cap image width (px) so it doesn't stretch edge-to-edge. Centered, dark bg fills sides. */
  maxW?: number;
  /** Optional mobile-specific image source + dimensions */
  mobileSrc?: string;
  mobileFocalY?: number;
  mobileImgW?: number;
  mobileImgH?: number;
}

/**
 * Parallax background that works on both desktop and mobile.
 * - Desktop: CSS background-attachment: fixed
 * - Mobile (touch devices): position:fixed + clip-path:inset(0) on parent
 *   (pure CSS — no JS scroll listeners, immune to iOS toolbar resizing)
 *
 * Usage: Place inside a positioned container with overflow-hidden.
 * <div className="relative overflow-hidden h-40">
 *   <ParallaxBg src="/my-image.jpg" />
 *   <div className="relative z-10">Content on top</div>
 * </div>
 */
export function ParallaxBg({ src, focalY = 0.65, imgW = 640, imgH = 478, maxW, mobileSrc, mobileFocalY, mobileImgW, mobileImgH }: ParallaxBgProps) {
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
    const mSrc = mobileSrc ?? src;
    const mFocalY = mobileSrc ? (mobileFocalY ?? focalY) : focalY;
    const mW = mobileSrc ? (mobileImgW ?? imgW) : imgW;
    const mH = mobileSrc ? (mobileImgH ?? imgH) : imgH;
    return <MobileParallax ref={ref} src={mSrc} focalY={mFocalY} imgW={mW} imgH={mH} maxW={maxW} />;
  }

  return <DesktopParallax ref={ref} src={src} focalY={focalY} imgW={imgW} imgH={imgH} maxW={maxW} />;
}

/* ── Desktop: bg-fixed approach ─────────────────────────────── */

function DesktopParallax({
  ref,
  src,
  focalY,
  imgW,
  imgH,
  maxW,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  src: string;
  focalY: number;
  imgW: number;
  imgH: number;
  maxW?: number;
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
      const fitW = maxW ? Math.min(rect.width, maxW) : rect.width;
      const scale = Math.max(fitW / imgW, rect.height / imgH);
      const scaledW = imgW * scale;
      const scaledH = imgH * scale;
      const excessY = scaledH - rect.height;
      const offsetY = excessY * focalY;
      const bgPosY = rect.top + window.scrollY - offsetY;

      setStyle({
        backgroundImage: `url(${src})`,
        backgroundSize: `${scaledW}px ${scaledH}px`,
        backgroundPosition: `center ${bgPosY}px`,
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
      });
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [src, focalY, ref, maxW]);

  return <div ref={ref} className="absolute inset-0" style={style} />;
}

/* ── Mobile: position:fixed + clip-path ────────────────────── */
// iOS ignores background-attachment:fixed. Instead of JS scroll
// listeners (which fight with toolbar show/hide), we use:
//   - clip-path: inset(0) on the parent — this clips fixed children
//   - position: fixed on the image div — browser keeps it viewport-locked
//     natively, including during toolbar transitions
// Result: zero JS, zero shift, pixel-perfect.

function MobileParallax({
  ref,
  src,
  focalY,
  imgW,
  imgH,
  maxW,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  src: string;
  focalY: number;
  imgW: number;
  imgH: number;
  maxW?: number;
}) {
  const innerRef = useRef<HTMLDivElement>(null);

  const computeLayout = useCallback(() => {
    if (!ref.current || !innerRef.current) return;
    const rect = ref.current.getBoundingClientRect();
    const pageTop = rect.top + window.scrollY;
    const fitW = maxW ? Math.min(rect.width, maxW) : rect.width;
    const scale = Math.max(fitW / imgW, rect.height / imgH);
    const scaledW = imgW * scale;
    const scaledH = imgH * scale;
    const excessY = scaledH - rect.height;
    const bgPosY = pageTop - excessY * focalY;

    innerRef.current.style.backgroundSize = `${scaledW}px ${scaledH}px`;
    innerRef.current.style.backgroundPosition = `center ${bgPosY}px`;
  }, [ref, focalY, maxW]);

  useEffect(() => {
    computeLayout();
    window.addEventListener('resize', computeLayout);
    return () => window.removeEventListener('resize', computeLayout);
  }, [computeLayout]);

  return (
    <div
      ref={ref}
      className="absolute inset-0"
      style={{ clipPath: 'inset(0)' }}
    >
      <div
        ref={innerRef}
        className="fixed inset-0"
        style={{
          backgroundImage: `url(${src})`,
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
}
