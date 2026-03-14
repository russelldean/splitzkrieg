'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Hides desktop nav on homepage where HomeNavBar replaces it */
export function DesktopNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/') return null;

  return (
    <nav className="hidden md:flex items-center gap-6 flex-shrink-0">
      {children}
    </nav>
  );
}

/** Hides search bar on homepage where it moves to the ticker area */
export function HeaderSearchWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/') return null;

  return (
    <div className="flex-1 max-w-md mx-auto">
      {children}
    </div>
  );
}
