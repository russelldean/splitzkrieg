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
        {/* 6-column grid: top row spans cols 1-2, 3-4, 5-6; bottom row offset to cols 2-3, 4-5 for W stagger */}
        <div className="grid grid-cols-6 gap-y-6 gap-x-4">
          <div className="col-span-2">
            <RecordCard
              label="High Game"
              value={careerSummary.highGame}
              colorClass={scoreColorClass(careerSummary.highGame)}
            />
          </div>
          <div className="col-span-2">
            <RecordCard
              label="High Series"
              value={careerSummary.highSeries}
              colorClass={seriesColorClass(careerSummary.highSeries)}
            />
          </div>
          <div className="col-span-2">
            <RecordCard label="200+ Games" value={careerSummary.games200Plus} />
          </div>
          <div className="col-start-2 col-span-2">
            <RecordCard label="Turkeys" value={careerSummary.totalTurkeys} />
          </div>
          <div className="col-start-4 col-span-2">
            <RecordCard label="600+ Series" value={careerSummary.series600Plus} />
          </div>
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
