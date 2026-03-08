import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllSeasonsDirectory, getCurrentSeasonSlug } from '@/lib/queries';
import { SeasonDirectory } from '@/components/season/SeasonDirectory';

export const metadata: Metadata = {
  title: 'Season Stats | Splitzkrieg',
  description:
    'Leaderboards, averages, and records for every Splitzkrieg Bowling League season.',
};

export default async function StatsIndexPage() {
  const [seasons, currentSlug] = await Promise.all([
    getAllSeasonsDirectory(),
    getCurrentSeasonSlug(),
  ]);

  return (
    <SeasonDirectory
      seasons={seasons}
      currentSlug={currentSlug}
      trailCurrent="/stats"
      heading="Season Stats"
      subheading={(count) => `Leaderboards and records for ${count} seasons.`}
    />
  );
}
