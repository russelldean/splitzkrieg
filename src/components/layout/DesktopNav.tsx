'use client';

import type { ReactNode } from 'react';

export function DesktopNav({ children }: { children: ReactNode }) {
  return (
    <nav className="hidden md:flex items-center gap-6 flex-shrink-0">
      {children}
    </nav>
  );
}

/** Desktop: inline search bar in header row */
export function HeaderSearchWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="hidden md:flex flex-1 max-w-md mx-auto">
      {children}
    </div>
  );
}

/** Mobile: full-width search bar below header row */
export function MobileSearchRow({ children }: { children: ReactNode }) {
  return (
    <div className="md:hidden pb-2">
      {children}
    </div>
  );
}
