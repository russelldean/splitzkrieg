'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { InstagramPost } from '@/lib/queries/instagram';

interface Props {
  posts: InstagramPost[];
}

function StripPhoto({ post }: { post: InstagramPost }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="relative flex-1 min-w-0 aspect-square rounded-lg overflow-hidden group"
    >
      <Image
        src={post.mediaType === 'VIDEO' ? (post.thumbnailUrl || post.mediaUrl) : post.mediaUrl}
        alt={post.caption?.slice(0, 100) || 'Instagram post'}
        fill
        className="object-cover group-hover:scale-105 transition-transform duration-300"
        sizes="(max-width: 768px) 33vw, 200px"
        onError={() => setFailed(true)}
        unoptimized
      />
    </a>
  );
}

export function InstagramStrip({ posts }: Props) {
  if (posts.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <a
          href="https://www.instagram.com/splitzkriegbowlingleague/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-xs text-navy/50 hover:text-red-600 transition-colors flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
          </svg>
          @splitzkriegbowlingleague
        </a>
      </div>
      <div className="flex gap-2 sm:gap-3">
        {posts.map((post) => (
          <StripPhoto key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
