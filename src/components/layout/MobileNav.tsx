'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';

interface NavLink {
  href: string;
  label: string;
  icon?: ReactNode;
}

interface MobileNavProps {
  links: NavLink[];
}

export function MobileNav({ links }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle navigation"
        aria-expanded={isOpen}
        className="flex flex-col justify-center items-center gap-1.5 p-2 rounded hover:bg-cream-dark transition-colors"
      >
        <span
          className={`block h-0.5 w-5 bg-navy transition-transform duration-200 ${
            isOpen ? 'translate-y-2 rotate-45' : ''
          }`}
        />
        <span
          className={`block h-0.5 w-5 bg-navy transition-opacity duration-200 ${
            isOpen ? 'opacity-0' : ''
          }`}
        />
        <span
          className={`block h-0.5 w-5 bg-navy transition-transform duration-200 ${
            isOpen ? '-translate-y-2 -rotate-45' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-cream border border-navy/10 rounded-lg shadow-md overflow-hidden z-50">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-body font-medium text-navy hover:bg-cream-dark transition-colors"
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
