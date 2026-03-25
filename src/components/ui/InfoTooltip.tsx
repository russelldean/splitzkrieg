'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
  text: string;
  className?: string;
}

export function InfoTooltip({ text, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);

  const position = useCallback(() => {
    const btn = ref.current;
    const tip = tipRef.current;
    if (!btn || !tip) return;

    const r = btn.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const pad = 8;

    // Center above the button
    let left = r.left + r.width / 2 - tipRect.width / 2;
    const top = r.top - tipRect.height - 8;

    // Clamp to viewport
    if (left < pad) left = pad;
    if (left + tipRect.width > window.innerWidth - pad) {
      left = window.innerWidth - pad - tipRect.width;
    }

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }, []);

  useEffect(() => {
    if (!open) return;
    // Position after render
    requestAnimationFrame(position);

    function handleOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleScroll() { setOpen(false); }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, position]);

  return (
    <button
      ref={ref}
      onClick={() => setOpen(!open)}
      className={`relative cursor-help ${className}`}
    >
      <svg className="w-4 h-4 text-navy/30 hover:text-navy/60 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
      {open && (
        <span
          ref={tipRef}
          className="fixed px-3 py-1.5 bg-navy text-cream text-xs font-body rounded-lg whitespace-nowrap shadow-lg z-50"
          style={{ left: -9999, top: -9999 }}
        >
          {text}
        </span>
      )}
    </button>
  );
}
