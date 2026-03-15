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

/** Desktop: inline search bar in header row (hidden on homepage) */
export function HeaderSearchWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/') return null;

  return (
    <div className="hidden md:flex flex-1 max-w-md mx-auto">
      {children}
    </div>
  );
}

/** Mobile: full-width search bar below header row (hidden on homepage) */
export function MobileSearchRow({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/') return null;

  return (
    <div className="md:hidden pb-3">
      {children}
    </div>
  );
}
