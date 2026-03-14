'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SeasonLeaderEntry, SeasonIndividualChampions } from '@/lib/queries';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface LeaderboardCategory {
  title: string;
  entries: SeasonLeaderEntry[];
}

interface Props {
  mensScratch: LeaderboardCategory[];
  womensScratch: LeaderboardCategory[];
  handicap: LeaderboardCategory[];
  mensScratchPlayoffIDs: Set<number>;
  womensScratchPlayoffIDs: Set<number>;
  hcpPlayoffIDs: Set<number>;
  hcpIneligibleIDs: Set<number>;
  minGames?: number;
  champions: SeasonIndividualChampions | null;
}

type TabKey = 'mens' | 'womens' | 'handicap';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'mens', label: "Men's" },
  { key: 'womens', label: "Women's" },
  { key: 'handicap', label: 'Handicap' },
];

function LeaderboardTable({
  entries,
  highlightIDs,
  highlightLabel,
  showHighlight = true,
  isAverage = false,
  ineligibleIDs,
  ineligibleLabel,
  championID,
  championLabel,
}: {
  entries: SeasonLeaderEntry[];
  highlightIDs?: Set<number>;
  highlightLabel?: string;
  showHighlight?: boolean;
  isAverage?: boolean;
  ineligibleIDs?: Set<number>;
  ineligibleLabel?: string;
  championID?: number | null;
  championLabel?: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="font-body text-sm text-navy/70 italic py-2">
        No data for this category.
      </p>
    );
  }

  return (
    <div className="bg-white border border-navy/10 rounded-lg shadow-sm overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm sm:text-base font-body">
        <thead>
          <tr className="border-b border-navy/10 bg-navy/[0.02] text-navy/60 text-xs sm:text-sm uppercase tracking-wider">
            <th className="px-4 py-2 text-left w-12">#</th>
            <th className="px-4 py-2 text-left">Bowler</th>
            <th className="px-4 py-2 text-left">Team</th>
            <th className="px-4 py-2 text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => {
            const isHighlighted = showHighlight && (highlightIDs?.has(entry.bowlerID) ?? false);
            const isIneligible = ineligibleIDs?.has(entry.bowlerID) ?? false;
            const isChampion = championID != null && entry.bowlerID === championID;
            return (
              <tr
                key={`${entry.bowlerID}-${i}`}
                className={`border-b border-navy/5 hover:bg-navy/[0.05] transition-colors ${
                  isHighlighted ? 'bg-amber-100/70 border-l-2 border-l-amber-400' : ''
                } ${isIneligible ? 'opacity-40' : ''} ${isChampion ? 'font-bold' : ''}`}
              >
                <td className="px-4 py-2 text-navy/65 tabular-nums">
                  {i + 1}
                </td>
                <td className={`px-4 py-2 ${isHighlighted || isChampion ? 'font-bold' : 'font-medium'}`}>
                  <Link
                    href={`/bowler/${entry.slug}`}
                    className="text-navy hover:text-red-600 transition-colors"
                  >
                    {entry.bowlerName}
                  </Link>
                  {isChampion && championLabel && (
                    <span className="relative ml-1.5 cursor-default group/trophy">
                      <span className="text-amber-500">&#x1F3C6;</span>
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs font-normal text-white bg-navy rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/trophy:opacity-100 transition-opacity z-50">
                        {championLabel}
                      </span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-navy/60">
                  {entry.teamSlug ? (
                    <Link
                      href={`/team/${entry.teamSlug}`}
                      className="hover:text-red-600 transition-colors"
                    >
                      {entry.teamName ?? '\u2014'}
                    </Link>
                  ) : (
                    <span>{entry.teamName ?? '\u2014'}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold text-navy">
                  {typeof entry.value === 'number'
                    ? isAverage
                      ? entry.value.toFixed(1)
                      : Number.isInteger(entry.value)
                        ? entry.value.toLocaleString()
                        : entry.value.toFixed(1)
                    : '\u2014'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {(showHighlight && highlightLabel || ineligibleLabel) && (
        <div className="mt-1 px-4 space-y-0.5">
          {showHighlight && highlightLabel && (
            <p className="text-xs font-body text-navy/70 flex items-center gap-1.5">
              <span className="inline-block w-3 h-2 bg-amber-100 border-l-2 border-l-amber-400 rounded-sm" />
              {highlightLabel}
            </p>
          )}
          {ineligibleLabel && (
            <p className="text-xs font-body text-navy/70 flex items-center gap-1.5">
              <span className="inline-block w-3 h-2 bg-navy/5 rounded-sm opacity-40" />
              {ineligibleLabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function SeasonLeaderboards({
  mensScratch,
  womensScratch,
  handicap,
  mensScratchPlayoffIDs,
  womensScratchPlayoffIDs,
  hcpPlayoffIDs,
  hcpIneligibleIDs,
  minGames,
  champions,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('mens');

  const tabContent: Record<TabKey, LeaderboardCategory[]> = {
    mens: mensScratch,
    womens: womensScratch,
    handicap,
  };

  const highlightMap: Record<TabKey, { ids: Set<number>; label: string }> = {
    mens: { ids: mensScratchPlayoffIDs, label: 'Playoff position (top 8)' },
    womens: { ids: womensScratchPlayoffIDs, label: 'Playoff position (top 8)' },
    handicap: { ids: hcpPlayoffIDs, label: 'Playoff position (top 8)' },
  };

  const ineligibleMap: Record<TabKey, { ids: Set<number>; label: string } | null> = {
    mens: null,
    womens: null,
    handicap: { ids: hcpIneligibleIDs, label: 'Bowlers in scratch playoffs ineligible for handicap playoffs' },
  };

  const championMap: Record<TabKey, { id: number | null; label: string }> = {
    mens: { id: champions?.mensScratchBowlerID ?? null, label: "Men's Scratch Champion" },
    womens: { id: champions?.womensScratchBowlerID ?? null, label: "Women's Scratch Champion" },
    handicap: { id: champions?.handicapBowlerID ?? null, label: 'Handicap Champion' },
  };

  const categories = tabContent[activeTab];
  const allEmpty = categories.every(c => c.entries.length === 0);
  const highlight = highlightMap[activeTab];
  const ineligible = ineligibleMap[activeTab];
  const champion = championMap[activeTab];

  return (
    <section id="leaderboards">
      <SectionHeading>Leaderboards</SectionHeading>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-body rounded-t transition-colors ${
              activeTab === tab.key
                ? 'bg-navy text-cream font-semibold'
                : 'bg-navy/5 text-navy/60 hover:bg-navy/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {allEmpty ? (
        <p className="font-body text-sm text-navy/70 italic">No data for this category.</p>
      ) : (
        <div className="space-y-6">
          {categories.map((cat, i) => {
            const isAvgCategory = /average/i.test(cat.title) || /avg/i.test(cat.title);
            const nextCat = categories[i + 1];
            const isLastAvgBeforeNonAvg = isAvgCategory && (!nextCat || !(/average/i.test(nextCat.title) || /avg/i.test(nextCat.title)));
            return (
              <div key={cat.title}>
                <h4 className="font-body text-sm font-semibold text-navy/60 uppercase tracking-wider mb-1">
                  {cat.title}
                </h4>
                {minGames && isAvgCategory && (
                  <p className="font-body text-xs text-navy/60 mb-2">
                    ({minGames} min games)
                  </p>
                )}
                <LeaderboardTable
                  entries={cat.entries}
                  highlightIDs={highlight.ids}
                  highlightLabel={highlight.label}
                  showHighlight={isAvgCategory || activeTab === 'handicap'}
                  isAverage={isAvgCategory}
                  ineligibleIDs={ineligible?.ids}
                  ineligibleLabel={ineligible?.label}
                  championID={champion.id}
                  championLabel={champion.label}
                />
                {isLastAvgBeforeNonAvg && (
                  <p className="font-body text-xs text-navy/60 mt-4">
                    To qualify for the individual playoffs, bowlers must bowl 18 games in the season.
                    To qualify for team playoffs, bowlers must bowl 9 games with the team.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
