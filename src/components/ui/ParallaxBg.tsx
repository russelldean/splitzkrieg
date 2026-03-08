'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

export function ParallaxBg({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [translateY, setTranslateY] = useState(0);
  const rafRef = useRef<number>(0);

  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const viewH = window.innerHeight;
      // Progress: 0 when element enters bottom of viewport, 1 when it exits top
      const progress = 1 - (rect.bottom / (viewH + rect.height));
      // Move the background up to 40px based on scroll progress
      setTranslateY(progress * 40);
    });
  }, []);

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
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 will-change-transform"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 65%',
          backgroundRepeat: 'no-repeat',
          // Oversized at top to allow room for downward parallax shift
          top: '-40px',
          bottom: '0px',
          transform: `translateY(${translateY}px)`,
        }}
      />
    </div>
  );
}
