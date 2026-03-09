import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About | Splitzkrieg',
  description: 'About Splitzkrieg Bowling League - Durham, NC since 2007.',
};

export default function AboutPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-6">
        About
      </h1>

      <div className="bg-white rounded-xl border border-navy/10 border-l-4 border-l-navy/30 px-8 py-12 shadow-sm">
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

          <p>
            Nineteen years later - 6 of those original 10 teams are still in the
            league, 13 of the bowlers that showed up that first night have bowled with us
            in the past year, and we&rsquo;ve knocked down over 9 million pins. Lots more history and stories to discuss, including some that I
            rediscovered when working through this data, but those will have to wait.
          </p>

          <p>
            I&rsquo;ve been planning to make this site since 2009, and it only took me
            17 years to get to it - boom. There&rsquo;s a lot of information
            packed in here - go digging and see what you can find.  Send me any errors you
            find or any suggestions you have and I&rsquo;ll keep building this out. Most importantly, keep coming out to the lanes when you
            can - now you can see all the bowlers that are going to pass you by on
            the all-time lists if you don&rsquo;t.
          </p>

          <p>
            Deep thanks to{' '}
            <Link href="/bowler/james-hepler" className="text-red-600 hover:text-red-700 transition-colors font-medium">James Hepler</Link>,{' '}
            <Link href="/bowler/paul-marsh" className="text-red-600 hover:text-red-700 transition-colors font-medium">Paul Marsh</Link>,{' '}
            <Link href="/bowler/kristin-pearson" className="text-red-600 hover:text-red-700 transition-colors font-medium">Kristin Pearson</Link>,{' '}
            <Link href="/bowler/chris-klindt" className="text-red-600 hover:text-red-700 transition-colors font-medium">Chris Klindt</Link>,{' '}
            <Link href="/bowler/john-bekas" className="text-red-600 hover:text-red-700 transition-colors font-medium">John Bekas</Link>,{' '}
            and many more of you who help this thing keep rolling in all kinds
            of ways. And to{' '}
            <Link href="/bowler/john-williams" className="text-red-600 hover:text-red-700 transition-colors font-medium">John Williams</Link>{' '}
            again, for getting it all started.
          </p>
        </div>
      </div>
    </main>
  );
}
