import Link from 'next/link';
import type { SeasonLeaderEntry, SeasonRecords } from '@/lib/queries';
import { strikeX } from '@/components/ui/StrikeX';

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
                  {strikeX(entry.bowlerName)}
                </Link>
              </td>
              <td className="px-4 py-2 text-navy/60">
                {entry.teamSlug ? (
                  <Link
                    href={`/team/${entry.teamSlug}`}
                    className="hover:text-red-600 transition-colors"
                  >
                    {entry.teamName ? strikeX(entry.teamName) : '\u2014'}
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
          {strikeX(record.bowlerName)}
        </Link>
        <span className="ml-2 tabular-nums font-semibold text-navy">
          {record.value.toLocaleString()}
        </span>
      </span>
    </div>
  );
}

function CategorySection({ title, categories }: { title: string; categories: LeaderboardCategory[] }) {
  const allEmpty = categories.every(c => c.entries.length === 0);
  if (allEmpty) {
    return (
      <div>
        <h3 className="font-heading text-lg text-navy/70 mb-3">{title}</h3>
        <p className="font-body text-sm text-navy/40 italic">No data for this category.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-heading text-lg text-navy/70 mb-4">{title}</h3>
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
    </div>
  );
}

export function SeasonLeaderboards({ mensScratch, womensScratch, handicap, records }: Props) {
  const hasAnyRecords =
    records.highScratchGame ||
    records.highScratchSeries ||
    records.highHcpSeries ||
    records.mostTurkeys ||
    records.most200Games;

  return (
    <section>
      <h2 className="font-heading text-2xl text-navy mb-6">Leaderboards</h2>
      <div className="space-y-10">
        <CategorySection title="Men's Scratch" categories={mensScratch} />
        <CategorySection title="Women's Scratch" categories={womensScratch} />
        <CategorySection title="Handicap" categories={handicap} />

        {hasAnyRecords && (
          <div>
            <h3 className="font-heading text-lg text-navy/70 mb-4">Season Records</h3>
            <div className="bg-navy/[0.02] rounded-lg px-4 py-2">
              <RecordRow label="High Scratch Game" record={records.highScratchGame} />
              <RecordRow label="High Scratch Series" record={records.highScratchSeries} />
              <RecordRow label="High HCP Series" record={records.highHcpSeries} />
              <RecordRow label="Most Turkeys" record={records.mostTurkeys} />
              <RecordRow label="Most 200+ Games" record={records.most200Games} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
