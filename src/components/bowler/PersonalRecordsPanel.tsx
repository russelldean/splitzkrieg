import type { BowlerCareerSummary } from '@/lib/queries';
import { scoreColorClass, seriesColorClass } from '@/lib/score-utils';
import { EmptyState } from '@/components/ui/EmptyState';

interface Props {
  careerSummary: BowlerCareerSummary | null;
}

function formatFirstNight(summary: BowlerCareerSummary): string {
  if (summary.firstMatchDate) {
    return new Date(summary.firstMatchDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (summary.firstYear) return String(summary.firstYear);
  return '\u2014';
}

export function PersonalRecordsPanel({ careerSummary }: Props) {
  if (!careerSummary) {
    return (
      <section>
        <h2 className="font-heading text-2xl text-navy mb-4">Personal Records</h2>
        <div className="bg-white rounded-lg border border-navy/10 p-6">
          <EmptyState title="No games recorded yet" />
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-heading text-2xl text-navy mb-4">Personal Records</h2>
      <div className="bg-white rounded-lg border border-navy/10 p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-6">
          <RecordCard label="First Night" value={formatFirstNight(careerSummary)} />
          <RecordCard
            label="Total Pins"
            value={careerSummary.totalPins?.toLocaleString() ?? null}
          />
          <RecordCard
            label="Career Avg"
            value={careerSummary.careerAverage?.toFixed(1) ?? null}
          />
          <RecordCard label="Turkeys" value={careerSummary.totalTurkeys} />
          <RecordCard
            label="High Game"
            value={careerSummary.highGame}
            colorClass={scoreColorClass(careerSummary.highGame)}
          />
          <RecordCard
            label="High Series"
            value={careerSummary.highSeries}
            colorClass={seriesColorClass(careerSummary.highSeries)}
          />
          <RecordCard label="200+ Games" value={careerSummary.games200Plus} />
          <RecordCard label="600+ Series" value={careerSummary.series600Plus} />
        </div>
      </div>
    </section>
  );
}

function RecordCard({
  label,
  value,
  colorClass = '',
}: {
  label: string;
  value: string | number | null;
  colorClass?: string;
}) {
  // Show X (bowling strike symbol) for zero counts
  const isStrike = value === 0;
  const display = value === null ? '\u2014' : isStrike ? 'X' : value;
  const strikeClass = isStrike ? 'text-red-600/30' : '';

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-navy/50 font-body">
        {label}
      </span>
      <span className={`text-3xl font-heading ${colorClass || strikeClass}`.trim()}>
        {display}
      </span>
    </div>
  );
}
