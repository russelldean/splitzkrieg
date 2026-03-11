import Link from 'next/link';
import { getSeasonIDByRoman, getWeekMilestones } from '@/lib/queries/blog';

interface MilestonesBlockProps {
  season: string;
  week: number | string;
}

export async function MilestonesBlock({ season, week }: MilestonesBlockProps) {
  const weekNum = typeof week === 'string' ? parseInt(week, 10) : week;
  const seasonID = await getSeasonIDByRoman(season);
  if (!seasonID || isNaN(weekNum)) return null;

  const milestones = await getWeekMilestones(seasonID, weekNum);

  return (
    <div className="bg-white rounded-lg border border-navy/10 shadow-sm p-5 my-6">
      <h3 className="font-heading text-lg text-navy mb-4">Milestones &amp; Personal Bests</h3>
      {milestones.length === 0 ? (
        <p className="font-body text-sm text-navy/50 italic">No new milestones this week.</p>
      ) : (
        <ul className="space-y-2">
          {milestones.map((m, i) => (
            <li key={`${m.slug}-${i}`} className="flex items-start gap-2 font-body text-sm">
              <span className="text-amber-500 mt-0.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </span>
              <span>
                <Link href={`/bowler/${m.slug}`} className="text-navy font-semibold hover:text-red-600 transition-colors">
                  {m.bowlerName}
                </Link>
                <span className="text-navy/70"> &mdash; {m.achievement}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
