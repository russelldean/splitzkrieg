'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function PageTransition() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Show progress bar on route change
    setIsVisible(true);
    setProgress(0);

    const startTimer = setTimeout(() => setProgress(60), 50);
    const midTimer = setTimeout(() => setProgress(80), 200);
    const endTimer = setTimeout(() => {
      setProgress(100);
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
        setProgress(0);
      }, 200);
      return () => clearTimeout(hideTimer);
    }, 400);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(midTimer);
      clearTimeout(endTimer);
    };
  }, [pathname]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-cream-dark">
      <div
        className="h-full bg-red transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
