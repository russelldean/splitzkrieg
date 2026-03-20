import Link from 'next/link';
import type { HighGameRecord } from '@/lib/queries/alltime';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  });
}

export function HighGameProgression({ records }: { records: HighGameRecord[] }) {
  if (records.length === 0) return null;

  const minScore = Math.min(...records.map(r => r.score));
  const maxScore = Math.max(...records.map(r => r.score));
  const scoreRange = maxScore - minScore || 1;
  const chartBottom = minScore - 10;
  const chartTop = maxScore + 5;
  const totalRange = chartTop - chartBottom;

  return (
    <div className="mt-6">
      {/* Chart */}
      <div className="relative" style={{ height: 320 }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-right pr-1">
          {[chartTop, Math.round((chartTop + chartBottom) / 2), chartBottom].map(v => (
            <span key={v} className="text-[10px] text-navy/40 font-body leading-none">{v}</span>
          ))}
        </div>

        {/* Chart area */}
        <div className="ml-12 relative h-full border-l border-b border-navy/10">
          {/* Horizontal grid lines */}
          {[0.25, 0.5, 0.75].map(pct => (
            <div
              key={pct}
              className="absolute left-0 right-0 border-t border-navy/5"
              style={{ bottom: `${pct * 100}%` }}
            />
          ))}

          {/* Step line + markers */}
          <svg
            className="absolute inset-0 w-full h-full overflow-visible"
            preserveAspectRatio="none"
            viewBox={`0 0 ${records.length * 100} 100`}
          >
            {/* Step path */}
            <path
              d={records.map((r, i) => {
                const x = (i / Math.max(records.length - 1, 1)) * (records.length - 1) * 100;
                const y = 100 - ((r.score - chartBottom) / totalRange) * 100;
                if (i === 0) return `M ${x} ${y}`;
                const prevX = ((i - 1) / Math.max(records.length - 1, 1)) * (records.length - 1) * 100;
                return `H ${x} V ${y}`;
              }).join(' ')}
              fill="none"
              stroke="#DC2626"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Record markers */}
          {records.map((r, i) => {
            const leftPct = records.length === 1
              ? 50
              : (i / (records.length - 1)) * 100;
            const bottomPct = ((r.score - chartBottom) / totalRange) * 100;

            return (
              <div
                key={`${r.seasonID}-${r.week}`}
                className="absolute group"
                style={{
                  left: `${leftPct}%`,
                  bottom: `${bottomPct}%`,
                  transform: 'translate(-50%, 50%)',
                }}
              >
                {/* Dot */}
                <div className="w-3 h-3 rounded-full bg-red-600 border-2 border-white shadow-sm" />

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-navy text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap font-body">
                    <div className="font-bold text-sm">{r.score}</div>
                    <Link
                      href={`/bowler/${r.slug}`}
                      className="text-red-300 hover:text-red-200 transition-colors"
                    >
                      {r.bowlerName}
                    </Link>
                    <div className="text-white/60">
                      Night {r.nightNumber}
                    </div>
                    {r.matchDate && (
                      <div className="text-white/40">{formatDate(r.matchDate)}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline table below */}
      <div className="overflow-x-auto mt-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-navy/10 text-left">
              <th className="py-2 pr-4 font-heading text-navy/60 text-xs sm:text-sm uppercase tracking-wider">
                Score
              </th>
              <th className="py-2 pr-4 font-heading text-navy/60 text-xs sm:text-sm uppercase tracking-wider">
                Bowler
              </th>
              <th className="py-2 pr-4 font-heading text-navy/60 text-xs sm:text-sm uppercase tracking-wider">
                Night
              </th>
              <th className="py-2 font-heading text-navy/60 text-xs sm:text-sm uppercase tracking-wider">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr
                key={`${r.seasonID}-${r.week}`}
                className="border-b border-navy/5 last:border-0"
              >
                <td className="py-3 pr-4 font-heading text-lg text-red-600 tabular-nums">
                  {r.score}
                  {i === records.length - 1 && (
                    <span className="ml-2 text-xs font-body text-amber-600 uppercase tracking-wider">
                      Current
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 font-body">
                  <Link
                    href={`/bowler/${r.slug}`}
                    className="text-navy hover:text-red-600 transition-colors"
                  >
                    {r.bowlerName}
                  </Link>
                </td>
                <td className="py-3 pr-4 font-body text-navy/70 tabular-nums">
                  {r.nightNumber}
                </td>
                <td className="py-3 font-body text-navy/50">
                  {r.matchDate ? formatDate(r.matchDate) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
