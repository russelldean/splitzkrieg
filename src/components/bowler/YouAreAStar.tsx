'use client';
import { useState } from 'react';
import type { BowlerStarStats } from '@/lib/queries';

interface Props {
  stats: BowlerStarStats;
  inTicker: boolean;
}

interface StarLine {
  patch?: string;
  label: string;
  value: string;
  hint?: string;
}

const PATCH_STYLE: Record<string, { abbr: string; color: string; bg: string }> = {
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

export function YouAreAStar({ stats, inTicker }: Props) {
  const [open, setOpen] = useState(false);

  const lines: StarLine[] = [];

  if (stats.championships > 0) {
    lines.push({
      patch: 'champion',
      label: 'Championships',
      value: String(stats.championships),
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
      label: 'Featured on Home Page',
      value: 'Now',
      hint: 'Home',
    });
  }

  // Nothing to show
  if (lines.length === 0) return null;

  const totalStars = lines.length;

  return (
    <section>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between group cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-2xl text-navy">You Are a Star</h2>
          <span className="text-sm text-navy/50 font-medium">
            {totalStars} {totalStars === 1 ? 'highlight' : 'highlights'}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-navy/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
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
        <div className="mt-4 bg-white rounded-lg border border-navy/10 divide-y divide-navy/5">
          {lines.map((line) => (
            <div key={line.label} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                {line.patch && PATCH_STYLE[line.patch] && (
                  <span className={`inline-flex items-center text-[10px] font-semibold font-body px-1.5 py-0.5 rounded-full leading-none ${PATCH_STYLE[line.patch].color} ${PATCH_STYLE[line.patch].bg}`}>
                    {PATCH_STYLE[line.patch].abbr}
                  </span>
                )}
                <span className="text-navy font-medium">{line.label}</span>
              </div>
              <span className="font-heading text-lg text-navy tabular-nums">{line.value}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
