/**
 * Public route for an individual week.
 *
 * This file owns only the prerender contract: which weeks are built ahead of
 * time and the page metadata. By default just the current season's weeks are
 * pre-rendered, and historical weeks render on demand (dynamicParams = true);
 * BUILD_ALL=1 pre-renders every season's weeks instead.
 *
 * Everything the page actually renders lives in WeekPageBody, which the admin
 * draft preview route also renders. Keep this route free of dynamic APIs: one
 * would deopt all ~325 week pages to per-request rendering.
 */
import type { Metadata } from 'next';
import {
  getSeasonBySlug,
  getSeasonWeekNumbers,
  getSeasonSchedule,
  getAllSeasonNavList,
  getCurrentSeasonSlug,
} from '@/lib/queries';
import { WeekPageBody } from '@/components/week/WeekPageBody';

export const dynamicParams = true;

export async function generateStaticParams(): Promise<{ seasonSlug: string; weekNum: string }[]> {
  // BUILD_ALL=1 prebuilds every season's weeks (full static build); default
  // prebuilds only the current season and renders historical weeks on demand.
  if (process.env.BUILD_ALL === '1') {
    const seasons = await getAllSeasonNavList();
    const params: { seasonSlug: string; weekNum: string }[] = [];
    for (const s of seasons) {
      const weeks = await getSeasonWeekNumbers(s.seasonID);
      for (const w of weeks) {
        params.push({ seasonSlug: s.slug, weekNum: String(w) });
      }
    }
    return params;
  }

  // Prebuild only the current season's weeks; historical weeks render on demand.
  const currentSlug = await getCurrentSeasonSlug();
  if (!currentSlug) return [];

  const season = await getSeasonBySlug(currentSlug);
  if (!season) return [];

  const scoreWeeks = await getSeasonWeekNumbers(season.seasonID);
  const schedule = await getSeasonSchedule(season.seasonID);

  const weeks = new Set<number>();
  scoreWeeks.forEach((w) => weeks.add(w));
  schedule.forEach((s) => weeks.add(s.week));

  return Array.from(weeks).map((week) => ({
    seasonSlug: currentSlug,
    weekNum: String(week),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seasonSlug: string; weekNum: string }>;
}): Promise<Metadata> {
  const { seasonSlug, weekNum } = await params;
  const season = await getSeasonBySlug(seasonSlug);
  if (!season) return { title: 'Week Not Found | Splitzkrieg' };

  const title = `Week ${weekNum} - Season ${season.romanNumeral} | Splitzkrieg`;
  const description = `Week ${weekNum} results for ${season.period} ${season.year} (Season ${season.romanNumeral}). Splitzkrieg Bowling League.`;

  return { title, description };
}

export default async function WeekPage({
  params,
}: {
  params: Promise<{ seasonSlug: string; weekNum: string }>;
}) {
  const { seasonSlug, weekNum: weekNumStr } = await params;
  return <WeekPageBody seasonSlug={seasonSlug} weekNum={parseInt(weekNumStr, 10)} />;
}
