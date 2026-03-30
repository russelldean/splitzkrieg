'use client';

/**
 * League Heat Check — a thermometer graphic showing how the league
 * bowled relative to their averages for a given week.
 *
 * Visual range is based on the historical distribution (P5-P95),
 * so the bar uses its full travel for real-world values. Outliers
 * pin to the edges.
 *
 * Scale (asymmetric):
 *   Scorching  +5.0 and up     🌋  (top 5% of weeks)
 *   Hot        +3.0 to +5.0    🌶️  (next 10%)
 *   Toasty     +1.5 to +3.0    🌴  (next 20%)
 *   Mild        0.0 to +1.5    ☕  (25% -- the "normal" zone)
 *   Breezy     -1.0 to  0.0    💨  (10%)
 *   Cool       -2.5 to -1.0    🧥  (15%)
 *   Frigid     -4.0 to -2.5    🥶  (6%)
 *   Frozen     below -4.0      ⛄  (bottom 3%)
 */

interface Props {
  pinsOverPerGame: number;
  leagueAvg: number;
  expectedAvg: number;
}

interface TierDef {
  key: string;
  label: string;
  emoji: string;
  min: number;
  max: number;
  color: string;
  bgColor: string;
  textColor: string;
}

const TIERS: TierDef[] = [
  { key: 'scorching', label: 'Scorching', emoji: '🌋', min: 5,    max: 6,    color: '#DC2626', bgColor: '#DC26261A', textColor: '#DC2626' },
  { key: 'hot',       label: 'Hot',       emoji: '🌶️', min: 3,    max: 5,    color: '#EA580C', bgColor: '#EA580C15', textColor: '#EA580C' },
  { key: 'toasty',    label: 'Toasty',    emoji: '🌴', min: 1.5,  max: 3,    color: '#F59E0B', bgColor: '#F59E0B12', textColor: '#D97706' },
  { key: 'mild',      label: 'Mild',      emoji: '🌤️', min: 0,    max: 1.5,  color: '#FBBF24', bgColor: '#FBBF2410', textColor: '#B45309' },
  { key: 'breezy',    label: 'Breezy',    emoji: '💨', min: -1,   max: 0,    color: '#93C5FD', bgColor: '#93C5FD12', textColor: '#2563EB' },
  { key: 'cool',      label: 'Cool',      emoji: '🧥', min: -2.5, max: -1,   color: '#60A5FA', bgColor: '#60A5FA15', textColor: '#1D4ED8' },
  { key: 'frigid',    label: 'Frigid',    emoji: '🥶', min: -4,   max: -2.5, color: '#3B82F6', bgColor: '#3B82F618', textColor: '#1E40AF' },
  { key: 'frozen',    label: 'Frozen',    emoji: '⛄', min: -5,   max: -4,   color: '#1E3A8A', bgColor: '#1E3A8A1A', textColor: '#1E3A8A' },
];

const RANGE_MIN = -5;
const RANGE_MAX = 6;
const FULL_RANGE = RANGE_MAX - RANGE_MIN;

function toPercent(val: number): number {
  return ((Math.max(RANGE_MIN, Math.min(RANGE_MAX, val)) - RANGE_MIN) / FULL_RANGE) * 100;
}

function getTier(val: number): TierDef {
  for (const t of TIERS) {
    if (val >= t.min) return t;
  }
  return TIERS[TIERS.length - 1];
}

export function LeagueHeatCheck({ pinsOverPerGame, leagueAvg, expectedAvg }: Props) {
  const tier = getTier(pinsOverPerGame);
  const needlePos = toPercent(pinsOverPerGame);
  const zeroPos = toPercent(0);

  const fillLeft = Math.min(zeroPos, needlePos);
  const fillWidth = Math.abs(needlePos - zeroPos);

  return (
    <div className="bg-white border border-navy/10 rounded-lg px-4 py-3 shadow-sm">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs font-heading text-navy/60 uppercase tracking-wider">League Heat Check</div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-heading text-lg tabular-nums" style={{ color: tier.textColor }}>
            {pinsOverPerGame >= 0 ? '+' : ''}{pinsOverPerGame.toFixed(1)}
          </span>
          <span className="text-xs font-body text-navy/60">pins/game</span>
        </div>
      </div>

      {/* Tier badge with emoji */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-heading font-bold tracking-wide uppercase"
          style={{ backgroundColor: tier.bgColor, color: tier.textColor }}
        >
          <span className="text-sm">{tier.emoji}</span>
          {tier.label}
        </span>
        <span className="text-xs font-body text-navy/50">
          {leagueAvg.toFixed(1)} avg vs {expectedAvg.toFixed(1)} expected
        </span>
      </div>

      {/* Thermometer bar + needle wrapper */}
      <div className="relative h-5">
        {/* Bar track */}
        <div className="absolute inset-0 rounded-full overflow-hidden border border-navy/[0.06]">
          {/* Fixed gradient -- light at zero, blue left, red right */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg, #1E3A8A 0%, #3B82F6 15%, #60A5FA 28%, #93C5FD ${zeroPos}%, #FBBF24 60%, #F59E0B 72%, #EA580C 85%, #DC2626 100%)`,
            }}
          />

          {/* Mask: covers everything right of the needle (positive) or left of it (negative from zero) */}
          {/* Left mask -- from 0 to fillLeft */}
          <div
            className="absolute inset-y-0 left-0 z-10"
            style={{
              width: `${fillLeft}%`,
              backgroundColor: '#F5F2EC',
            }}
          />
          {/* Right mask -- from fillLeft + fillWidth to end */}
          <div
            className="absolute inset-y-0 right-0 z-10"
            style={{
              width: `${100 - fillLeft - fillWidth}%`,
              backgroundColor: '#F5F2EC',
            }}
          />

          {/* Zero line */}
          <div
            className="absolute inset-y-0 w-px bg-navy/20 z-20"
            style={{ left: `${zeroPos}%` }}
          />
        </div>

        {/* Needle -- outside overflow-hidden so it's never clipped */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20"
          style={{ left: `${needlePos}%` }}
        >
          <div
            className="w-5 h-5 rounded-full border-2 border-white shadow-md"
            style={{ backgroundColor: tier.color }}
          />
        </div>
      </div>

      {/* Scale labels */}
      <div className="relative h-4 mt-1 text-[10px] font-body text-navy/40">
        <span className="absolute left-0">⛄ Frozen</span>
        <span
          className="absolute -translate-x-1/2"
          style={{ left: `${zeroPos}%` }}
        >
          0
        </span>
        <span className="absolute right-0">Scorching 🌋</span>
      </div>
    </div>
  );
}
