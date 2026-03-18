import Image from 'next/image';
import type { Metadata } from 'next';
import { ParallaxBg } from '@/components/ui/ParallaxBg';

export const metadata: Metadata = {
  title: 'Village Lanes | Splitzkrieg',
  description: 'Village Lanes - home of Splitzkrieg Bowling League since 2007.',
};

export default function VillageLanesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-navy/[0.04] via-cream to-cream">
      {/* Parallax Hero — Party Zone neon sign */}
      <section className="relative overflow-hidden h-36 sm:h-44" role="img" aria-label="Party Zone neon sign at Village Lanes">
        <ParallaxBg
          src="/village-lanes-party-zone.jpg"
          imgW={1293} imgH={621}
          focalY={0.45}
        />
        <div className="absolute inset-0 z-[1] bg-navy/15" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-r from-navy/40 via-transparent to-navy/40 sm:from-navy/70 sm:via-transparent sm:to-navy/70" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-6">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl text-white drop-shadow-lg">Village Lanes</h1>
            <p className="font-body text-white/85 text-sm mt-1 drop-shadow">Durham, NC. Home since 2007.</p>
          </div>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Panorama */}
        <figure>
          <div className="rounded-xl overflow-hidden shadow-md shadow-navy/10">
            <Image
              src="/village-lanes-panorama.jpg"
              alt="Panoramic view of Village Lanes"
              width={4032}
              height={1080}
              className="w-full h-auto"
            />
          </div>
        </figure>

        {/* Two-column grid: lanes + ball returns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <figure>
            <div className="rounded-xl overflow-hidden shadow-md shadow-navy/10">
              <Image
                src="/village-lanes-lanes.jpg"
                alt="Looking down the lanes at Village Lanes"
                width={3024}
                height={4032}
                className="w-full h-auto"
              />
            </div>
          </figure>
          <figure>
            <div className="rounded-xl overflow-hidden shadow-md shadow-navy/10">
              <Image
                src="/village-lanes-brunswick-2000s.jpg"
                alt="Brunswick 2000 ball returns at Village Lanes"
                width={4032}
                height={3024}
                className="w-full h-auto"
              />
            </div>
          </figure>
        </div>

        {/* Parking lot wide shot */}
        <figure>
          <div className="rounded-xl overflow-hidden shadow-md shadow-navy/10">
            <Image
              src="/village-lanes-parking-lot.jpg"
              alt="Village Lanes from the parking lot"
              width={4032}
              height={3024}
              className="w-full h-auto"
            />
          </div>
        </figure>

        <p className="text-center text-navy/30 text-lg italic">For another day</p>
      </div>
    </main>
  );
}
