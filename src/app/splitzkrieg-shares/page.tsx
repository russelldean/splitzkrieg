import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ParallaxBg } from '@/components/ui/ParallaxBg';
import { BackToHome } from '@/components/ui/BackToHome';
import { SharesAnimation, SharesAnimation2 } from '@/components/resources/SharesAnimation';

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

          {/* Chain swap animation divider */}
          <SharesAnimation />

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

          <SharesAnimation2 />
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
              Please take home any unclaimed items at the end of the night, so nobody else has to.
            </p>
            {/* Sad stick figure next to abandoned table of stuff */}
            <div className="pt-4 opacity-70 sm:opacity-50" aria-hidden="true">
              <svg viewBox="0 0 200 75" className="w-64 sm:w-80 h-auto mx-auto">
                {/* Table */}
                <line x1="70" y1="50" x2="170" y2="50" stroke="currentColor" strokeWidth="2.5" className="text-red" />
                <line x1="80" y1="50" x2="80" y2="70" stroke="currentColor" strokeWidth="2" className="text-red" />
                <line x1="160" y1="50" x2="160" y2="70" stroke="currentColor" strokeWidth="2" className="text-red" />
                {/* Clock on the wall */}
                <circle cx="120" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-navy" />
                <text x="112.5" y="9" fontSize="4" fill="currentColor" className="text-navy" fontWeight="bold">11</text>
                {/* Hour hand pointing to 11 */}
                <line x1="120" y1="12" x2="117" y2="10" stroke="currentColor" strokeWidth="1.2" className="text-navy" strokeLinecap="round" />
                {/* Minute hand pointing to 12 */}
                <line x1="120" y1="12" x2="120" y2="5" stroke="currentColor" strokeWidth="0.8" className="text-navy" strokeLinecap="round" />
                {/* Center dot */}
                <circle cx="120" cy="12" r="0.8" fill="currentColor" className="text-navy" />
                {/* Stuff piled on table */}
                <text x="95" y="49" fontSize="16">&#x1F423;</text>
                <text x="118" y="49" fontSize="14">&#x1F419;</text>
                <text x="140" y="49" fontSize="14">&#x1F994;</text>
                {/* Sad stick figure */}
                <circle cx="40" cy="22" r="6" fill="currentColor" className="text-navy" />
                {/* Frown */}
                <path d="M36,25 Q40,23 44,25" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" />
                {/* Eyes (dots) */}
                <circle cx="37" cy="21" r="0.8" fill="white" />
                <circle cx="43" cy="21" r="0.8" fill="white" />
                <line x1="40" y1="28" x2="40" y2="50" stroke="currentColor" strokeWidth="2.5" className="text-navy" />
                {/* Arms drooping down sadly */}
                <line x1="40" y1="35" x2="32" y2="48" stroke="currentColor" strokeWidth="2" className="text-navy" />
                <line x1="40" y1="35" x2="48" y2="48" stroke="currentColor" strokeWidth="2" className="text-navy" />
                {/* Legs */}
                <line x1="40" y1="50" x2="34" y2="65" stroke="currentColor" strokeWidth="2" className="text-navy" />
                <line x1="40" y1="50" x2="46" y2="65" stroke="currentColor" strokeWidth="2" className="text-navy" />
                {/* Animated tears - left eye */}
                <circle cx="36" cy="23" r="1.5" fill="#1a5a8a" style={{ animation: 'tear-fall-l 1.6s ease-in infinite' }} />
                <circle cx="36" cy="23" r="1.5" fill="#1a5a8a" style={{ animation: 'tear-fall-l 1.6s ease-in infinite 0.8s' }} />
                <circle cx="37" cy="23" r="1.3" fill="#1a5a8a" style={{ animation: 'tear-fall-l 2s ease-in infinite 0.4s' }} />
                {/* Animated tears - right eye */}
                <circle cx="44" cy="23" r="1.5" fill="#1a5a8a" style={{ animation: 'tear-fall-r 1.6s ease-in infinite 0.3s' }} />
                <circle cx="44" cy="23" r="1.5" fill="#1a5a8a" style={{ animation: 'tear-fall-r 1.6s ease-in infinite 1.1s' }} />
                <circle cx="43" cy="23" r="1.3" fill="#1a5a8a" style={{ animation: 'tear-fall-r 2s ease-in infinite 0.7s' }} />
              </svg>
            </div>
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
