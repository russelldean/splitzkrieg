import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { ParallaxBg } from '@/components/ui/ParallaxBg';
import { getDataCompleteness } from '@/lib/queries/seasons/core';

export const metadata: Metadata = {
  title: 'About | Splitzkrieg',
  description: 'About Splitzkrieg Bowling League - Durham, NC since 2007.',
};

export default async function AboutPage() {
  const data = await getDataCompleteness();

  const weeksPct = data.totalNights > 0 ? ((data.nightsWithData / data.totalNights) * 100).toFixed(1) : '0';

  return (
    <main>
      {/* Parallax Hero — Village Lanes exterior */}
      <div className="relative overflow-hidden h-56 sm:h-72 md:h-80">
        <ParallaxBg src="/village-lanes-outside.jpg" focalY={0.5} imgW={1440} imgH={1080} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="relative z-10 flex items-end h-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <h1 className="font-heading text-4xl sm:text-5xl text-white drop-shadow-lg">
            About
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="font-body text-lg text-navy/70 leading-relaxed space-y-6">
          <p>
            In March 2007,{' '}
            <Link href="/bowler/john-williams" className="text-red-600 hover:text-red-700 transition-colors font-medium">
              John Williams
            </Link>{' '}
            invited 40 people out to Village Lanes to try and start a bowling league.
          </p>

          <p>
            We had the Splitzkrieg name, 10 teams, no rulebook, and we scheduled by telling people the next
            league night would be in three or four weeks and we&rsquo;d let them know.
            You could still smoke in the alley, but it was considered polite to stand
            back a bit, instead of smoking right there at the seats. We started at 7:15
            and a large chunk of the league went out drinking after bowling, because time
            didn&rsquo;t work the same way.{' '}
            <Link href="/bowler/mirla-del-rosario" className="text-red-600 hover:text-red-700 transition-colors font-medium">
              Mirla del Rosario
            </Link>{' '}
            bowled the league&rsquo;s first 200 game at the end of the season and there
            was no end of season party.
          </p>

          {/* Inline console photo — the old scoring machine */}
          <figure className="my-8">
            <div className="rounded-xl overflow-hidden shadow-md">
              <Image
                src="/village-lanes-console.jpg"
                alt="The original Village Lanes scoring console - NO FOOD, DRINKS, CIGARETTES OR ASHTRAYS ALLOWED ON SCORING CONSOLE"
                width={2048}
                height={1536}
                className="w-full h-auto"
              />
            </div>
          </figure>

          <p>
            Nineteen years later - 6 of those original 10 teams are still in the
            league, 13 of the bowlers that showed up that first night have bowled with us
            in the past year, and we&rsquo;ve knocked down over 9 million pins. Lots more history and stories to discuss, including some that I
            rediscovered when working through this data, but those will have to wait.
          </p>

          <p>
            I&rsquo;ve been planning to make this site since 2009, and it only took me
            17 years and a bit of unemployment to get to it - boom. There&rsquo;s a lot of information
            packed in here - go digging and see what you can find.  Send me any errors you
            find or any suggestions you have and I&rsquo;ll keep building this out. Your job is to keep coming out to the lanes when you
            can - now you can see all the bowlers that are going to pass you by on
            the all-time lists if you don&rsquo;t.
          </p>

          {/* Group photo */}
          <figure className="my-8">
            <div className="rounded-xl overflow-hidden shadow-md">
              <Image
                src="/village-lanes-group-photo.jpg"
                alt="Splitzkrieg Bowling League group photo in front of Village Lanes"
                width={2048}
                height={1365}
                className="w-full h-auto"
              />
            </div>
          </figure>

          <p>
            Deep thanks to{' '}
            <Link href="/bowler/james-hepler" className="text-red-600 hover:text-red-700 transition-colors font-medium">James Hepler</Link>,{' '}
            <Link href="/bowler/paul-marsh" className="text-red-600 hover:text-red-700 transition-colors font-medium">Paul Marsh</Link>,{' '}
            <Link href="/bowler/kristin-pearson" className="text-red-600 hover:text-red-700 transition-colors font-medium">Kristin Pearson</Link>,{' '}
            <Link href="/bowler/chris-klindt" className="text-red-600 hover:text-red-700 transition-colors font-medium">Chris Klindt</Link>,{' '}
            <Link href="/bowler/john-bekas" className="text-red-600 hover:text-red-700 transition-colors font-medium">John Bekas</Link>,{' '}
            and many more of you who help this thing keep rolling in all kinds
            of ways.
          </p>

          <p>
            And to{' '}
            <Link href="/village-lanes" className="text-red-600 hover:text-red-700 transition-colors font-medium">Village Lanes</Link>,
            for being the star of the show for all those years.
          </p>
        </div>

        {/* Data Completeness */}
        <div className="mt-12 pt-8 border-t border-navy/10">
          <h2 className="font-heading text-2xl text-navy mb-4">Data Completeness</h2>
          <div className="bg-navy/5 rounded-lg p-4 max-w-sm mb-6">
            <div className="text-3xl font-heading text-navy">{data.nightsWithData}<span className="text-lg text-navy/40">/{data.totalNights}</span></div>
            <div className="text-sm text-navy/50 mt-1">League nights with score data</div>
            <div className="mt-2 w-full bg-navy/10 rounded-full h-2">
              <div className="bg-red-600 h-2 rounded-full" style={{ width: `${weeksPct}%` }} />
            </div>
            <div className="text-xs text-navy/40 mt-1">{weeksPct}%</div>
          </div>
          {data.missingWeeks.length > 0 && (
            <div className="text-sm text-navy/50">
              <span className="font-medium text-navy/60">Missing from archive:</span>{' '}
              {data.missingWeeks.join(', ')}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
