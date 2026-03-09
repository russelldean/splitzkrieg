import type { PersonalMilestone } from '@/lib/milestone-config';

interface Props {
  milestones: PersonalMilestone[];
}

const CATEGORY_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
  totalGames: { bar: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
  totalPins: { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  games200Plus: { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
  series600Plus: { bar: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50' },
  totalTurkeys: { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' },
};

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function MilestoneWatch({ milestones }: Props) {
  // Only show categories with an upcoming threshold
  const upcoming = milestones.filter((m) => m.nextThreshold !== null);

  if (upcoming.length === 0) return null;

  return (
    <section>
      <h2 className="font-heading text-2xl text-navy">Milestone Watch</h2>
      <span className="block w-10 h-0.5 bg-red-600/40 mt-1.5" />

      <div className="mt-4 space-y-3">
        {upcoming.map((m) => {
          const colors = CATEGORY_COLORS[m.category] ?? CATEGORY_COLORS.totalGames;
          return (
            <div
              key={m.category}
              className="bg-white rounded-lg border border-navy/10 px-4 py-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold font-body px-1.5 py-0.5 rounded-full ${colors.text} ${colors.bg}`}>
                    {m.label}
                  </span>
                  <span className="text-sm text-navy/50 font-body">
                    {formatNumber(m.needed)} to go
                  </span>
                </div>
                <span className="font-heading text-sm text-navy tabular-nums">
                  {formatNumber(m.current)} / {formatNumber(m.nextThreshold!)}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-2 bg-navy/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${colors.bar}`}
                  style={{ width: `${m.pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
