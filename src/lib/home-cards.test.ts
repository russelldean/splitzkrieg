import { describe, it, expect } from 'vitest';
import { selectCardPost, cardLabels, postImage, DEFAULT_POST_IMAGE } from './home-cards';
import type { PostMeta } from './blog';

const recap = (over: Partial<PostMeta> = {}): PostMeta => ({
  title: 'Season XXXVI - Week 3 Recap',
  date: '2026-08-18',
  slug: 'season-xxxvi-week-3-recap',
  excerpt: 'Season XXXVI Week 3 recap',
  type: 'recap',
  season: 'XXXVI',
  seasonSlug: 'fall-2026',
  week: 3,
  heroImage: '/berry-week3.jpg',
  ...over,
});

const announcement = (over: Partial<PostMeta> = {}): PostMeta => ({
  title: 'Some Lines Should Not Be Crossed',
  date: '2026-08-19',
  slug: 'some-lines-shouldn-t-be-crossed',
  excerpt: 'An announcement',
  type: 'announcement',
  heroImage: '/flatliners3.webp',
  ...over,
});

const WEEK_HREF = '/week/fall-2026/3';

describe('selectCardPost', () => {
  it('returns the promoted post when it differs from the week page', () => {
    const a = announcement();
    const r = recap();
    expect(selectCardPost({ posts: [a, r], promoted: a, weekHref: WEEK_HREF })).toBe(a);
  });

  it('falls back to the recap when the promoted post IS the week page', () => {
    const r = recap();
    expect(selectCardPost({ posts: [r], promoted: r, weekHref: WEEK_HREF })).toBe(r);
  });

  it('returns the latest recap when nothing is promoted', () => {
    const a = announcement();
    const r = recap();
    expect(selectCardPost({ posts: [a, r], promoted: null, weekHref: WEEK_HREF })).toBe(r);
  });

  it('does not let an unpromoted announcement evict the recap', () => {
    // Regression: page.tsx used allPosts[0], so the newest post of ANY type won.
    const a = announcement();
    const r = recap();
    const posts = [a, r]; // announcement is newest
    expect(selectCardPost({ posts, promoted: null, weekHref: WEEK_HREF })).toBe(r);
  });

  it('returns the newest recap when several exist', () => {
    const newer = recap({ slug: 'wk3', week: 3 });
    const older = recap({ slug: 'wk2', week: 2 });
    expect(selectCardPost({ posts: [newer, older], promoted: null, weekHref: WEEK_HREF })).toBe(newer);
  });

  it('returns null when there is no recap and nothing promoted', () => {
    expect(selectCardPost({ posts: [announcement()], promoted: null, weekHref: WEEK_HREF })).toBeNull();
  });

  it('returns the promoted post when there is no week page at all', () => {
    const a = announcement();
    expect(selectCardPost({ posts: [a], promoted: a, weekHref: null })).toBe(a);
  });
});

describe('cardLabels', () => {
  it('labels a recap with its week number', () => {
    expect(cardLabels(recap())).toEqual({ badge: 'Week 3 Recap', cta: 'Read the full recap' });
  });

  it('labels a non-recap as a new post', () => {
    expect(cardLabels(announcement())).toEqual({ badge: 'New Post', cta: 'Read the post' });
  });

  it('does not render "Week undefined" for a recap with no week', () => {
    expect(cardLabels(recap({ week: undefined })).badge).toBe('New Post');
  });
});

describe('postImage', () => {
  it('prefers cardImage', () => {
    expect(postImage(recap({ cardImage: '/turkeys.jpg' }))).toBe('/turkeys.jpg');
  });

  it('falls back to heroImage', () => {
    expect(postImage(recap({ cardImage: undefined }))).toBe('/berry-week3.jpg');
  });

  it('falls back to the default when neither is set', () => {
    expect(postImage(recap({ cardImage: undefined, heroImage: undefined }))).toBe(DEFAULT_POST_IMAGE);
  });

  it('never returns an empty string', () => {
    expect(postImage(recap({ cardImage: '', heroImage: '' }))).toBeTruthy();
  });
});
