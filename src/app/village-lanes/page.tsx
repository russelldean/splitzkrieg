import Image from 'next/image';
import type { Metadata } from 'next';
import { ParallaxBg } from '@/components/ui/ParallaxBg';

export const metadata: Metadata = {
  title: 'Village Lanes | Splitzkrieg',
  description: 'Village Lanes — home of Splitzkrieg Bowling League since 2007.',
};

export default function VillageLanesPage() {
  return (
    <main>
      {/* Parallax Hero — blue chairs */}
      <div className="relative overflow-hidden h-56 sm:h-72 md:h-80">
        <ParallaxBg src="/village-lanes-chairs.jpg" focalY={0.4} imgW={2048} imgH={1536} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="relative z-10 flex items-end h-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <h1 className="font-heading text-4xl sm:text-5xl text-white drop-shadow-lg">
            Village Lanes
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Party Zone neon sign */}
        <figure>
          <div className="rounded-xl overflow-hidden shadow-md">
            <Image
              src="/village-lanes-party-zone.jpg"
              alt="The Party Zone neon sign at Village Lanes"
              width={1293}
              height={621}
              className="w-full h-auto"
            />
          </div>
        </figure>
      </div>
    </main>
  );
}
