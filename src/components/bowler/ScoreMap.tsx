'use client';

import { useState } from 'react';
import type { ScoreMapModel, ScoreCell } from '@/lib/score-map';

// Navy heat ramp (career), light -> dark. Warm ramp (this season), light -> dark.
// Provisional: re-validate against the white card on-device (spec: mobile visibility).
const NAVY = ['', '#cdd6e6', '#9fb0d0', '#6f86b6', '#3f5893', '#1B2A4A'];
const WARM = ['', '#ffe9b8', '#ffcf7a', '#f7ab3e', '#e8871a', '#c96a10'];
const GAP_BORDER = '#d99a9a';   // in-range never-rolled
const NOTYET_BORDER = '#cbd2dd'; // above max, top row

function cellStyle(c: ScoreCell): React.CSSProperties {
  if (c.count > 0) {
    return { backgroundColor: (c.thisSeason ? WARM : NAVY)[c.bin] };
  }
  if (c.aboveMax) {
    return { backgroundColor: 'transparent', border: `1px solid ${NOTYET_BORDER}` };
  }
  // in-range gap
  return { backgroundColor: 'transparent', border: `1px dashed ${GAP_BORDER}` };
}

function readoutFor(c: ScoreCell, isMost: boolean): string {
  const base = c.count > 0 ? `${c.score} · rolled ${c.count}×` : `${c.score} · never rolled`;
  return isMost ? `${base} · your most-rolled` : base;
}

export function ScoreMap({ model }: { model: ScoreMapModel }) {
  const [readout, setReadout] = useState<string>('Tap a square for its score');

  const onPick = (c: ScoreCell) => setReadout(readoutFor(c, c.score === model.mostRolled));

  return (
    <div>
      <p className="text-navy/70 text-sm mb-3">
        Your board runs from your lowest scores to your highest. Rows go by tens, the 150s, the 160s, and so on;
        read down the left for the tens, across the top for the ones. Shade is how often you have rolled that score.
        Warm squares are the ones you have hit again this season. Dashed red is a score inside your range you have
        never bowled. Tap any square for details.
      </p>

      {/* board: 1 label column + 10 score columns */}
      <div
        className="mx-auto"
        style={{
          display: 'grid',
          gridTemplateColumns: '26px repeat(10, 1fr)',
          gap: 3,
          maxWidth: 372,
        }}
      >
        {/* header row: corner + ones digits */}
        <div />
        {Array.from({ length: 10 }, (_, d) => (
          <div key={`h${d}`} className="text-navy/60 text-[10px] text-center tabular-nums pb-0.5">{d}</div>
        ))}

        {/* one row per ten */}
        {model.decades.map((d) => (
          <Row key={d} decade={d} model={model} onPick={onPick} />
        ))}
      </div>

      <div className="text-center text-navy text-sm tabular-nums mt-4 min-h-[20px]">{readout}</div>

      {model.hasPerfect && (
        <div className="flex flex-col items-center mt-6">
          <div
            className="flex flex-col items-center justify-center rounded-xl"
            style={{
              width: 66, height: 66,
              background: 'linear-gradient(155deg,#f9dd7d 0%,#e9b93f 60%,#d69f2b 100%)',
              border: '1px solid #c2911f',
              boxShadow: '0 4px 14px rgba(190,150,30,.4)',
            }}
          >
            <span className="font-bold leading-none" style={{ fontSize: 23, color: '#4a3500' }}>300</span>
            <span className="font-bold uppercase mt-0.5" style={{ fontSize: 8, letterSpacing: '.1em', color: '#6d5000' }}>perfect</span>
          </div>
        </div>
      )}

      <Legend />
    </div>
  );
}

function Row({ decade, model, onPick }: { decade: number; model: ScoreMapModel; onPick: (c: ScoreCell) => void }) {
  return (
    <>
      <div className="text-navy/60 text-[11px] flex items-center justify-end pr-1.5 tabular-nums">{decade}</div>
      {Array.from({ length: 10 }, (_, one) => {
        const c = model.cells[decade + one];
        const isMost = c.score === model.mostRolled;
        return (
          <button
            key={c.score}
            type="button"
            aria-label={readoutFor(c, isMost)}
            onClick={() => onPick(c)}
            onMouseEnter={() => onPick(c)}
            onFocus={() => onPick(c)}
            className="relative rounded-[3px]"
            style={{ aspectRatio: '1 / 1', ...cellStyle(c) }}
          >
            {isMost && (
              <span
                className="absolute inset-0 flex items-center justify-center leading-none pointer-events-none"
                style={{
                  fontSize: 14,
                  color: '#ffcf33',
                  WebkitTextStroke: '.9px #111',
                  paintOrder: 'stroke fill' as React.CSSProperties['paintOrder'],
                }}
              >
                {'★'}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}

function Legend() {
  const swatch = (style: React.CSSProperties, key: string) => (
    <span key={key} className="inline-block rounded-[3px]" style={{ width: 12, height: 12, ...style }} />
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-navy/70 text-xs mt-4">
      <span className="inline-flex items-center gap-1.5">
        {swatch({ border: `1px dashed ${GAP_BORDER}` }, 'gap')} gap in range
      </span>
      <span className="inline-flex items-center gap-1.5">
        {swatch({ backgroundColor: NAVY[5] }, 'most')} most-rolled has a star
      </span>
      <span className="inline-flex items-center gap-1.5">
        career
        {[1, 2, 3, 4, 5].map((b) => swatch({ backgroundColor: NAVY[b] }, `career${b}`))}
      </span>
      <span className="inline-flex items-center gap-1.5">
        this season
        {[1, 2, 3, 4, 5].map((b) => swatch({ backgroundColor: WARM[b] }, `season${b}`))}
      </span>
    </div>
  );
}
