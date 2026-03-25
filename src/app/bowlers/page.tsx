import { Suspense } from 'react';
import { getAllBowlersDirectory } from '@/lib/queries';
import { EmptyState } from '@/components/ui/EmptyState';
import { BackToTop } from '@/components/ui/BackToTop';
import { TrailNav } from '@/components/ui/TrailNav';
import { BowlerDirectory } from '@/components/bowlers/BowlerDirectory';
import { ParallaxBg } from '@/components/ui/ParallaxBg';
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
      <section className="relative overflow-hidden h-36 sm:h-44" role="img" aria-label="Splitzkrieg bowling league trophies">
        <ParallaxBg
          src="/splitzkrieg-trophies.jpg"
          imgW={2048} imgH={1536}
          focalY={0.5}
          maxW={896}
          mobileSrc="/splitzkrieg-trophies.jpg"
          mobileFocalY={0.5}
          mobileImgW={2048} mobileImgH={1536}
        />
        <div className="absolute inset-0 z-[1] bg-navy/15" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-r from-navy/60 via-transparent to-navy/60 sm:from-navy/80 sm:via-transparent sm:to-navy/80" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-6">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl text-white drop-shadow-lg">Bowlers</h1>
            <p className="font-body text-white/85 text-sm mt-1 drop-shadow">{bowlers.length} bowlers through {new Date().getFullYear() - 2007} years of Splitzkrieg.</p>
          </div>
        </div>
      </section>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
        <TrailNav current="/bowlers" position="top" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <Suspense>
          <BowlerDirectory bowlers={bowlers} />
        </Suspense>
        <BackToTop />
      </div>
    </div>
  );
}
