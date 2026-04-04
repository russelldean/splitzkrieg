'use client';

/**
 * MiniHeatCheck — compact emoji + label display for the home page.
 * Shows the tier emoji, +/- value, tier label, and small stats.
 * No thermometer bar — the emoji is the graphic.
 */

interface Props {
  pinsOverPerGame: number;
  leagueAvg: number;
  expectedAvg: number;
  bowlerCount: number;
}

interface TierDef {
  label: string;
  emoji: string;
  min: number;
  textColor: string;
}

const TIERS: TierDef[] = [
  { label: 'Scorching', emoji: '🌋', min: 5,    textColor: '#DC2626' },
  { label: 'Hot',       emoji: '🌶️', min: 3,    textColor: '#EA580C' },
  { label: 'Toasty',    emoji: '🌴', min: 1.5,  textColor: '#D97706' },
  { label: 'Mild',      emoji: '🌤️', min: 0,    textColor: '#B45309' },
  { label: 'Breezy',    emoji: '💨', min: -1,   textColor: '#2563EB' },
  { label: 'Cool',      emoji: '🧥', min: -2.5, textColor: '#1D4ED8' },
  { label: 'Frigid',    emoji: '🥶', min: -4,   textColor: '#1E40AF' },
  { label: 'Frozen',    emoji: '⛄',  min: -Infinity, textColor: '#1E3A8A' },
];

function getTier(val: number): TierDef {
  for (const t of TIERS) {
    if (val >= t.min) return t;
  }
  return TIERS[TIERS.length - 1];
}

export function MiniHeatCheck({ pinsOverPerGame, leagueAvg, expectedAvg, bowlerCount }: Props) {
  const tier = getTier(pinsOverPerGame);
  const sign = pinsOverPerGame >= 0 ? '+' : '';

  return (
    <div className="flex items-center gap-3">
      {/* Emoji */}
      <span className="text-4xl sm:text-5xl leading-none">{tier.emoji}</span>

      {/* Text */}
      <div className="flex flex-col">
        <div className="font-heading text-2xl sm:text-3xl tabular-nums leading-none" style={{ color: tier.textColor }}>
          {sign}{pinsOverPerGame.toFixed(1)}
        </div>
        <div
          className="text-xs font-body font-semibold uppercase tracking-wide mt-0.5"
          style={{ color: tier.textColor }}
        >
          {tier.label}
        </div>
        <div className="text-xs font-body text-navy/60 mt-1 sm:mt-1.5 leading-tight">
          {leagueAvg.toFixed(1)} avg / {expectedAvg.toFixed(1)} exp
        </div>
        <div className="text-xs font-body text-navy/60 leading-tight">
          {bowlerCount} bowlers
        </div>
      </div>
    </div>
  );
}
