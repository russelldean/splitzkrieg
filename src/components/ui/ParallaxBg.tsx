'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

const IMG_W = 640;
const IMG_H = 478;
const OBJ_POS_Y = 0.65;

export function ParallaxBg({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [desktopStyle, setDesktopStyle] = useState<React.CSSProperties>({
    backgroundImage: `url(${src})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center 65%',
    backgroundRepeat: 'no-repeat',
  });
  const [mobileTranslateY, setMobileTranslateY] = useState(0);
  const initialTopRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  // Detect mobile (iOS/Android ignore background-attachment: fixed)
  useEffect(() => {
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Desktop: original bg-fixed approach
  useEffect(() => {
    if (isMobile) return;
    function compute() {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const elW = rect.width;
      const elH = rect.height;
      const scale = Math.max(elW / IMG_W, elH / IMG_H);
      const imgW = IMG_W * scale;
      const imgH = IMG_H * scale;
      const excessY = imgH - elH;
      const offsetY = excessY * OBJ_POS_Y;
      const barPageTop = rect.top + window.scrollY;
      const bgPosY = barPageTop - offsetY;

      setDesktopStyle({
        backgroundImage: `url(${src})`,
        backgroundSize: `${imgW}px ${imgH}px`,
        backgroundPosition: `center ${bgPosY}px`,
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
      });
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [src, isMobile]);

  // Mobile: counteract scroll to make background move slower than content
  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      // Record where the element started
      if (initialTopRef.current === null) {
        initialTopRef.current = rect.top + window.scrollY;
      }
      // How far the element has scrolled from its initial position
      const scrolled = initialTopRef.current - (rect.top + window.scrollY);
      // Counteract 40% of the scroll — background moves at 60% speed
      setMobileTranslateY(scrolled * 0.4);
    });
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isMobile, handleScroll]);

  if (isMobile) {
    return (
      <div ref={ref} className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 65%',
            backgroundRepeat: 'no-repeat',
            top: '-50%',
            bottom: '-50%',
            transform: `translateY(${mobileTranslateY}px)`,
          }}
        />
      </div>
    );
  }

  return <div ref={ref} className="absolute inset-0" style={desktopStyle} />;
}
