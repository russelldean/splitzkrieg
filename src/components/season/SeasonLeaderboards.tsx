'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SeasonLeaderEntry, SeasonRecords } from '@/lib/queries';

interface LeaderboardCategory {
  title: string;
  entries: SeasonLeaderEntry[];
}

interface Props {
  mensScratch: LeaderboardCategory[];
  womensScratch: LeaderboardCategory[];
  handicap: LeaderboardCategory[];
  records: SeasonRecords;
}

type TabKey = 'mens' | 'womens' | 'handicap';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'mens', label: "Men's" },
  { key: 'womens', label: "Women's" },
  { key: 'handicap', label: 'Handicap' },
];

function LeaderboardTable({ entries }: { entries: SeasonLeaderEntry[] }) {
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
          {entries.map((entry, i) => (
            <tr
              key={`${entry.bowlerID}-${i}`}
              className="border-b border-navy/5 hover:bg-navy/[0.02] transition-colors"
            >
              <td className="px-4 py-2 text-navy/40 tabular-nums">{i + 1}</td>
              <td className="px-4 py-2 font-medium">
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
                  ? Number.isInteger(entry.value)
                    ? entry.value.toLocaleString()
                    : entry.value.toFixed(1)
                  : '\u2014'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecordRow({
  label,
  record,
}: {
  label: string;
  record: { bowlerName: string; slug: string; value: number } | null;
}) {
  if (!record) return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-navy/5">
      <span className="font-body text-sm text-navy/60">{label}</span>
      <span className="font-body text-sm">
        <Link
          href={`/bowler/${record.slug}`}
          className="text-navy hover:text-red-600 transition-colors font-medium"
        >
          {record.bowlerName}
        </Link>
        <span className="ml-2 tabular-nums font-semibold text-navy">
          {record.value.toLocaleString()}
        </span>
      </span>
    </div>
  );
}

function RecordsSection({ records }: { records: SeasonRecords }) {
  const hasAnyRecords =
    records.highScratchGame ||
    records.highScratchSeries ||
    records.highHcpSeries ||
    records.mostTurkeys ||
    records.most200Games;

  if (!hasAnyRecords) return null;

  return (
    <div className="mt-6">
      <h3 className="font-heading text-lg text-navy/70 mb-4">Season Records</h3>
      <div className="bg-navy/[0.02] rounded-lg px-4 py-2">
        <RecordRow label="High Scratch Game" record={records.highScratchGame} />
        <RecordRow label="High Scratch Series" record={records.highScratchSeries} />
        <RecordRow label="High HCP Series" record={records.highHcpSeries} />
        <RecordRow label="Most Turkeys" record={records.mostTurkeys} />
        <RecordRow label="Most 200+ Games" record={records.most200Games} />
      </div>
    </div>
  );
}

export function SeasonLeaderboards({ mensScratch, womensScratch, handicap, records }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('mens');

  const tabContent: Record<TabKey, LeaderboardCategory[]> = {
    mens: mensScratch,
    womens: womensScratch,
    handicap,
  };

  const categories = tabContent[activeTab];
  const allEmpty = categories.every(c => c.entries.length === 0);

  return (
    <section>
      <h2 className="font-heading text-2xl text-navy mb-4">Leaderboards</h2>

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
          {categories.map((cat) => (
            <div key={cat.title}>
              <h4 className="font-body text-sm font-semibold text-navy/50 uppercase tracking-wider mb-2">
                {cat.title}
              </h4>
              <LeaderboardTable entries={cat.entries} />
            </div>
          ))}
        </div>
      )}

      {/* Season Records (always visible, below tabs) */}
      <RecordsSection records={records} />
    </section>
  );
}
