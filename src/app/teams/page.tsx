import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Teams',
  description: 'Splitzkrieg Bowling League team profiles and rosters.',
};

export default function TeamsPage() {
  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-6">
          Teams
        </h1>
        <div className="font-body text-navy/70 space-y-4 text-lg leading-relaxed">
          <p>
            Yes, we have teams. No, this page is not ready yet.
          </p>
          <p>
            This page is pincomplete. It&rsquo;s sparely here.
            It&rsquo;s gutter desolation.
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
