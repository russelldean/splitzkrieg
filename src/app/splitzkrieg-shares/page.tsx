import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ParallaxBg } from '@/components/ui/ParallaxBg';
import { BackToHome } from '@/components/ui/BackToHome';

export const metadata: Metadata = {
  title: 'Splitzkrieg Shares | Splitzkrieg',
  description:
    'The Splitzkrieg Shares free table. One bowler\'s junk is another bowler\'s treasure.',
};

const treasures = [
  'Bowling balls, bags, and shoes',
  'Bowling-themed tchotchkes',
  'Books, CDs, and records galore',
  'Fabulous vintage fashions',
  'Creepy dolls and fine art',
];

export default function SplitzkriegSharesPage() {
  return (
    <main className="min-h-screen bg-cream">
      {/* Hero */}
      <section
        className="relative overflow-hidden h-48 sm:h-56"
        role="img"
        aria-label="Splitzkrieg Shares free table loaded with treasures"
      >
        <ParallaxBg
          src="/splitzkrieg-shares-table.jpg"
          imgW={1512}
          imgH={2016}
          focalY={0.35}
          maxW={3024}
          mobileSrc="/splitzkrieg-shares-table.jpg"
          mobileFocalY={0.35}
          mobileImgW={3024}
          mobileImgH={4032}
        />
        <div className="absolute inset-0 z-[1] bg-navy/30" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-r from-navy/60 via-transparent to-navy/60 sm:from-navy/70 sm:via-transparent sm:to-navy/70" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-6">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl text-white drop-shadow-lg">
              Splitzkrieg Shares
            </h1>
            <p className="font-body text-white/90 text-sm sm:text-base mt-1 drop-shadow">
              One bowler&apos;s junk is another bowler&apos;s treasure.
            </p>
          </div>
        </div>
      </section>

      <BackToHome />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* Origin story */}
        <section className="space-y-5">
          <div className="bg-white rounded-xl p-6 sm:p-8 border border-navy/10 shadow-sm">
            <p className="font-body text-navy/80 text-base sm:text-lg leading-relaxed">
              The Splitzkrieg Shares free table is orchestrated by{' '}
              <Link
                href="/bowler/brooke-insley"
                className="text-red font-semibold hover:underline"
              >
                Brooke Insley
              </Link>{' '}
              (Guttermouths). Each week, bowlers are encouraged to bring unwanted
              treasures that other bowlers may want to take home.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-navy/10" />
            <span className="font-heading text-base text-navy/60 tracking-widest uppercase">
              Est. July 26, 2021
            </span>
            <div className="h-px flex-1 bg-navy/10" />
          </div>
        </section>

        {/* Before & After */}
        <section className="space-y-6">
          {/* Before */}
          <div className="space-y-3">
            <h2 className="font-heading text-2xl text-navy">How It Started</h2>
            <figure className="space-y-2">
              <div className="relative rounded-xl overflow-hidden shadow-md">
                <Image
                  src="/splitzkrieg-shares-first.jpg"
                  alt="The very first Splitzkrieg Shares table, July 26, 2021 - a bowling pin, dolls, books, mugs, and more"
                  width={1600}
                  height={1200}
                  className="w-full h-auto"
                />
                <div className="absolute top-3 left-3 bg-navy/80 text-cream font-heading text-xs sm:text-sm px-3 py-1 rounded-full tracking-wide uppercase">
                  July 2021
                </div>
              </div>
              <figcaption className="text-center font-body text-sm text-navy/50 italic">
                Monday, July 26, 2021. The inaugural Splitzkrieg Shares table.
              </figcaption>
            </figure>
          </div>

          {/* Arrow / divider */}
          <div className="flex items-center justify-center py-2">
            <div className="h-px flex-1 bg-navy/10" />
            <span className="mx-4 font-heading text-navy/30 text-2xl">&#8595;</span>
            <div className="h-px flex-1 bg-navy/10" />
          </div>

          {/* After */}
          <div className="space-y-3">
            <h2 className="font-heading text-2xl text-navy">How It&apos;s Going</h2>
            <figure className="space-y-2">
              <div className="relative rounded-xl overflow-hidden shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/splitzkrieg-shares-table.jpg"
                  alt="Splitzkrieg Shares table in full glory - paintings, shoes, books, bowling gear piled high"
                  width={1512}
                  height={2016}
                  className="w-full h-auto"
                />
                <div className="absolute top-3 left-3 bg-red/90 text-cream font-heading text-xs sm:text-sm px-3 py-1 rounded-full tracking-wide uppercase">
                  Now
                </div>
              </div>
              <figcaption className="text-center font-body text-sm text-navy/50 italic">
                Things have escalated.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* What you'll find */}
        <section className="space-y-4">
          <h2 className="font-heading text-xl text-navy">
            What You Might Find
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {treasures.map((item) => (
              <div
                key={item}
                className="bg-white rounded-lg px-5 py-3 border border-navy/10 font-body text-navy/75 flex items-center gap-3"
              >
                <span className="text-red text-lg" aria-hidden="true">
                  &#9733;
                </span>
                {item}
              </div>
            ))}
          </div>
        </section>

        {/* The one rule */}
        <section>
          <div className="bg-red/5 border border-red/20 rounded-xl p-6 sm:p-8 text-center space-y-3">
            <h2 className="font-heading text-xl text-red">The One Rule</h2>
            <p className="font-body text-navy/80 text-base sm:text-lg leading-relaxed max-w-lg mx-auto">
              Please take home any unclaimed items at the end of the night.
            </p>
          </div>
        </section>

        {/* Where to find it */}
        <section>
          <div className="bg-white rounded-xl p-6 border border-navy/10 text-center space-y-2">
            <p className="font-body text-navy/60 text-sm uppercase tracking-wider font-semibold">
              Where to find it
            </p>
            <p className="font-body text-navy/80 text-base">
              Located on the lanes where the Guttermouths are bowling.
            </p>
            <p className="font-body text-navy/70 text-base leading-relaxed">
              So as items are piling up at home for thrift store donation drop-off,
              consider bringing them to the Splitzkrieg Shares free table.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
