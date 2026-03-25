import Link from 'next/link';
import type { PostMeta } from '@/lib/blog';
import type { SiteUpdateEntry } from '@/lib/queries/updates';
import { ParallaxBg } from '@/components/ui/ParallaxBg';
import { SiteUpdates } from '@/components/resources/SiteUpdates';

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
  updates?: SiteUpdateEntry[];
}

export function BlogPostLayout({ meta, prev, next, children, updates }: BlogPostLayoutProps) {
  const hasHero = !!meta.heroImage;

  return (
    <main>
      {/* Parallax Hero (when post has heroImage) */}
      {hasHero && (
        <div className="relative overflow-hidden h-52 sm:h-64 md:h-80">
          <ParallaxBg
            src={meta.heroImage!}
            focalY={meta.heroFocalY ?? 0.5}
            imgW={4032}
            imgH={3024}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="relative z-10 flex flex-col justify-end h-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
            {/* Back link */}
            <Link
              href="/blog"
              className="inline-flex items-center gap-1 font-body text-sm text-white/60 hover:text-white transition-colors mb-3 w-fit"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              All Posts
            </Link>
            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl text-white drop-shadow-lg leading-tight">
              {meta.title}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="font-body text-sm text-white/70">
                {formatDate(meta.date)}
              </span>
              {meta.season && meta.week != null && meta.seasonSlug && (
                <>
                  <span className="text-white/30">&middot;</span>
                  <Link
                    href={`/week/${meta.seasonSlug}/${meta.week}`}
                    className="font-body text-sm text-white/70 hover:text-white transition-colors"
                  >
                    Season {meta.season} &middot; Week {meta.week}
                    <span className="text-white/40 ml-1">(jump to results)</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Standard header (no hero image) */}
        {!hasHero && (
          <>
            <Link
              href="/blog"
              className="inline-flex items-center gap-1 font-body text-sm text-navy/50 hover:text-navy transition-colors mb-6"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              All Posts
            </Link>
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
              {meta.season && meta.week != null && meta.seasonSlug && (
                <Link
                  href={`/week/${meta.seasonSlug}/${meta.week}`}
                  className="text-sm font-heading text-navy/50 uppercase tracking-wider hover:text-red-600 transition-colors"
                >
                  Season {meta.season} &middot; Week {meta.week}
                  <span className="font-body normal-case tracking-normal text-navy/35 ml-1">(jump to results)</span>
                </Link>
              )}
            </header>
            <div className="h-px bg-gradient-to-r from-transparent via-navy/15 to-transparent mb-6" />
          </>
        )}

        {/* MDX content — blog prose */}
        <article className="blog-prose [&>.week-recap]:mt-12">
          {children}
        </article>

        {/* Divider */}
        <div className="mt-14 border-t-2 border-navy/20" />

        {/* Prev/next navigation */}
        <nav className="flex justify-between gap-4 my-8">
          {next ? (
            <Link
              href={`/blog/${next.slug}`}
              className="group flex-1 min-w-0"
            >
              <div className="flex items-center gap-3">
                {(next.cardImage || next.heroImage) && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-navy/10">
                    <img
                      src={next.cardImage || next.heroImage}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <span className="font-body text-xs text-navy/60 uppercase tracking-wide">
                    Previous
                  </span>
                  <span className="block font-heading text-base text-navy group-hover:text-red transition-colors truncate">
                    {next.title}
                  </span>
                </div>
              </div>
            </Link>
          ) : (
            <div className="flex-1" />
          )}

          {prev ? (
            <Link
              href={`/blog/${prev.slug}`}
              className="group flex-1 min-w-0"
            >
              <div className="flex items-center gap-3 justify-end">
                <div className="min-w-0 text-right">
                  <span className="font-body text-xs text-navy/60 uppercase tracking-wide">
                    Next
                  </span>
                  <span className="block font-heading text-base text-navy group-hover:text-red transition-colors truncate">
                    {prev.title}
                  </span>
                </div>
                {(prev.cardImage || prev.heroImage) && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-navy/10">
                    <img
                      src={prev.cardImage || prev.heroImage}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
              </div>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
        </nav>

        {updates && updates.length > 0 && (
          <>
            <div className="border-t-2 border-navy/20 mb-8" />
            <section>
              <SiteUpdates updates={updates} lastUpdated={updates[0].date} />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
