'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface NavLink {
  href: string;
  label: string;
}

interface NavItem {
  label: string;
  href: string;
  links: NavLink[];
  newBadgeKey?: string; // localStorage key for "New" badge dismissal
}

const SEEN_PREFIX = 'sz-seen-';

export function HomeNavBar({ items }: { items: NavItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [seenKeys, setSeenKeys] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRef = useRef<HTMLElement>(null);

  function handleEnter(i: number) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpenIndex(i);
  }

  function handleLeave() {
    timeoutRef.current = setTimeout(() => setOpenIndex(null), 150);
  }

  useEffect(() => {
    setMounted(true);
    // Load seen state from localStorage
    const seen = new Set<string>();
    for (const item of items) {
      if (item.newBadgeKey && localStorage.getItem(SEEN_PREFIX + item.newBadgeKey) === '1') {
        seen.add(item.newBadgeKey);
      }
    }
    setSeenKeys(seen);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [items]);

  function handleNavClick(item: NavItem) {
    if (item.newBadgeKey && !seenKeys.has(item.newBadgeKey)) {
      localStorage.setItem(SEEN_PREFIX + item.newBadgeKey, '1');
      setSeenKeys((prev) => new Set(prev).add(item.newBadgeKey!));
    }
  }

  return (
    <nav ref={barRef} className="mt-6 sm:mt-8 border-y border-navy/30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center divide-x divide-navy/25">
        {items.map((item, i) => {
          const showBadge = mounted && item.newBadgeKey && !seenKeys.has(item.newBadgeKey);

          return (
            <div
              key={item.href}
              className="relative flex-1"
              onMouseEnter={() => handleEnter(i)}
              onMouseLeave={handleLeave}
            >
              <Link
                href={item.href}
                onClick={() => handleNavClick(item)}
                className="group block text-center px-2 py-3 rounded-md hover:bg-navy/5 transition-colors"
              >
                <span className="font-body text-sm font-semibold text-navy group-hover:text-red transition-colors">
                  {item.label}
                </span>
                {showBadge && (
                  <span className="ml-1.5 inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none bg-red text-white rounded-sm align-middle -translate-y-px">
                    New
                  </span>
                )}
              </Link>

              {openIndex === i && item.links.length > 0 && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full pt-1 z-50">
                  <div className="bg-white border border-navy/10 rounded-lg shadow-lg overflow-hidden min-w-[180px]">
                    {item.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => {
                          setOpenIndex(null);
                          handleNavClick(item);
                        }}
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
        })}
      </div>
    </nav>
  );
}
