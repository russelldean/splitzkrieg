import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BackToHome } from '@/components/ui/BackToHome';
import { SharesHero } from '@/components/resources/SharesHero';

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
    <main className="min-h-screen bg-gradient-to-b from-red/[0.04] via-cream to-cream">
      <SharesHero />

      <BackToHome />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* Origin story */}
        <section className="space-y-5">
          <div className="bg-white rounded-xl p-6 sm:p-8 border border-red/15 shadow-sm shadow-red/5">
            <p className="font-body text-navy/80 text-base sm:text-lg leading-relaxed">
              The Splitzkrieg Shares free table is orchestrated by{' '}
              <Link
                href="/bowler/brooke-insley"
                className="text-red font-semibold hover:underline"
              >
                Brooke Insley
              </Link>{' '}
              (<Link href="/team/guttermouths" className="text-red font-semibold hover:underline">Guttermouths</Link>). Each week, bowlers are encouraged to bring unwanted
              treasures that other bowlers may want to take home.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-red/15" />
            <span className="font-heading text-base text-navy/60 tracking-widest uppercase">
              Est. July 26, 2021
            </span>
            <div className="h-px flex-1 bg-red/15" />
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
            <div className="h-px flex-1 bg-red/15" />
            <span className="mx-4 font-heading text-navy/30 text-2xl">&#8595;</span>
            <div className="h-px flex-1 bg-red/15" />
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
                className="bg-white rounded-lg px-5 py-3 border border-red/15 shadow-sm shadow-red/5 font-body text-navy/75 flex items-center gap-3"
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
          <div className="bg-white rounded-xl p-6 border border-red/15 shadow-sm shadow-red/5 text-center space-y-2">
            <p className="font-body text-navy/60 text-sm uppercase tracking-wider font-semibold">
              Where to find it
            </p>
            <p className="font-body text-navy/80 text-base">
              Located on the lanes where the <Link href="/team/guttermouths" className="text-red font-semibold hover:underline">Guttermouths</Link> are bowling.
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
