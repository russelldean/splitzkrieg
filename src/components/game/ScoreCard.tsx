'use client';

import { CHEAT_POOL } from './cheats/index';

interface ScoreCardProps {
  attemptCount: number;
  cheatsEncountered: string[];
  onPlayAgain: () => void;
  onViewHallOfFame: () => void;
}

export function ScoreCard({ attemptCount, cheatsEncountered, onPlayAgain, onViewHallOfFame }: ScoreCardProps) {
  // Deduplicate cheats and count occurrences
  const cheatCounts = new Map<string, number>();
  for (const id of cheatsEncountered) {
    cheatCounts.set(id, (cheatCounts.get(id) || 0) + 1);
  }

  const uniqueCheats = Array.from(cheatCounts.entries()).map(([id, count]) => {
    const cheat = CHEAT_POOL.find(c => c.id === id);
    return {
      id,
      name: cheat?.name ?? id,
      caption: cheat?.caption ?? '',
      count,
    };
  });

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-sm rounded-2xl border border-amber-500/30 bg-[#1a1a2e] p-6 shadow-2xl shadow-amber-500/10"
      >
        {/* Branding */}
        <div className="mb-1 text-center text-xs tracking-widest text-amber-400/60 uppercase">
          Splitzkrieg
        </div>
        <div className="mb-4 text-center text-[10px] tracking-wider text-amber-400/40 uppercase">
          Hit the 10 Pin
        </div>

        {/* Game Over */}
        <h2 className="mb-4 text-center text-3xl font-black tracking-tight text-white">
          GAME OVER
        </h2>

        {/* Attempt count */}
        <p className="mb-5 text-center text-lg text-cream-100/90">
          You survived <span className="font-bold text-amber-400">{attemptCount}</span> attempts
        </p>

        {/* Cheats encountered */}
        {uniqueCheats.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-center text-sm font-semibold text-white/70">
              Cheats you encountered:
            </p>
            <ul className="space-y-1 text-sm">
              {uniqueCheats.map(cheat => (
                <li key={cheat.id} className="flex items-start gap-2 text-white/80">
                  <span className="mt-0.5 text-amber-400">&#x2022;</span>
                  <span>
                    <span className="font-medium text-white/90">{cheat.name}</span>
                    {cheat.count > 1 && (
                      <span className="ml-1 text-amber-400/70">x{cheat.count}</span>
                    )}
                    {cheat.caption && (
                      <span className="ml-1 text-white/50 italic">&quot;{cheat.caption}&quot;</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Screenshot prompt */}
        <p className="mb-6 text-center text-xs text-white/40">
          Screenshot this and share!
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onPlayAgain}
            className="w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold text-[#1a1a2e] transition-colors hover:bg-amber-400 active:bg-amber-600"
          >
            Play Again
          </button>
          <button
            onClick={onViewHallOfFame}
            className="w-full rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white active:bg-white/10"
          >
            Hall of Fame
          </button>
        </div>
      </div>
    </div>
  );
}
