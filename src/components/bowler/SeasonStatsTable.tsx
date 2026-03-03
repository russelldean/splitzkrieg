import Link from 'next/link';
import type { BowlerSeasonStats } from '@/lib/queries';
import { scoreColorClass, seriesColorClass } from '@/lib/score-utils';
import { EmptyState } from '@/components/ui/EmptyState';

interface Props {
  seasons: BowlerSeasonStats[];
}

export function SeasonStatsTable({ seasons }: Props) {
  if (seasons.length === 0) {
    return (
      <section>
        <h2 className="font-heading text-2xl text-navy mb-4">Season Stats</h2>
        <div className="bg-white rounded-lg border border-navy/10 p-6">
          <EmptyState title="No season data available" />
        </div>
      </section>
    );
  }

  const totals = seasons.reduce(
    (acc, s) => ({
      gamesBowled: acc.gamesBowled + s.gamesBowled,
      totalPins: acc.totalPins + s.totalPins,
      games200Plus: acc.games200Plus + s.games200Plus,
    }),
    { gamesBowled: 0, totalPins: 0, games200Plus: 0 },
  );

  const careerAvg =
    totals.gamesBowled > 0
      ? (totals.totalPins / totals.gamesBowled).toFixed(1)
      : '\u2014';

  const careerHighGame = Math.max(...seasons.map((s) => s.highGame ?? 0));
  const careerHighSeries = Math.max(...seasons.map((s) => s.highSeries ?? 0));

  return (
    <section>
      <h2 className="font-heading text-2xl text-navy mb-4">Season Stats</h2>
      <div className="overflow-x-auto rounded-lg border border-navy/10">
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="bg-navy/5 text-left text-xs uppercase tracking-wide text-navy/60">
              <th className="px-4 py-3">Season</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3 text-right">Games</th>
              <th className="px-4 py-3 text-right">Avg</th>
              <th className="px-4 py-3 text-right">High Game</th>
              <th className="px-4 py-3 text-right">High Series</th>
              <th className="px-4 py-3 text-right">200+</th>
              <th className="px-4 py-3 text-right">Total Pins</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/5">
            {seasons.map((season) => (
              <tr key={`${season.seasonID}-${season.teamSlug ?? 'no-team'}`} className="hover:bg-navy/[0.02]">
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link
                    href={`/season/${season.romanNumeral}`}
                    className="text-navy hover:text-red-600 transition-colors"
                  >
                    {season.displayName}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {season.teamSlug ? (
                    <Link
                      href={`/team/${season.teamSlug}`}
                      className="text-navy hover:text-red-600 transition-colors"
                    >
                      {season.teamName}
                    </Link>
                  ) : (
                    <span className="text-navy/50">{season.teamName ?? '\u2014'}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">{season.gamesBowled}</td>
                <td className="px-4 py-3 text-right">
                  {season.seasonAverage?.toFixed(1) ?? '\u2014'}
                </td>
                <td className={`px-4 py-3 text-right ${scoreColorClass(season.highGame)}`}>
                  {season.highGame ?? '\u2014'}
                </td>
                <td className={`px-4 py-3 text-right ${seriesColorClass(season.highSeries)}`}>
                  {season.highSeries ?? '\u2014'}
                </td>
                <td className="px-4 py-3 text-right">{season.games200Plus}</td>
                <td className="px-4 py-3 text-right">
                  {season.totalPins.toLocaleString()}
                </td>
              </tr>
            ))}

            {/* Career totals row */}
            <tr className="font-semibold bg-navy/5">
              <td className="px-4 py-3">Career</td>
              <td className="px-4 py-3 text-navy/50">{'\u2014'}</td>
              <td className="px-4 py-3 text-right">{totals.gamesBowled}</td>
              <td className="px-4 py-3 text-right">{careerAvg}</td>
              <td className={`px-4 py-3 text-right ${scoreColorClass(careerHighGame || null)}`}>
                {careerHighGame || '\u2014'}
              </td>
              <td className={`px-4 py-3 text-right ${seriesColorClass(careerHighSeries || null)}`}>
                {careerHighSeries || '\u2014'}
              </td>
              <td className="px-4 py-3 text-right">{totals.games200Plus}</td>
              <td className="px-4 py-3 text-right">
                {totals.totalPins.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
