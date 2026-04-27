/**
 * GET /api/evillair/instagram/browse
 * Fetches recent Instagram posts with carousel expansion for admin photo picker.
 * Returns all individual images from recent posts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

interface InstagramMedia {
  id: string;
  mediaUrl: string;
  caption: string | null;
  permalink: string;
  timestamp: string;
  parentId: string | null;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'INSTAGRAM_ACCESS_TOKEN not configured' }, { status: 500 });
  }

  try {
    // Fetch recent posts
    const res = await fetch(
      `https://graph.instagram.com/v21.0/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}&limit=12&access_token=${token}`,
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Instagram API error: ${text}` }, { status: 502 });
    }

    const data = await res.json();
    const photos: InstagramMedia[] = [];

    for (const post of data.data ?? []) {
      const caption = post.caption ?? null;
      const permalink = post.permalink;
      const timestamp = post.timestamp;

      if (post.media_type === 'CAROUSEL_ALBUM' && post.children?.data) {
        // Expand carousel — include all image children
        for (const child of post.children.data) {
          if (child.media_type === 'IMAGE') {
            photos.push({
              id: child.id,
              mediaUrl: child.media_url,
              caption,
              permalink,
              timestamp,
              parentId: post.id,
            });
          }
        }
      } else if (post.media_type === 'IMAGE') {
        photos.push({
          id: post.id,
          mediaUrl: post.media_url,
          caption,
          permalink,
          timestamp,
          parentId: null,
        });
      } else if (post.media_type === 'VIDEO' && post.thumbnail_url) {
        photos.push({
          id: post.id,
          mediaUrl: post.thumbnail_url,
          caption,
          permalink,
          timestamp,
          parentId: null,
        });
      }
    }

    return NextResponse.json({ photos });
  } catch (err) {
    console.error('Instagram browse error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch Instagram photos' },
      { status: 500 },
    );
  }
}
