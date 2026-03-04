'use client';
import { useState } from 'react';
import type { FranchiseNameEntry } from '@/lib/queries';
import { strikeX } from '@/components/ui/StrikeX';

interface Props {
  names: FranchiseNameEntry[];
}

export function FranchiseHistory({ names }: Props) {
  const [open, setOpen] = useState(false);

  // Deduplicate consecutive identical names (team may keep same name across seasons)
  const uniqueNames: string[] = [];
  for (const entry of names) {
    if (uniqueNames.length === 0 || uniqueNames[uniqueNames.length - 1] !== entry.teamName) {
      uniqueNames.push(entry.teamName);
    }
  }

  // If only one name in history, don't show the component
  if (uniqueNames.length <= 1) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-1 bg-navy/5 rounded-full text-sm font-body text-navy hover:bg-navy/10 transition-colors"
      >
        <span className="text-navy/50">Franchise Names</span>
        <span className="font-semibold">{uniqueNames.length}</span>
        <span className="text-navy/30 text-xs ml-0.5">{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-10 bg-white rounded-lg border border-navy/10 shadow-lg p-3 min-w-[220px]">
          <ul className="space-y-1.5">
            {uniqueNames.map((name, i) => (
              <li key={i} className="text-sm font-body text-navy">
                {strikeX(name)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
