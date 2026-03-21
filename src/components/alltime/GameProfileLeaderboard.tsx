'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { GameProfileRow } from '@/lib/queries/alltime';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface Props {
  title: string;
  subtitle: string;
  bowlers: GameProfileRow[];
  sortLabel: string;
  invertSkew?: boolean;
  note?: string;
  globalMaxPct: number;
}

const INITIAL_SHOW = 10;


export function GameProfileLeaderboard({ title, subtitle, bowlers, sortLabel, invertSkew, note, globalMaxPct }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? bowlers : bowlers.slice(0, INITIAL_SHOW);

  return (
    <section>
      <div className="mb-4">
        <h2 className="font-heading text-2xl text-navy">
          <span className="inline-flex items-center gap-2">
            {title}
            <span className="text-sm font-body font-normal text-navy/65">
              {bowlers.length} bowler{bowlers.length !== 1 ? 's' : ''}
            </span>
          </span>
        </h2>
        <p className="font-body text-sm text-navy/65 mt-0.5">{subtitle}</p>
        <span className="block w-10 h-0.5 bg-red-600/40 mt-1.5" />
      </div>
      <p className="font-body text-xs text-navy/60 -mt-2 mb-4">Bowlers with 27+ games</p>
      {note && <p className="font-body text-xs text-navy/65 -mt-1 mb-4 italic">{note}</p>}

      <div className="bg-white rounded-lg border border-navy/10 overflow-hidden">
        {/* Header */}
        <div className="hidden sm:grid grid-cols-[2.5rem_1fr_4.5rem_4.5rem_4.5rem_4rem] gap-x-2 px-4 py-2 border-b border-navy/10 text-xs text-navy/65 font-body">
          <span className="text-right">#</span>
          <span>Bowler</span>
          <span className="text-right"><span className="font-semibold">G1</span> v. avg</span>
          <span className="text-right"><span className="font-semibold">G2</span> v. avg</span>
          <span className="text-right"><span className="font-semibold">G3</span> v. avg</span>
          <span className="text-right">Games</span>
        </div>

        {/* Rows */}
        {visible.map((b, i) => {
          const pcts = [b.avg1, b.avg2, b.avg3].map(v => ((v / b.overallAvg) - 1) * 100);
          return (
            <div
              key={b.slug}
              className="grid grid-cols-[2.5rem_1fr_4.5rem_4.5rem_4.5rem_4rem] gap-x-2 px-4 py-2.5 border-b border-navy/5 last:border-b-0 items-center hover:bg-navy/[0.02] transition-colors"
            >
              <span className="text-right text-sm text-navy/60 font-body tabular-nums">{i + 1}</span>
              <Link
                href={`/bowler/${b.slug}`}
                className="text-navy font-medium text-sm hover:text-red-600 transition-colors truncate"
              >
                {b.bowlerName}
              </Link>
              {pcts.map((pct, gi) => {
                const isBest = (gi + 1) === b.bestGame && !invertSkew;
                return (
                  <span key={gi} className={`text-right font-body tabular-nums ${isBest ? 'text-navy font-semibold' : 'text-navy/60'}`}>
                    <span className={`text-sm ${pct >= 0 ? 'text-green-700' : 'text-red-600'} ${isBest ? 'font-semibold' : ''}`}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                    </span>
                    <span className="block text-[10px] text-navy/70">{[b.avg1, b.avg2, b.avg3][gi].toFixed(1)}</span>
                  </span>
                );
              })}
              <span className="text-right text-sm text-navy/65 font-body tabular-nums">{b.games}</span>
            </div>
          );
        })}
      </div>

      {bowlers.length > INITIAL_SHOW && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-sm text-red-600 hover:text-red-700 font-body cursor-pointer"
        >
          {expanded ? 'Show less' : `Show all ${bowlers.length} qualifying ${title}`}
        </button>
      )}
    </section>
  );
}
