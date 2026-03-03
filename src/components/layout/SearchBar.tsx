'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Fuse from 'fuse.js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SearchEntry } from '@/lib/search-index';

const browseCategories = [
  { label: 'Bowlers', href: '/bowlers', description: 'Browse all bowlers' },
  { label: 'Teams', href: '/teams', description: 'View team rosters' },
  { label: 'Seasons', href: '/seasons', description: 'Explore 35+ seasons' },
  { label: 'Leaderboards', href: '/leaderboards', description: 'All-time records' },
];

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

  const hasResults = results.length > 0;
  const isSearching = query.length >= 2;
  const showBrowse = isFocused && !isSearching;
  const showResults = isFocused && isSearching && hasResults;
  const showNoResults = isFocused && isSearching && !hasResults;
  const isDropdownOpen = showBrowse || showResults || showNoResults;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
      setIsFocused(false);
      inputRef.current?.blur();
      return;
    }

    if (showResults && results.length > 0) {
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

  const listboxId = 'search-results-listbox';

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        placeholder="Search bowlers..."
        className="w-full bg-white border border-navy/20 rounded-lg px-4 py-2 text-sm font-body text-navy placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-red/30 focus:border-red/30 transition-colors"
        role="combobox"
        aria-expanded={isDropdownOpen}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={selectedIndex >= 0 ? `search-result-${selectedIndex}` : undefined}
        aria-label="Search bowlers"
      />

      {/* Browse categories when focused with no query */}
      {showBrowse && (
        <div
          id={listboxId}
          className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-navy/10 z-50 overflow-hidden"
        >
          <div className="px-3 py-1.5 border-b border-navy/5">
            <span className="text-xs font-body text-navy/40 uppercase tracking-wider">Browse</span>
          </div>
          {browseCategories.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              onMouseDown={(e) => {
                e.preventDefault();
                router.push(cat.href);
                setIsFocused(false);
              }}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-cream-dark transition-colors"
            >
              <span className="font-body text-sm font-medium text-navy">{cat.label}</span>
              <span className="font-body text-xs text-navy/40">{cat.description}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Search results */}
      {showResults && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-navy/10 z-50 overflow-hidden"
        >
          {results.map((result, index) => (
            <li
              key={result.item.id}
              id={`search-result-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              className={`block px-4 py-2 cursor-pointer transition-colors ${
                index === selectedIndex ? 'bg-cream-dark' : 'hover:bg-cream-dark'
              }`}
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault();
                navigateToResult(result.item);
              }}
            >
              <span className="font-body text-navy text-sm">{result.item.name}</span>
              <span className="text-navy/40 text-xs ml-2">
                {result.item.seasonsActive} {result.item.seasonsActive === 1 ? 'season' : 'seasons'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* No results */}
      {showNoResults && (
        <div className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-navy/10 z-50 px-4 py-2.5">
          <span className="font-body text-sm text-navy/50">
            No bowlers found for &ldquo;{query}&rdquo;
          </span>
        </div>
      )}
    </div>
  );
}
