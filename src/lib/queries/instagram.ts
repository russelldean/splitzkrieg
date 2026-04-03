/**
 * Instagram feed for homepage.
 * Reads pinned photos from leagueSettings if available,
 * falls back to live API feed if no pins set.
 * Token expires after 60 days — refresh via scripts/refresh-instagram-token.mjs
 */

import { getDb } from '@/lib/db';

export interface InstagramPost {
  id: string;
  caption: string | null;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  mediaUrl: string;
  thumbnailUrl: string | null;
  permalink: string;
  timestamp: string;
}

export interface PinnedPhoto {
  id: string;
  mediaUrl: string;
  caption: string | null;
  permalink: string;
}

/** Get pinned Instagram photos from DB (for homepage). Falls back to live feed. */
export async function getInstagramFeed(limit = 3): Promise<InstagramPost[]> {
  // Try pinned photos first
  try {
    const db = await getDb();
    const result = await db.request().query<{ settingValue: string }>(
      `SELECT settingValue FROM leagueSettings WHERE settingKey = 'instagramPins'`,
    );
    const val = result.recordset[0]?.settingValue;
    if (val) {
      const { pins } = JSON.parse(val) as { pins: PinnedPhoto[] };
      if (pins && pins.length > 0) {
        return pins.map(p => ({
          id: p.id,
          caption: p.caption,
          mediaType: 'IMAGE' as const,
          mediaUrl: p.mediaUrl,
          thumbnailUrl: null,
          permalink: p.permalink,
          timestamp: '',
        }));
      }
    }
  } catch {
    // Fall through to live feed
  }

  // Fallback: live API feed
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    console.warn('INSTAGRAM_ACCESS_TOKEN not set, skipping feed');
    return [];
  }

  try {
    const res = await fetch(
      `https://graph.instagram.com/v21.0/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=${limit}&access_token=${token}`,
      { next: { revalidate: 3600 } },
    );

    if (!res.ok) {
      console.error('Instagram API error:', res.status, await res.text());
      return [];
    }

    const data = await res.json();

    return (data.data ?? []).map((post: Record<string, unknown>) => ({
      id: post.id as string,
      caption: (post.caption as string) ?? null,
      mediaType: (post.media_type as string).replace('_', '') === 'CAROUSELALBUM'
        ? 'CAROUSEL_ALBUM'
        : (post.media_type as InstagramPost['mediaType']),
      mediaUrl: (post.media_url as string) ?? '',
      thumbnailUrl: (post.thumbnail_url as string) ?? null,
      permalink: post.permalink as string,
      timestamp: post.timestamp as string,
    }));
  } catch (err) {
    console.error('Instagram feed fetch failed:', err);
    return [];
  }
}
