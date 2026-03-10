import Link from 'next/link';
import type { PostMeta } from '@/lib/blog';

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

interface BlogPostLayoutProps {
  meta: PostMeta;
  prev: PostMeta | null;
  next: PostMeta | null;
  children: React.ReactNode;
}

export function BlogPostLayout({ meta, prev, next, children }: BlogPostLayoutProps) {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Back to blog */}
      <Link
        href="/blog"
        className="inline-flex items-center gap-1 font-body text-sm text-navy/50 hover:text-navy transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        All Posts
      </Link>

      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span
            className={`inline-block px-2 py-0.5 text-xs font-body font-medium uppercase tracking-wide rounded ${
              meta.type === 'recap'
                ? 'bg-red/10 text-red'
                : 'bg-navy/10 text-navy/70'
            }`}
          >
            {meta.type === 'recap' ? 'Recap' : 'Announcement'}
          </span>
          <span className="font-body text-sm text-navy/50">
            {formatDate(meta.date)}
          </span>
        </div>

        <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-2">
          {meta.title}
        </h1>

        {/* Season/week context cross-link */}
        {meta.season && meta.seasonSlug && meta.week != null && (
          <p className="font-body text-sm text-navy/60">
            <Link
              href={`/week/${meta.seasonSlug}/${meta.week}`}
              className="text-red-600 hover:text-red-700 underline"
            >
              Season {meta.season} Week {meta.week} Results
            </Link>
          </p>
        )}
      </header>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-navy/15 to-transparent mb-8" />

      {/* MDX content */}
      <article className="prose-splitzkrieg">
        {children}
      </article>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-navy/15 to-transparent mt-12 mb-8" />

      {/* Prev/next navigation */}
      <nav className="flex justify-between gap-4">
        {prev ? (
          <Link
            href={`/blog/${prev.slug}`}
            className="group flex-1 min-w-0"
          >
            <span className="font-body text-xs text-navy/40 uppercase tracking-wide">
              Newer
            </span>
            <span className="block font-heading text-base text-navy group-hover:text-red transition-colors truncate">
              {prev.title}
            </span>
          </Link>
        ) : (
          <div className="flex-1" />
        )}

        {next ? (
          <Link
            href={`/blog/${next.slug}`}
            className="group flex-1 min-w-0 text-right"
          >
            <span className="font-body text-xs text-navy/40 uppercase tracking-wide">
              Older
            </span>
            <span className="block font-heading text-base text-navy group-hover:text-red transition-colors truncate">
              {next.title}
            </span>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
      </nav>
    </main>
  );
}
