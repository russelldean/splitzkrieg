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
      <section className="relative overflow-hidden h-36 sm:h-44" role="img" aria-label="Village Lanes bowling alley panorama">
        <ParallaxBg
          src="/village-lanes-panorama.jpg"
          imgW={1996} imgH={638}
          focalY={0.4}
          mobileSrc="/village-lanes-panorama.jpg"
          mobileFocalY={0.5}
          mobileImgW={1996} mobileImgH={638}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy/80 to-navy/50" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-6">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl text-white">Bowlers</h1>
            <p className="font-body text-white/70 text-sm mt-1">{bowlers.length} bowlers across {new Date().getFullYear() - 2007} years of Splitzkrieg history</p>
          </div>
        </div>
      </section>
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
