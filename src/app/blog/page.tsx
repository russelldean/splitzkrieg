import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts } from '@/lib/blog';
import { ParallaxBg } from '@/components/ui/ParallaxBg';
import { TrailNav } from '@/components/ui/TrailNav';

export const metadata: Metadata = {
  title: 'Blog | Splitzkrieg',
  description: 'Weekly recaps, league news, and stories from Splitzkrieg Bowling League.',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function BlogPage() {
  const posts = getAllPosts();
  const [featured, ...rest] = posts;

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      {/* Parallax hero */}
      <div className="relative overflow-hidden h-60 sm:h-72 md:h-88">
        <ParallaxBg
          src="/village-lanes-group-photo.jpg"
          focalY={0.75}
          imgW={2048}
          imgH={1365}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="relative z-10 flex flex-col justify-end h-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <h1 className="font-heading text-3xl sm:text-4xl text-white drop-shadow-lg">
            The Weekly Email
          </h1>
          <p className="font-body text-sm text-white/60 mt-1">
            Recaps from the league nights, not strictly emailed anymore.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TrailNav current="/blog" position="top" />
        {posts.length === 0 ? (
          <div className="bg-white rounded-xl border border-navy/10 border-l-4 border-l-navy/30 px-8 py-12 shadow-sm text-center">
            <p className="font-body text-lg text-navy/70 leading-relaxed">
              No posts yet. Check back after the next league night.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Featured latest post — big card with hero image */}
            <Link
              href={`/blog/${featured.slug}`}
              className="group block rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-navy/10 hover:border-navy/20"
            >
              {featured.heroImage ? (
                <div className="relative h-44 sm:h-56 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={featured.heroImage}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <span className="inline-block px-2 py-0.5 text-xs font-body font-medium uppercase tracking-wide rounded bg-white/20 text-white/90 backdrop-blur-sm mb-2">
                      Latest
                    </span>
                    <h2 className="font-heading text-2xl sm:text-3xl text-white drop-shadow group-hover:text-cream transition-colors">
                      {featured.title}
                    </h2>
                    <p className="font-body text-sm text-white/70 mt-1">
                      {formatDate(featured.date)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-white">
                  <span className="inline-block px-2 py-0.5 text-xs font-body font-medium uppercase tracking-wide rounded bg-navy/10 text-navy/70 mb-3">
                    Latest
                  </span>
                  <h2 className="font-heading text-2xl text-navy group-hover:text-red transition-colors mb-2">
                    {featured.title}
                  </h2>
                  <p className="font-body text-sm text-navy/50 mb-2">
                    {formatDate(featured.date)}
                  </p>
                  <p className="font-body text-sm text-navy/70 leading-relaxed">
                    {featured.excerpt}
                  </p>
                </div>
              )}
            </Link>

            {/* Older posts — compact cards */}
            {rest.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group block bg-white rounded-xl border border-navy/10 shadow-sm hover:shadow-md hover:border-navy/20 transition-all overflow-hidden"
              >
                <div className="p-5 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-body font-medium uppercase tracking-wide rounded ${
                          post.type === 'recap'
                            ? 'bg-red/10 text-red'
                            : 'bg-navy/10 text-navy/70'
                        }`}
                      >
                        {post.type === 'recap' ? 'Recap' : 'Announcement'}
                      </span>
                      <span className="font-body text-xs text-navy/50">
                        {formatDate(post.date)}
                      </span>
                    </div>
                    <h2 className="font-heading text-lg text-navy group-hover:text-red transition-colors mb-1">
                      {post.title}
                    </h2>
                    <p className="font-body text-sm text-navy/65 leading-relaxed line-clamp-2">
                      {post.excerpt}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
