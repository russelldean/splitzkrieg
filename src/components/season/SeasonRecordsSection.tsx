import Link from 'next/link';
import type { SeasonRecords } from '@/lib/queries';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface Props {
  records: SeasonRecords;
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
    <div className="flex items-center justify-between py-2 border-b border-navy/5 last:border-b-0">
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

export function SeasonRecordsSection({ records }: Props) {
  const hasAnyRecords =
    records.highScratchGame ||
    records.highScratchSeries ||
    records.highHcpSeries ||
    records.mostTurkeys ||
    records.most200Games;

  if (!hasAnyRecords) return null;

  return (
    <section id="records">
      <SectionHeading>Season Records</SectionHeading>
      <div className="bg-navy/[0.02] rounded-lg px-4 py-2">
        <RecordRow label="High Scratch Game" record={records.highScratchGame} />
        <RecordRow label="High Scratch Series" record={records.highScratchSeries} />
        <RecordRow label="High HCP Series" record={records.highHcpSeries} />
        <RecordRow label="Most Turkeys" record={records.mostTurkeys} />
        <RecordRow label="Most 200+ Games" record={records.most200Games} />
      </div>
    </section>
  );
}
