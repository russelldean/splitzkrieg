'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';

interface NavLink {
  href: string;
  label: string;
}

interface NavGroup {
  title: string;
  icon: ReactNode;
  links: NavLink[];
}

interface MobileNavProps {
  groups: NavGroup[];
}

export function MobileNav({ groups }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle navigation"
        aria-expanded={isOpen}
        className="relative z-50 flex items-center gap-2 px-3 py-2 rounded-lg bg-navy text-cream transition-colors hover:bg-navy-light"
      >
        <div className="relative w-5 h-5 flex flex-col justify-center items-center">
          {/* Top line — rotates to become one arm of the X */}
          <span
            className={`absolute block h-[2.5px] w-5 rounded-sm transition-all duration-300 origin-center ${
              isOpen ? 'rotate-45 bg-[#c53030]' : 'bg-cream -translate-y-[6px]'
            }`}
          />
          {/* Middle line — fades out */}
          <span
            className={`absolute block h-[2.5px] w-5 rounded-sm bg-cream transition-all duration-200 ${
              isOpen ? 'opacity-0 scale-x-0' : 'opacity-100'
            }`}
          />
          {/* Bottom line — rotates to become other arm of the X */}
          <span
            className={`absolute block h-[2.5px] w-5 rounded-sm transition-all duration-300 origin-center ${
              isOpen ? '-rotate-45 bg-[#c53030]' : 'bg-cream translate-y-[6px]'
            }`}
          />
        </div>
        <span className="font-body text-sm font-semibold">{isOpen ? 'Close' : 'Menu'}</span>
      </button>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-navy/40 z-40 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Slide-down Panel */}
      <div
        className={`fixed top-16 left-0 right-0 bottom-0 z-40 bg-cream overflow-y-auto transition-all duration-250 ease-out ${
          isOpen ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <nav className="max-w-lg mx-auto px-6 py-4 space-y-4">
          {groups.map((group) => (
            <div key={group.title}>
              <div className="flex items-center gap-2 text-navy/80 uppercase text-xs font-heading tracking-widest mb-1.5 px-1 pb-1.5 border-b border-navy/15">
                <span className="w-4 h-4">{group.icon}</span>
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-2 text-base font-body font-medium text-navy rounded-lg hover:bg-cream-dark active:bg-cream-dark transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {/* Footer links */}
          <div className="border-t border-navy/10 pt-4 space-y-0.5">
            <Link
              href="/about"
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 text-base font-body text-navy/60 rounded-lg hover:bg-cream-dark transition-colors"
            >
              About the League
            </Link>
            <Link
              href="/village-lanes"
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 text-base font-body text-navy/60 rounded-lg hover:bg-cream-dark transition-colors"
            >
              Village Lanes
            </Link>
            <Link
              href="/resources#recent-updates"
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 text-base font-body text-navy/60 rounded-lg hover:bg-cream-dark transition-colors"
            >
              Recent Updates
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
