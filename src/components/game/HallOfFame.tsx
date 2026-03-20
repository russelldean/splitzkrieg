'use client';

import { useState, useEffect } from 'react';

interface Winner {
  name: string;
  wonAt: string;
  attemptCount: number;
}

interface HallOfFameProps {
  onBack: () => void;
}

export function HallOfFame({ onBack }: HallOfFameProps) {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/game/hall-of-fame')
      .then(res => res.json())
      .then((data: Winner[]) => {
        setWinners(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-amber-500/30 bg-[#1a1a2e] p-6 shadow-2xl shadow-amber-500/10">
        {/* Heading */}
        <h2 className="mb-1 text-center text-2xl font-black tracking-tight text-amber-400">
          Hall of Fame
        </h2>

        {loading ? (
          <p className="py-8 text-center text-sm text-white/40">Loading...</p>
        ) : winners.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/50">
            No one has ever hit the 10 pin. Be the first.
          </p>
        ) : (
          <>
            <p className="mb-4 text-center text-xs text-white/40">
              {winners.length === 1
                ? '1 human has hit the 10 pin'
                : `1 of ${winners.length} humans to ever hit the 10 pin`}
            </p>
            <ul className="mb-4 max-h-60 space-y-2 overflow-y-auto">
              {winners.map((winner, i) => (
                <li
                  key={`${winner.name}-${winner.wonAt}-${i}`}
                  className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2"
                >
                  <span className="text-sm font-bold text-amber-400/60">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-medium text-white/90">
                      {winner.name}
                    </span>
                    <span className="block text-xs text-white/40">
                      {winner.attemptCount} attempts &middot; {formatDate(winner.wonAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <button
          onClick={onBack}
          className="w-full rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white active:bg-white/10"
        >
          Back to Game
        </button>
      </div>
    </div>
  );
}
