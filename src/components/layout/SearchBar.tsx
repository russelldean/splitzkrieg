'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Fuse from 'fuse.js';
import { useRouter } from 'next/navigation';
import type { SearchEntry } from '@/lib/search-index';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
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

  // Open dropdown when there are results
  useEffect(() => {
    setIsOpen(results.length > 0);
    setSelectedIndex(-1);
  }, [results]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navigateToResult = useCallback(
    (entry: SearchEntry) => {
      router.push(`/bowler/${entry.slug}`);
      setQuery('');
      setIsOpen(false);
    },
    [router]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') {
        setQuery('');
        setIsOpen(false);
        inputRef.current?.blur();
      }
      return;
    }

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
      case 'Escape':
        e.preventDefault();
        setQuery('');
        setIsOpen(false);
        inputRef.current?.blur();
        break;
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
        onFocus={() => {
          if (results.length > 0) setIsOpen(true);
        }}
        placeholder="Search bowlers..."
        className="w-full bg-white border border-navy/20 rounded-lg px-4 py-2 text-sm font-body text-navy placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-red/30 focus:border-red/30 transition-colors"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={selectedIndex >= 0 ? `search-result-${selectedIndex}` : undefined}
        aria-label="Search bowlers"
      />

      {isOpen && results.length > 0 && (
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
                // Use mousedown instead of click to fire before blur
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
    </div>
  );
}
