import type { BowlerCareerSummary } from '@/lib/queries';
import { formatMatchDate } from '@/lib/bowling-time';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeading } from '@/components/ui/SectionHeading';
import type { WeekDelta } from './LastWeekHighlight';

// EASTER EGG: Geoffrey Berry playoff 300 note
const HIGH_GAME_NOTES: Record<string, string> = {
  'geoffrey-berry': '300 game bowled during Fall 2022 Playoffs',
};

interface Props {
  careerSummary: BowlerCareerSummary | null;
  delta?: WeekDelta | null;
  slug?: string;
}

function formatFirstNight(summary: BowlerCareerSummary): string {
  if (summary.firstMatchDate) {
    return formatMatchDate(summary.firstMatchDate, { month: 'short', day: 'numeric', year: 'numeric' }) ?? '\u2014';
  }
  if (summary.firstYear) return String(summary.firstYear);
  return '\u2014';
}

export function PersonalRecordsPanel({ careerSummary, delta, slug }: Props) {
  if (!careerSummary) {
    return (
      <section>
        <SectionHeading>Personal Records</SectionHeading>
        <div className="bg-white rounded-lg border border-navy/10 border-l-4 border-l-red-600/30 p-6">
          <EmptyState title="No games recorded yet" />
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionHeading>Personal Records</SectionHeading>
      <div className="bg-white rounded-lg border border-navy/10 border-l-4 border-l-red-600/30 p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-6">
          <RecordCard label="First Night" value={formatFirstNight(careerSummary)} />
          <RecordCard
            label="Total Pins"
            value={careerSummary.totalPins?.toLocaleString() ?? null}
            delta={delta ? `+${delta.totalPins.toLocaleString()}` : undefined}
          />
          <RecordCard
            label="Career Avg"
            value={careerSummary.careerAverage?.toFixed(1) ?? null}
          />
          <RecordCard
            label="Turkeys"
            value={careerSummary.totalTurkeys}
            delta={delta?.turkeys ? `+${delta.turkeys}` : undefined}
          />
          <RecordCard
            label="High Game"
            value={careerSummary.highGame}
            delta={delta?.newHighGame ? 'NEW' : undefined}
            deltaVariant="new"
            note={slug ? HIGH_GAME_NOTES[slug] : undefined}
          />
          <RecordCard
            label="High Series"
            value={careerSummary.highSeries}
            delta={delta?.newHighSeries ? 'NEW' : undefined}
            deltaVariant="new"
          />
          <RecordCard
            label="200+ Games"
            value={careerSummary.games200Plus}
            delta={delta && delta.games200Plus > 0 ? `+${delta.games200Plus}` : undefined}
          />
          <RecordCard
            label="600+ Series"
            value={careerSummary.series600Plus}
            delta={delta && delta.series600Plus > 0 ? `+${delta.series600Plus}` : undefined}
          />
        </div>
      </div>
    </section>
  );
}

function RecordCard({
  label,
  value,
  delta,
  deltaVariant = 'positive',
  note,
}: {
  label: string;
  value: string | number | null;
  delta?: string;
  deltaVariant?: 'positive' | 'negative' | 'new';
  note?: string;
}) {
  // Show X (bowling strike symbol) for zero counts
  const isStrike = value === 0;
  const display = value === null ? '\u2014' : isStrike ? 'X' : value;
  const strikeClass = isStrike ? 'text-red-600/50 font-bold' : '';

  const deltaColors = {
    positive: 'text-green-600',
    negative: 'text-red-500',
    new: 'text-amber-600 font-bold',
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-navy/60 font-body">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-3xl font-heading ${strikeClass}`.trim()}>
          {display}
        </span>
        {delta && (
          <span className={`text-xs font-body ${deltaColors[deltaVariant]}`}>
            {delta}
          </span>
        )}
        {note && (
          <span className="relative group cursor-help">
            <svg className="w-4 h-4 text-navy/30 hover:text-navy/60 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-navy text-cream text-xs font-body rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
              {note}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
