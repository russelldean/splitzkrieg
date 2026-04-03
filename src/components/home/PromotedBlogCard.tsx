import Link from 'next/link';
import Image from 'next/image';
import type { PostMeta } from '@/lib/blog';

interface Props {
  post: PostMeta;
}

export function PromotedBlogCard({ post }: Props) {
  const image = post.cardImage || post.heroImage;

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block rounded-xl overflow-hidden shadow-md ring-1 ring-navy/10 hover:shadow-lg transition-shadow"
    >
      {/* Mobile: image with overlay text */}
      <div className="relative sm:hidden">
        {image && (
          <div className="relative w-full h-32 overflow-hidden">
            <Image
              src={image}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-heading uppercase tracking-wider bg-red-600 text-white">
                  New Post
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-heading text-base text-white group-hover:text-red-300 transition-colors line-clamp-1">
                  {post.title.replace(/^Season\s+/, '')}
                </h3>
                <span className="font-body text-xs text-white/70 group-hover:text-white transition-colors whitespace-nowrap flex-shrink-0">
                  Read &rarr;
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop: side-by-side layout */}
      <div className="hidden sm:flex flex-row bg-white">
        {image && (
          <div className="relative w-48 h-auto flex-shrink-0 overflow-hidden">
            <Image
              src={image}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="192px"
            />
          </div>
        )}
        <div className="p-5 flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-heading uppercase tracking-wider bg-red-600 text-white">
              New Post
            </span>
            <span className="font-body text-xs text-navy/50">
              {new Date(post.date + 'T12:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <h3 className="font-heading text-lg text-navy group-hover:text-red-700 transition-colors line-clamp-1">
            {post.title}
          </h3>
          {post.excerpt && (
            <p className="font-body text-sm text-navy/70 mt-1 line-clamp-2">
              {post.excerpt}
            </p>
          )}
          <span className="font-body text-xs text-red-600/80 mt-2 group-hover:text-red-700 transition-colors">
            Read more &rarr;
          </span>
        </div>
      </div>
    </Link>
  );
}
