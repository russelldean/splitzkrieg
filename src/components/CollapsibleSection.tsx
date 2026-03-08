'use client';
import { useState, useEffect } from 'react';

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({ title, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  // Auto-open if URL hash starts with "match-"
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && hash.startsWith('match-') && !open) {
      setOpen(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When opening via hash, scroll to target after render
  useEffect(() => {
    if (open) {
      const hash = window.location.hash.slice(1);
      if (hash) {
        requestAnimationFrame(() => {
          const target = document.getElementById(hash);
          target?.scrollIntoView({ behavior: 'smooth' });
        });
      }
    }
  }, [open]);

  // Handle hash clicks while on the page (only for match anchors)
  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.slice(1);
      if (!hash || !hash.startsWith('match-')) return;
      setOpen(true);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className="border border-navy/10 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-4 py-3 bg-navy/[0.02] hover:bg-navy/[0.05] transition-colors"
      >
        <span className="font-heading text-lg text-navy">{title}</span>
        <span className="text-navy/65 text-sm">{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && (
        <div className="px-4 py-3">
          {children}
        </div>
      )}
    </div>
  );
}
