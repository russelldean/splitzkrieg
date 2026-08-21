'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface ParallaxBgProps {
  src: string;
  /** Vertical focal point as a fraction (0 = top, 1 = bottom). Default 0.65 */
  focalY?: number;
  /**
   * First-paint hint for the image's native size. The real dimensions are
   * measured from the loaded image and take over, so a wrong value here costs
   * one frame, not a distorted hero. Omit it when the src is dynamic.
   */
  imgW?: number;
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
 * Natural pixel size of an image, or null until it has loaded.
 *
 * The parallax math needs the real aspect ratio. Because the background is
 * attachment:fixed (desktop) or position:fixed (mobile), `background-size:
 * cover` would cover the VIEWPORT rather than this element, so the size has to
 * be computed in explicit pixels from the image's dimensions. Setting both
 * dimensions means a wrong ratio does not crop, it STRETCHES.
 *
 * Callers used to have to hand-declare imgW/imgH. That works for a fixed asset
 * chosen at build time, but BlogPostLayout renders whatever hero the author set
 * in the editor, so it hardcoded 4032x3024 and distorted every hero that was
 * not 4:3 (turkeys.jpg at 3:2 rendered ~12.5% too tall). Measuring makes the
 * props a first-paint hint rather than the source of truth, and silently
 * corrects any caller whose numbers are wrong.
 */
function useNaturalSize(src: string): { w: number; h: number } | null {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSize(null);
    const img = new window.Image();
    const apply = () => {
      if (!cancelled && img.naturalWidth > 0 && img.naturalHeight > 0) {
        setSize({ w: img.naturalWidth, h: img.naturalHeight });
      }
    };
    img.onload = apply;
    img.src = src;
    if (img.complete) apply();
    return () => {
      cancelled = true;
    };
  }, [src]);

  return size;
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
export function ParallaxBg({ src, focalY = 0.65, imgW, imgH, maxW, mobileSrc, mobileFocalY, mobileImgW, mobileImgH }: ParallaxBgProps) {
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
  imgW?: number;
  imgH?: number;
  maxW?: number;
}) {
  const natural = useNaturalSize(src);
  const [style, setStyle] = useState<React.CSSProperties>({
    backgroundImage: `url(${src})`,
    backgroundSize: 'cover',
    backgroundPosition: `center ${focalY * 100}%`,
    backgroundRepeat: 'no-repeat',
  });

  useEffect(() => {
    function compute() {
      if (!ref.current) return;
      // Measured size wins; the props are only a first-paint hint. With neither,
      // stay on `cover` rather than guess: a brief non-parallax frame is a far
      // better failure than a stretched hero.
      const w = natural?.w ?? imgW;
      const h = natural?.h ?? imgH;
      if (!w || !h) return;
      const rect = ref.current.getBoundingClientRect();
      const fitW = maxW ? Math.min(rect.width, maxW) : rect.width;
      const scale = Math.max(fitW / w, rect.height / h);
      const scaledW = w * scale;
      const scaledH = h * scale;
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
    // Watch for layout shifts (announcement banner, lazy content, etc.)
    const observer = new ResizeObserver(compute);
    observer.observe(document.body);
    window.addEventListener('resize', compute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [src, focalY, ref, maxW, natural, imgW, imgH]);

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
  imgW?: number;
  imgH?: number;
  maxW?: number;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const natural = useNaturalSize(src);

  const computeLayout = useCallback(() => {
    if (!ref.current || !innerRef.current) return;
    // Measured size wins; see the desktop path.
    const w = natural?.w ?? imgW;
    const h = natural?.h ?? imgH;
    if (!w || !h) {
      innerRef.current.style.backgroundSize = 'cover';
      innerRef.current.style.backgroundPosition = `center ${focalY * 100}%`;
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const pageTop = rect.top + window.scrollY;
    const fitW = maxW ? Math.min(rect.width, maxW) : rect.width;
    const scale = Math.max(fitW / w, rect.height / h);
    const scaledW = w * scale;
    const scaledH = h * scale;
    const excessY = scaledH - rect.height;
    const bgPosY = pageTop - excessY * focalY;

    innerRef.current.style.backgroundSize = `${scaledW}px ${scaledH}px`;
    innerRef.current.style.backgroundPosition = `center ${bgPosY}px`;
  }, [ref, focalY, maxW, natural, imgW, imgH]);

  useEffect(() => {
    computeLayout();
    // Watch for layout shifts (announcement banner, lazy content, etc.)
    const observer = new ResizeObserver(computeLayout);
    if (ref.current?.parentElement) {
      observer.observe(document.body);
    }
    window.addEventListener('resize', computeLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', computeLayout);
    };
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
