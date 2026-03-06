'use client';

import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';

interface DropdownLink {
  href: string;
  label: string;
}

interface NavDropdownProps {
  label: string;
  icon: ReactNode;
  links: DropdownLink[];
  href?: string;
}

export function NavDropdown({ label, icon, links, href }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }

  function handleLeave() {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {href ? (
        <Link
          href={href}
          className="flex items-center gap-1.5 text-navy font-body text-sm font-medium hover:text-red transition-colors py-2"
        >
          {icon}
          {label}
        </Link>
      ) : (
        <span className="flex items-center gap-1.5 text-navy font-body text-sm font-medium hover:text-red transition-colors py-2 cursor-default">
          {icon}
          {label}
        </span>
      )}

      {open && links.length > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full pt-1 z-50">
          <div className="bg-white border border-navy/10 rounded-lg shadow-lg overflow-hidden min-w-[180px]">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm font-body text-navy hover:bg-navy/[0.04] hover:text-red-600 transition-colors whitespace-nowrap"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
