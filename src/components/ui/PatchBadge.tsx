'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const PATCH_CONFIG: Record<string, { label: string; abbr: string; color: string; bg: string }> = {
  perfectGame:    { label: 'Perfect Game',       abbr: '300',  color: 'text-amber-800',  bg: 'bg-amber-200' },
  botw:           { label: 'Bowler of the Week', abbr: 'BOTW', color: 'text-purple-700', bg: 'bg-purple-100' },
  highGame:       { label: 'Weekly High Game',   abbr: 'HG',   color: 'text-blue-700',   bg: 'bg-blue-100' },
  highSeries:     { label: 'Weekly High Series', abbr: 'HS',   color: 'text-emerald-700', bg: 'bg-emerald-100' },
  aboveAvg:         { label: 'Above Avg All 3',     abbr: '3/3',  color: 'text-teal-700',    bg: 'bg-teal-100' },
  threeOfAKind:     { label: 'Three of a Kind',    abbr: '3K',   color: 'text-pink-700',    bg: 'bg-pink-100' },
  playoff:          { label: 'Team Playoffs',      abbr: 'TP',   color: 'text-indigo-700',  bg: 'bg-indigo-100' },
  scratchPlayoff:   { label: 'Scratch Playoffs',   abbr: 'SP',   color: 'text-rose-700',    bg: 'bg-rose-100' },
  hcpPlayoff:       { label: 'Handicap Playoffs',  abbr: 'HP',   color: 'text-orange-700',  bg: 'bg-orange-100' },
  champion:         { label: 'Champion',            abbr: '\uD83C\uDFC6',  color: 'text-amber-700',   bg: 'bg-amber-100' },
  scratchChampion:  { label: 'Scratch Champion',    abbr: 'SC',   color: 'text-rose-700',    bg: 'bg-rose-200' },
  hcpChampion:      { label: 'Handicap Champion',   abbr: 'HC',   color: 'text-orange-700',  bg: 'bg-orange-200' },
};

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
