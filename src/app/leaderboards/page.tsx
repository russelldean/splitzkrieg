import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboards',
  description: 'All-time Splitzkrieg Bowling League leaderboards and records.',
};

export default function LeaderboardsPage() {
  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-6">
          Leaderboards
        </h1>
        <div className="font-body text-navy/70 space-y-4 text-lg leading-relaxed">
          <p>
            Who has the highest career average? Who is going to make the
            playoffs this year? What team had the best night ever?
          </p>
          <p>
            These answers exist, but they are not on this page yet.
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
