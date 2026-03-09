import { Suspense } from 'react';
import { getAllBowlersDirectory } from '@/lib/queries';
import { EmptyState } from '@/components/ui/EmptyState';
import { BackToTop } from '@/components/ui/BackToTop';
import { TrailNav } from '@/components/ui/TrailNav';
import { BowlerDirectory } from '@/components/bowlers/BowlerDirectory';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bowlers',
  description:
    `Browse all Splitzkrieg Bowling League bowlers. Find any bowler from ${new Date().getFullYear() - 2007} years of league history.`,
};

export default async function BowlersPage() {
  const bowlers = await getAllBowlersDirectory();

  if (bowlers.length === 0) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
          <EmptyState
            title="No Bowlers Found"
            message="No bowler data available."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <TrailNav current="/bowlers" position="top" />
        <Suspense>
          <BowlerDirectory bowlers={bowlers} />
        </Suspense>
        <BackToTop />
        <TrailNav current="/bowlers" />
      </div>
    </div>
  );
}
