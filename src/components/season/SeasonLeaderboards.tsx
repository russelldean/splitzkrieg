'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SeasonLeaderEntry } from '@/lib/queries';

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
  hcpEligibleIDs: Set<number>;
  minGames?: number;
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
}: {
  entries: SeasonLeaderEntry[];
  highlightIDs?: Set<number>;
  highlightLabel?: string;
  showHighlight?: boolean;
  isAverage?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <p className="font-body text-sm text-navy/40 italic py-2">
        No data for this category.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm font-body">
        <thead>
          <tr className="border-b border-navy/10 text-navy/50 text-xs uppercase tracking-wider">
            <th className="px-4 py-2 text-left w-12">#</th>
            <th className="px-4 py-2 text-left">Bowler</th>
            <th className="px-4 py-2 text-left">Team</th>
            <th className="px-4 py-2 text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => {
            const isHighlighted = showHighlight && (highlightIDs?.has(entry.bowlerID) ?? false);
            return (
              <tr
                key={`${entry.bowlerID}-${i}`}
                className={`border-b border-navy/5 hover:bg-navy/[0.02] transition-colors ${
                  isHighlighted ? 'bg-amber-100/70 border-l-2 border-l-amber-400' : ''
                }`}
              >
                <td className="px-4 py-2 text-navy/40 tabular-nums">
                  {i + 1}
                </td>
                <td className={`px-4 py-2 ${isHighlighted ? 'font-bold' : 'font-medium'}`}>
                  <Link
                    href={`/bowler/${entry.slug}`}
                    className="text-navy hover:text-red-600 transition-colors"
                  >
                    {entry.bowlerName}
                  </Link>
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
      {showHighlight && highlightLabel && (
        <p className="text-xs font-body text-navy/40 mt-1 px-4 flex items-center gap-1.5">
          <span className="inline-block w-3 h-2 bg-amber-100 border-l-2 border-l-amber-400 rounded-sm" />
          {highlightLabel}
        </p>
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
  hcpEligibleIDs,
  minGames,
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
    handicap: { ids: hcpEligibleIDs, label: 'Handicap playoff eligible (not in top 8 men\'s or women\'s scratch)' },
  };

  const categories = tabContent[activeTab];
  const allEmpty = categories.every(c => c.entries.length === 0);
  const highlight = highlightMap[activeTab];

  return (
    <section id="leaderboards">
      <h2 className="font-heading text-2xl text-navy mb-1">Leaderboards</h2>
      {minGames && (
        <p className="font-body text-xs text-navy/40 mb-4">
          Minimum {minGames} games bowled to qualify for average rankings
        </p>
      )}

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
        <p className="font-body text-sm text-navy/40 italic">No data for this category.</p>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const isAvgCategory = /average/i.test(cat.title) || /avg/i.test(cat.title);
            return (
              <div key={cat.title}>
                <h4 className="font-body text-sm font-semibold text-navy/50 uppercase tracking-wider mb-2">
                  {cat.title}
                </h4>
                <LeaderboardTable
                  entries={cat.entries}
                  highlightIDs={highlight.ids}
                  highlightLabel={highlight.label}
                  showHighlight={isAvgCategory || activeTab === 'handicap'}
                  isAverage={isAvgCategory}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
