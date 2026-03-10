import Link from 'next/link';
import type { PostMeta } from '@/lib/blog';

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function BlogPostCard({ post }: { post: PostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block bg-white rounded-xl border border-navy/10 shadow-sm hover:shadow-md hover:border-navy/20 transition-all overflow-hidden"
    >
      <div className="p-6">
        {/* Type badge + date */}
        <div className="flex items-center gap-3 mb-3">
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

        {/* Title */}
        <h2 className="font-heading text-xl text-navy group-hover:text-red transition-colors mb-1">
          {post.title}
        </h2>

        {/* Season/week subtitle for recaps */}
        {post.type === 'recap' && post.season && post.week != null && (
          <p className="font-body text-sm text-navy/50 mb-2">
            Season {post.season} Week {post.week}
          </p>
        )}

        {/* Excerpt */}
        <p className="font-body text-sm text-navy/70 leading-relaxed">
          {post.excerpt}
        </p>
      </div>
    </Link>
  );
}
