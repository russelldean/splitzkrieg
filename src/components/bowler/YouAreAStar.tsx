'use client';
import { useState } from 'react';
import Image from 'next/image';
import type { BowlerStarStats } from '@/lib/queries';

interface Props {
  stats: BowlerStarStats;
  inTicker: boolean;
  slug?: string;
  easterEgg?: { src: string; alt: string; width: number; height: number };
}

interface StarLine {
  patch?: string;
  label: string;
  value: string;
  renderValue?: React.ReactNode;
  hint?: string;
}

const PATCH_STYLE: Record<string, { abbr: string; color: string; bg: string }> = {
  perfectGame:    { abbr: '300', color: 'text-amber-800',   bg: 'bg-amber-200' },
  champion:       { abbr: '\uD83C\uDFC6', color: 'text-amber-700',   bg: 'bg-amber-100' },
  playoff:        { abbr: 'TP',   color: 'text-indigo-700', bg: 'bg-indigo-100' },
  scratchPlayoff: { abbr: 'SP',   color: 'text-rose-700',   bg: 'bg-rose-100' },
  hcpPlayoff:     { abbr: 'HP',   color: 'text-orange-700', bg: 'bg-orange-100' },
  botw:           { abbr: 'BOTW', color: 'text-purple-700', bg: 'bg-purple-100' },
  highGame:       { abbr: 'HG',   color: 'text-blue-700',   bg: 'bg-blue-100' },
  highSeries:     { abbr: 'HS',   color: 'text-emerald-700', bg: 'bg-emerald-100' },
  aboveAvg:        { abbr: '3/3',  color: 'text-teal-700',    bg: 'bg-teal-100' },
  threeOfAKind:    { abbr: '3K',   color: 'text-pink-700',    bg: 'bg-pink-100' },
  scratchChampion: { abbr: 'SC',   color: 'text-rose-700',    bg: 'bg-rose-200' },
  hcpChampion:     { abbr: 'HC',   color: 'text-orange-700',  bg: 'bg-orange-200' },
};

/** Mini $2 bill rendered inline */
function TwoDollarBill() {
  return (
    <Image
      src="/two-dollar-bill.png"
      alt="$2 bill"
      width={524}
      height={222}
      className="rounded-sm shadow-sm"
      style={{ width: 90, height: 'auto' }}
    />
  );
}

/** Dollar coin images for Jon Hunt's "1" values */
const DOLLAR_COINS = [
  { src: '/sacagawea-dollar.png', alt: 'Sacagawea dollar', size: 316 },
  { src: '/susan-b-anthony-dollar.png', alt: 'Susan B. Anthony dollar', size: 1280 },
];

function DollarCoin({ index }: { index: number }) {
  const coin = DOLLAR_COINS[index % DOLLAR_COINS.length];
  return (
    <Image
      src={coin.src}
      alt={coin.alt}
      width={coin.size}
      height={coin.size}
      className="rounded-full shadow-sm"
      style={{ width: 32, height: 32 }}
    />
  );
}

function BuffaloNickel() {
  return (
    <Image
      src="/buffalo-nickel.png"
      alt="Buffalo nickel"
      width={456}
      height={456}
      className="rounded-full shadow-sm"
      style={{ width: 32, height: 32 }}
    />
  );
}

export function YouAreAStar({ stats, inTicker, slug, easterEgg }: Props) {
  const [open, setOpen] = useState(false);

  const lines: StarLine[] = [];

  if (stats.perfectGames > 0) {
    lines.push({
      patch: 'perfectGame',
      label: 'Perfect Game',
      value: `${stats.perfectGames}x`,
    });
  }

  if (stats.championships > 0) {
    lines.push({
      patch: 'champion',
      label: 'Championships',
      value: String(stats.championships),
    });
  }

  if (stats.scratchChampionships > 0) {
    lines.push({
      patch: 'scratchChampion',
      label: 'Scratch Championships',
      value: String(stats.scratchChampionships),
    });
  }

  if (stats.hcpChampionships > 0) {
    lines.push({
      patch: 'hcpChampion',
      label: 'Handicap Championships',
      value: String(stats.hcpChampionships),
    });
  }

  if (stats.playoffAppearances > 0) {
    lines.push({
      patch: 'playoff',
      label: 'Team Playoff Appearances',
      value: String(stats.playoffAppearances),
    });
  }

  if (stats.scratchPlayoffAppearances > 0) {
    lines.push({
      patch: 'scratchPlayoff',
      label: 'Scratch Playoff Appearances',
      value: String(stats.scratchPlayoffAppearances),
    });
  }

  if (stats.hcpPlayoffAppearances > 0) {
    lines.push({
      patch: 'hcpPlayoff',
      label: 'Handicap Playoff Appearances',
      value: String(stats.hcpPlayoffAppearances),
    });
  }

  if (stats.botwWins > 0) {
    lines.push({
      patch: 'botw',
      label: 'Bowler of the Week',
      value: `${stats.botwWins}x`,
    });
  }

  if (stats.weeklyHighGameWins > 0) {
    lines.push({
      patch: 'highGame',
      label: 'Weekly High Game',
      value: `${stats.weeklyHighGameWins}x`,
    });
  }

  if (stats.weeklyHighSeriesWins > 0) {
    lines.push({
      patch: 'highSeries',
      label: 'Weekly High Series',
      value: `${stats.weeklyHighSeriesWins}x`,
    });
  }

  if (stats.aboveAvgAllThreeCount > 0) {
    lines.push({
      patch: 'aboveAvg',
      label: 'Above Average All 3 Games',
      value: `${stats.aboveAvgAllThreeCount}x`,
    });
  }

  if (stats.threeOfAKindCount > 0) {
    lines.push({
      patch: 'threeOfAKind',
      label: 'Three of a Kind',
      value: `${stats.threeOfAKindCount}x`,
    });
  }

  if (stats.isCaptain) {
    lines.push({
      label: 'Team Captain',
      value: '\u2713',
      hint: 'Teams',
    });
  }

  if (inTicker) {
    lines.push({
      label: 'Featured on Ticker',
      value: 'Now',
      hint: 'Home',
    });
  }

  // Nothing to show
  if (lines.length === 0) return null;

  // EASTER EGG: Jon Hunt wacky money denominations
  const isJonHunt = slug === 'jon-hunt';

  // Jon Hunt easter egg: wacky money for stat values
  if (isJonHunt) {
    let coinIndex = 0;
    for (const line of lines) {
      if (line.value === '2') {
        line.renderValue = <TwoDollarBill />;
      } else if (line.value === '1' || line.value === '1x') {
        line.renderValue = <DollarCoin index={coinIndex} />;
        coinIndex++;
      } else if (line.value === '5' || line.value === '5x') {
        line.renderValue = <BuffaloNickel />;
      }
    }
  }

  const totalStars = lines.length;

  return (
    <section>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between group cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-2xl text-navy">You Are a Star</h2>
          <span className="text-sm text-navy/65 font-medium">
            {totalStars} {totalStars === 1 ? 'highlight' : 'highlights'}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-navy/55 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <span className="block w-10 h-0.5 bg-red-600/40 mt-1.5" />

      {open && (
        <>
          <div className="mt-4 bg-white rounded-lg border border-navy/10 divide-y divide-navy/5">
            {lines.map((line) => (
              <div key={line.label} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  {line.patch && PATCH_STYLE[line.patch] && (
                    <span className={`inline-flex items-center text-[11px] font-semibold font-body px-1.5 py-0.5 rounded-full leading-none ${PATCH_STYLE[line.patch].color} ${PATCH_STYLE[line.patch].bg}`}>
                      {PATCH_STYLE[line.patch].abbr}
                    </span>
                  )}
                  <span className="text-navy font-medium">{line.label}</span>
                </div>
                {line.renderValue
                  ? line.renderValue
                  : <span className="font-heading text-lg text-navy tabular-nums">{line.value}</span>
                }
              </div>
            ))}
          </div>
          {easterEgg && (
            <div className="mt-4 rounded-xl overflow-hidden shadow-md">
              <Image
                src={easterEgg.src}
                alt={easterEgg.alt}
                width={easterEgg.width}
                height={easterEgg.height}
                className="w-full h-auto"
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
