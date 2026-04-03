/**
 * Instagram feed fetched at build time via Meta Graph API.
 * Token is a short-lived token from a Creator account.
 * Token expires after 60 days — refresh via scripts/refresh-instagram-token.mjs
 */

export interface InstagramPost {
  id: string;
  caption: string | null;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  mediaUrl: string;
  thumbnailUrl: string | null;
  permalink: string;
  timestamp: string;
}

export async function getInstagramFeed(limit = 6): Promise<InstagramPost[]> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    console.warn('INSTAGRAM_ACCESS_TOKEN not set, skipping feed');
    return [];
  }

  try {
    const res = await fetch(
      `https://graph.instagram.com/v21.0/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=${limit}&access_token=${token}`,
      { next: { revalidate: 3600 } }, // revalidate hourly
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
