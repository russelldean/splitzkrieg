import type { BowlerCareerSummary } from '@/lib/queries';
import { scoreColorClass, seriesColorClass } from '@/lib/score-utils';
import { EmptyState } from '@/components/ui/EmptyState';

interface Props {
  careerSummary: BowlerCareerSummary | null;
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
        <div className="grid grid-cols-3 gap-4">
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
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <RecordCard label="Turkeys" value={careerSummary.totalTurkeys} />
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
  value: number | null;
  colorClass?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-navy/50 font-body">
        {label}
      </span>
      <span className={`text-3xl font-heading ${colorClass}`.trim()}>
        {value ?? '\u2014'}
      </span>
    </div>
  );
}
