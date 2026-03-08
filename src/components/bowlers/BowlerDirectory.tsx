'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { DirectoryBowler } from '@/lib/queries';

function groupByLetter(bowlers: DirectoryBowler[]) {
  return bowlers.reduce<Record<string, DirectoryBowler[]>>((groups, bowler) => {
    const letter = bowler.bowlerName[0].toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(bowler);
    return groups;
  }, {});
}

export function BowlerDirectory({ bowlers }: { bowlers: DirectoryBowler[] }) {
  const searchParams = useSearchParams();
  const [showCurrent, setShowCurrent] = useState(searchParams.get('filter') === 'current');
  const filtered = showCurrent ? bowlers.filter(b => b.isActive) : bowlers;
  const grouped = groupByLetter(filtered);
  const letters = Object.keys(grouped).sort();

  return (
    <>
      <div className="mb-8">
        <h1 className="font-heading text-3xl sm:text-4xl text-navy">
          {showCurrent ? 'Current Bowlers' : 'All Bowlers'}
        </h1>
        <p className="font-body text-navy/65 mt-2">
          {filtered.length} bowlers{!showCurrent && <> across {new Date().getFullYear() - 2007} years of Splitzkrieg history</>}
        </p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => setShowCurrent(true)}
            className={`text-sm font-body transition-colors ${showCurrent ? 'text-navy font-semibold' : 'text-navy/40 hover:text-red-600'}`}
          >
            Current
          </button>
          <span className="text-navy/20">|</span>
          <button
            onClick={() => setShowCurrent(false)}
            className={`text-sm font-body transition-colors ${!showCurrent ? 'text-navy font-semibold' : 'text-navy/40 hover:text-red-600'}`}
          >
            All Bowlers
          </button>
        </div>
      </div>

      {/* Letter jump nav */}
      <nav className="flex flex-wrap gap-1 mb-10 bg-white rounded-xl border border-navy/8 px-3 py-2.5" aria-label="Jump to letter">
        {letters.map((letter) => (
          <a
            key={letter}
            href={`#letter-${letter}`}
            className="w-8 h-8 flex items-center justify-center rounded-lg font-heading text-sm text-navy/60 hover:text-navy hover:bg-navy/[0.06] transition-colors"
          >
            {letter}
          </a>
        ))}
      </nav>

      <div className="space-y-6">
        {letters.map((letter) => (
          <section
            key={letter}
            id={`letter-${letter}`}
            className="bg-white rounded-xl border border-navy/8 overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-navy/6 bg-navy/[0.02]">
              <h2 className="font-heading text-xl text-navy">
                {letter}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-0.5 px-5 py-3">
              {grouped[letter].map((bowler) => (
                <div key={bowler.bowlerID} className="flex items-center gap-2 py-1.5">
                  <Link
                    href={`/bowler/${bowler.slug}`}
                    className="font-body text-navy hover:text-red-600 transition-colors truncate"
                  >
                    {bowler.bowlerName}
                  </Link>
                  {bowler.isActive && (
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0"
                      title="Active bowler"
                    />
                  )}
                  <span className="text-navy/50 text-xs flex-shrink-0">
                    {bowler.seasonsActive}s
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
