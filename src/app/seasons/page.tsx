import type { Metadata } from 'next';
import { getAllSeasonsDirectory, getCurrentSeasonSlug } from '@/lib/queries';
import { SeasonDirectory } from '@/components/season/SeasonDirectory';

export const metadata: Metadata = {
  title: 'Seasons | Splitzkrieg',
  description:
    'Browse all Splitzkrieg Bowling League seasons. Standings, stats, leaderboards, and records from 35+ seasons of bowling.',
};

export default async function SeasonsPage() {
  const [seasons, currentSlug] = await Promise.all([
    getAllSeasonsDirectory(),
    getCurrentSeasonSlug(),
  ]);

  return (
    <SeasonDirectory
      seasons={seasons}
      currentSlug={currentSlug}
      trailCurrent="/seasons"
      heading="Seasons"
      subheading={(count) => `${count} seasons of Splitzkrieg bowling history.`}
    />
  );
}
