'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Fuse from 'fuse.js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SearchEntry } from '@/lib/search-index';

type SearchState = 'IDLE' | 'BROWSING' | 'SEARCHING';

const categories = [
  {
    label: 'Bowlers',
    href: '/bowlers',
    description: 'Browse all bowlers',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
  },
  {
    label: 'Teams',
    href: '/teams',
    description: 'View team rosters',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
  {
    label: 'Seasons',
    href: '/seasons',
    description: 'Explore 35+ seasons',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    label: 'Leaderboards',
    href: '/leaderboards',
    description: 'All-time records',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0 1 16.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 0 1-2.52.857m0 0a6.098 6.098 0 0 1-3.5 0m0 0a6.023 6.023 0 0 1-2.52-.857" />
      </svg>
    ),
  },
];

export function DiscoverySearch() {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Derive state from focus + query
  const searchState: SearchState = !isFocused
    ? 'IDLE'
    : query.length >= 2
      ? 'SEARCHING'
      : 'BROWSING';

  // Load search index on mount
  useEffect(() => {
    fetch('/api/search-index')
      .then((res) => res.json())
      .then((data: SearchEntry[]) => setEntries(data))
      .catch((err) => console.warn('Failed to load search index:', err));
  }, []);

  // Create Fuse instance when entries change
  const fuse = useMemo(
    () =>
      new Fuse(entries, {
        keys: ['name'],
        threshold: 0.3,
        minMatchCharLength: 2,
      }),
    [entries]
  );

  // Compute results from query
  const results = useMemo(() => {
    if (query.length < 2) return [];
    return fuse.search(query, { limit: 8 });
  }, [fuse, query]);

  // Reset selection on results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navigateToResult = useCallback(
    (entry: SearchEntry) => {
      router.push(`/bowler/${entry.slug}`);
      setQuery('');
      setIsFocused(false);
    },
    [router]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
      setIsFocused(false);
      inputRef.current?.blur();
      return;
    }

    if (searchState === 'SEARCHING' && results.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            navigateToResult(results[selectedIndex].item);
          }
          break;
      }
    }
  }

  const listboxId = 'discovery-search-listbox';
  const isDropdownOpen = searchState === 'BROWSING' || (searchState === 'SEARCHING' && results.length > 0);

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      <div className="relative">
        <svg
          className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-navy/40 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          placeholder="Search bowlers by name..."
          className="w-full bg-white border border-navy/20 rounded-xl pl-12 sm:pl-14 pr-4 py-2.5 sm:py-3 text-base sm:text-lg font-body text-navy placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-red/30 focus:border-red/30 shadow-sm transition-colors"
          role="combobox"
          aria-expanded={isDropdownOpen}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={selectedIndex >= 0 ? `discovery-result-${selectedIndex}` : undefined}
          aria-label="Search bowlers by name"
        />
      </div>

      {/* Category Prompts - BROWSING state */}
      {searchState === 'BROWSING' && (
        <div
          id={listboxId}
          className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-lg border border-navy/10 z-50 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-navy/5">
            <span className="text-xs font-body text-navy/50 uppercase tracking-wider">Browse</span>
          </div>
          {categories.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              onMouseDown={(e) => {
                e.preventDefault();
                router.push(cat.href);
                setIsFocused(false);
              }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-cream-dark transition-colors"
            >
              <span className="text-navy/50">{cat.icon}</span>
              <div>
                <div className="font-body text-sm font-medium text-navy">{cat.label}</div>
                <div className="font-body text-xs text-navy/50">{cat.description}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Fuse.js Results - SEARCHING state */}
      {searchState === 'SEARCHING' && results.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-lg border border-navy/10 z-50 overflow-hidden"
        >
          {results.map((result, index) => (
            <li
              key={result.item.id}
              id={`discovery-result-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                index === selectedIndex ? 'bg-cream-dark' : 'hover:bg-cream-dark'
              }`}
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault();
                navigateToResult(result.item);
              }}
            >
              <span className="font-body text-navy">{result.item.name}</span>
              <span className="text-navy/50 text-xs ml-3 whitespace-nowrap">
                {result.item.seasonsActive} {result.item.seasonsActive === 1 ? 'season' : 'seasons'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* No results message */}
      {searchState === 'SEARCHING' && query.length >= 2 && results.length === 0 && (
        <div
          className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-lg border border-navy/10 z-50 px-4 py-3"
        >
          <span className="font-body text-sm text-navy/50">
            No bowlers found for &ldquo;{query}&rdquo;
          </span>
        </div>
      )}
    </div>
  );
}
