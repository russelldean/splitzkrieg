import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About | Splitzkrieg',
  description: 'About Splitzkrieg Bowling League - Durham, NC since 2007.',
};

export default function AboutPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy mb-6">
        About
      </h1>

      <div className="bg-navy/[0.03] rounded-xl px-8 py-12">
        <div className="font-body text-lg text-navy/70 leading-relaxed space-y-3">
          <p>
            Splitzkrieg began in March 2007 when{' '}
            <Link href="/bowler/john-williams" className="text-red-600 hover:text-red-700 transition-colors font-medium">
              John Williams
            </Link>{' '}
            invited 40 people out to Village Lanes to try and start a league.
          </p>
          <p>We bowl at Bowlero now.</p>
          <p>We are full at the moment but teams are always looking for subs.</p>
          <p>Bowling skill is not mandatory.</p>
          <p>More to come.</p>
        </div>
      </div>
    </main>
  );
}
