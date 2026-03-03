import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Seasons',
  description: 'Splitzkrieg Bowling League season archives and standings.',
};

export default function SeasonsPage() {
  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-6">
          Seasons
        </h1>
        <div className="font-body text-navy/70 space-y-4 text-lg leading-relaxed">
          <p>
            35+ seasons filled with the thrill of victory and the agony of
            defeat, but you have to trust me on that because this page
            isn&rsquo;t ready yet.
          </p>
        </div>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="font-body text-sm text-navy/60 hover:text-navy transition-colors"
          >
            Back to Home
          </Link>
          <span className="hidden sm:inline text-navy/20">&middot;</span>
          <Link
            href="/bowlers"
            className="font-body text-sm text-navy/60 hover:text-navy transition-colors"
          >
            Browse All Bowlers
          </Link>
        </div>
      </div>
    </div>
  );
}
