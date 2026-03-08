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

      <nav className="flex flex-wrap gap-1.5 mb-10" aria-label="Jump to letter">
        {letters.map((letter) => (
          <a
            key={letter}
            href={`#letter-${letter}`}
            className="w-8 h-8 flex items-center justify-center rounded font-heading text-sm text-navy/70 hover:text-navy hover:bg-navy/5 transition-colors"
          >
            {letter}
          </a>
        ))}
      </nav>

      <div className="space-y-10">
        {letters.map((letter) => (
          <section key={letter} id={`letter-${letter}`}>
            <h2 className="font-heading text-2xl text-navy border-b border-navy/10 pb-2 mb-4">
              {letter}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2">
              {grouped[letter].map((bowler) => (
                <div key={bowler.bowlerID} className="flex items-center gap-2 py-1">
                  <Link
                    href={`/bowler/${bowler.slug}`}
                    className="font-body text-navy hover:text-red transition-colors truncate"
                  >
                    {bowler.bowlerName}
                  </Link>
                  {bowler.isActive && (
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0"
                      title="Active bowler"
                    />
                  )}
                  <span className="text-navy/65 text-xs flex-shrink-0">
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
