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
      className="group block bg-navy rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow"
    >
      <div>
        {/* Full-width image banner */}
        {image && (
          <div className="overflow-hidden">
            <Image
              src={image}
              alt={post.title}
              width={960}
              height={540}
              className="w-full h-auto group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}

        {/* Content below image */}
        <div className="px-5 pb-5 pt-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-heading uppercase tracking-wider bg-red-600 text-white">
              New Post
            </span>
            <span className="font-body text-xs text-white/50">
              {new Date(post.date + 'T12:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <h3 className="font-heading text-xl sm:text-2xl text-white group-hover:text-red-300 transition-colors">
            {post.title}
          </h3>
          {post.excerpt && (
            <p className="font-body text-sm text-white/65 mt-1 line-clamp-2">
              {post.excerpt}
            </p>
          )}
          <span className="inline-block font-body text-xs text-red-400 mt-3 group-hover:text-red-300 transition-colors">
            Read more &rarr;
          </span>
        </div>
      </div>
    </Link>
  );
}
