'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Fuse from 'fuse.js';
import { useRouter } from 'next/navigation';
import type { SearchEntry } from '@/lib/search-index';


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
      inputRef.current?.blur();
      setQuery('');
      setIsFocused(false);
      router.push(`/bowler/${entry.slug}`);
    },
    [router]
  );

  const hasResults = results.length > 0;
  const isSearching = query.length >= 2;
  const showResults = isFocused && isSearching && hasResults;
  const showNoResults = isFocused && isSearching && !hasResults;
  const isDropdownOpen = showResults || showNoResults;

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
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/30 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          placeholder="Find a bowler..."
          className="w-full bg-white border border-navy/20 rounded-lg pl-9 pr-4 py-2 text-base sm:text-sm font-body text-navy placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-red/30 focus:border-red/30 transition-colors animate-search-glow"
          role="combobox"
          aria-expanded={isDropdownOpen}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={selectedIndex >= 0 ? `search-result-${selectedIndex}` : undefined}
          aria-label="Search bowlers"
        />
      </div>

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
              <span className="text-navy/65 text-xs ml-2">
                {result.item.seasonsActive} {result.item.seasonsActive === 1 ? 'season' : 'seasons'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* No results */}
      {showNoResults && (
        <div className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-navy/10 z-50 px-4 py-2.5">
          <span className="font-body text-sm text-navy/65">
            No bowlers found for &ldquo;{query}&rdquo;
          </span>
        </div>
      )}
    </div>
  );
}
