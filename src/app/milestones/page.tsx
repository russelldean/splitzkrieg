/**
 * League-wide milestones page.
 * Shows recently achieved milestones and bowlers approaching career milestones.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { getLeagueMilestones, type LeagueMilestone } from '@/lib/queries';
import { MILESTONE_THRESHOLDS, type MilestoneCategory } from '@/lib/milestone-config';
import { TrailNav } from '@/components/ui/TrailNav';
import { NextStopNudge } from '@/components/ui/NextStopNudge';
import { SectionHeading } from '@/components/ui/SectionHeading';

export const metadata: Metadata = {
  title: 'Milestone Watch | Splitzkrieg',
  description:
    'Track career milestones across the Splitzkrieg Bowling League - approaching and recently achieved.',
};

const CATEGORY_ORDER: MilestoneCategory[] = [
  'totalGames',
  'totalPins',
  'games200Plus',
  'series600Plus',
  'totalTurkeys',
];

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  totalGames: { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  totalPins: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  games200Plus: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  series600Plus: { text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  totalTurkeys: { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};

function formatThreshold(category: MilestoneCategory, threshold: number): string {
  const label = MILESTONE_THRESHOLDS[category].label;
  return `${threshold.toLocaleString()} ${label}`;
}

function MilestoneGroup({
  threshold,
  category,
  bowlers,
}: {
  threshold: number;
  category: MilestoneCategory;
  bowlers: LeagueMilestone[];
}) {
  const colors = CATEGORY_COLORS[category];
  return (
    <div className={`rounded-lg border ${colors.border} overflow-hidden`}>
      <div className={`px-4 py-2 ${colors.bg}`}>
        <h3 className={`font-heading text-base ${colors.text}`}>
          {formatThreshold(category, threshold)}
        </h3>
      </div>
      <div className="divide-y divide-navy/5 bg-white">
        {bowlers.map((m) => (
          <div key={m.bowlerID} className="flex items-center justify-between px-4 py-2.5">
            <Link
              href={`/bowler/${m.slug}`}
              className="font-body text-sm text-navy hover:text-red-600 transition-colors font-medium"
            >
              {m.bowlerName}
            </Link>
            <div className="flex items-center gap-3 text-sm font-body tabular-nums">
              <span className="text-navy/50">{m.current.toLocaleString()}</span>
              <span className={`font-semibold ${colors.text}`}>
                {m.needed.toLocaleString()} to go
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function MilestonesPage() {
  const milestones = await getLeagueMilestones();

  // Group approaching milestones by category, then threshold
  const approachingByCategory = new Map<MilestoneCategory, Map<number, LeagueMilestone[]>>();
  for (const m of milestones.approaching) {
    if (!approachingByCategory.has(m.category)) {
      approachingByCategory.set(m.category, new Map());
    }
    const byThreshold = approachingByCategory.get(m.category)!;
    if (!byThreshold.has(m.threshold)) {
      byThreshold.set(m.threshold, []);
    }
    byThreshold.get(m.threshold)!.push(m);
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
      <TrailNav current="/stats" position="top" />

      <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy">
        Milestone Watch
      </h1>
      <p className="font-body text-lg text-navy/60 mt-1">
        Active bowlers approaching career milestones
      </p>

      {/* Recently Achieved */}
      {milestones.achieved.length > 0 && (
        <section className="mt-8">
          <SectionHeading>Recently Achieved</SectionHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {milestones.achieved.map((m, i) => {
              const colors = CATEGORY_COLORS[m.category];
              return (
                <div
                  key={`${m.bowlerID}-${m.category}-${m.threshold}-${i}`}
                  className={`flex items-center gap-3 rounded-lg border ${colors.border} ${colors.bg} px-4 py-3`}
                >
                  <span className="text-lg">&#10003;</span>
                  <div>
                    <Link
                      href={`/bowler/${m.slug}`}
                      className={`font-body font-semibold ${colors.text} hover:underline`}
                    >
                      {m.bowlerName}
                    </Link>
                    <div className="font-body text-sm text-navy/60">
                      Reached {formatThreshold(m.category, m.threshold)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Approaching Milestones by Category */}
      {CATEGORY_ORDER.map((category) => {
        const byThreshold = approachingByCategory.get(category);
        if (!byThreshold || byThreshold.size === 0) return null;

        const thresholds = [...byThreshold.keys()].sort((a, b) => a - b);
        return (
          <section key={category} className="mt-8">
            <SectionHeading>{MILESTONE_THRESHOLDS[category].label}</SectionHeading>
            <div className="mt-4 space-y-4">
              {thresholds.map((threshold) => (
                <MilestoneGroup
                  key={threshold}
                  threshold={threshold}
                  category={category}
                  bowlers={byThreshold.get(threshold)!}
                />
              ))}
            </div>
          </section>
        );
      })}

      {milestones.approaching.length === 0 && milestones.achieved.length === 0 && (
        <p className="font-body text-navy/65 italic mt-8">
          No milestones to show right now.
        </p>
      )}

      <NextStopNudge currentPage="milestones" />
      <TrailNav current="/stats" />
    </main>
  );
}
