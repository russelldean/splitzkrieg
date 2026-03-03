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
            Yes, we have teams. Yes, they have names like &ldquo;Gutter
            Sluts&rdquo; and &ldquo;Pin Pals.&rdquo; No, this page is not ready
            yet.
          </p>
          <p>
            But it will be. And when it is, you&rsquo;ll see every roster, every
            rivalry, every time someone jumped ship to a better team.
          </p>
          <p className="text-navy/40">Check back soon.</p>
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
