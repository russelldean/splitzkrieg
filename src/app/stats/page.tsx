/**
 * /stats — redirects to the current season's stats page.
 */
import { redirect } from 'next/navigation';
import { getCurrentSeasonSnapshot } from '@/lib/queries';

export default async function StatsPage() {
  const snapshot = await getCurrentSeasonSnapshot();
  if (!snapshot) {
    redirect('/seasons');
  }
  redirect(`/stats/${snapshot.slug}`);
}
