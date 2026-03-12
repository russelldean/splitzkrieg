'use client';

import { useState, useEffect } from 'react';
import announcements from '../../../content/announcements';

const STORAGE_PREFIX = 'sz-dismissed-';

const typeStyles = {
  info: 'bg-navy text-cream',
  urgent: 'bg-red text-white',
  celebration: 'bg-gold text-navy',
};

const typeIcons = {
  info: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 1zM5.05 3.05a.75.75 0 011.06 0l1.062 1.06A.75.75 0 116.11 5.173L5.05 4.11a.75.75 0 010-1.06zm9.9 0a.75.75 0 010 1.06l-1.06 1.062a.75.75 0 01-1.062-1.061l1.061-1.06a.75.75 0 011.06 0zM3 8a7 7 0 1113.262 3.13l.893 3.575a.75.75 0 01-.724.945H4.57a.75.75 0 01-.725-.945l.893-3.575A6.97 6.97 0 013 8zm2.489 4.34l-.625 2.505h10.272l-.625-2.504A7.03 7.03 0 0110 13a7.03 7.03 0 01-4.511-.66zM10 4a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  ),
  urgent: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  ),
  celebration: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M5 2a.75.75 0 01.75.75V4h8.5V2.75a.75.75 0 011.5 0V4h.25A2.5 2.5 0 0118.5 6.5v9a2.5 2.5 0 01-2.5 2.5H4A2.5 2.5 0 011.5 15.5v-9A2.5 2.5 0 014 4h.25V2.75A.75.75 0 015 2zm1.22 9.22a.75.75 0 011.06 0L9 12.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0l-2.25-2.25a.75.75 0 010-1.06z" clipRule="evenodd" />
    </svg>
  ),
};

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const ids = announcements
      .filter((a) => localStorage.getItem(STORAGE_PREFIX + a.id) === '1')
      .map((a) => a.id);
    setDismissed(new Set(ids));
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const today = new Date().toISOString().slice(0, 10);
  const active = announcements.filter(
    (a) => !dismissed.has(a.id) && (!a.expires || a.expires > today)
  );

  if (active.length === 0) return null;

  function dismiss(id: string) {
    localStorage.setItem(STORAGE_PREFIX + id, '1');
    setDismissed((prev) => new Set(prev).add(id));
  }

  return (
    <div>
      {active.map((a) => (
        <div
          key={a.id}
          className={`${typeStyles[a.type]} text-sm font-body`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-center gap-3 animate-announcement">
            <span className="shrink-0">{typeIcons[a.type]}</span>
            <p className="text-center font-medium">{a.message}</p>
            <button
              onClick={() => dismiss(a.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss announcement"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
