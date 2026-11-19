'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PATCH_CONFIG } from './patch-config';

export function PatchBadge({ type }: { type: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const cfg = PATCH_CONFIG[type];

  useEffect(() => {
    if (showTooltip && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({
        top: rect.top + window.scrollY - 4,
        left: rect.left + rect.width / 2,
      });
    }
  }, [showTooltip]);

  if (!cfg) return null;
  return (
    <span
      ref={ref}
      className="inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => { e.stopPropagation(); setShowTooltip(prev => !prev); }}
    >
      <span
        className={`inline-flex items-center text-[11px] font-semibold font-body px-1.5 py-0.5 rounded-full ${cfg.color} ${cfg.bg} leading-none cursor-help`}
      >
        {cfg.abbr}
      </span>
      {showTooltip && pos && createPortal(
        <span
          style={{ position: 'absolute', top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)' }}
          className="px-2 py-1 text-xs font-body text-white bg-navy rounded shadow-lg whitespace-nowrap z-50 pointer-events-none"
        >
          {cfg.label}
        </span>,
        document.body,
      )}
    </span>
  );
}
