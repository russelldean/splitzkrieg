import { describe, it, expect } from 'vitest';
import { shouldExpandWriteup, weekPathForPost } from './week-writeup';
import type { PostMeta } from './blog';

const post = (over: Partial<PostMeta> = {}): PostMeta => ({
  title: 'Season XXXVI - Week 3 Recap',
  date: '2026-08-18',
  slug: 'season-xxxvi-week-3-recap',
  excerpt: 'Season XXXVI Week 3 recap',
  type: 'recap',
  season: 'XXXVI',
  seasonSlug: 'fall-2026',
  week: 3,
  ...over,
});

describe('shouldExpandWriteup', () => {
  it('expands when the post is in the current season', () => {
    expect(shouldExpandWriteup('fall-2026', 'fall-2026')).toBe(true);
  });

  it('collapses when the post is in a past season', () => {
    expect(shouldExpandWriteup('spring-2026', 'fall-2026')).toBe(false);
  });

  it('expands when the current season is unknown, so nothing hides by accident', () => {
    expect(shouldExpandWriteup('fall-2026', undefined)).toBe(true);
  });

  it('collapses when the post has no season slug', () => {
    expect(shouldExpandWriteup(undefined, 'fall-2026')).toBe(false);
  });
});

describe('weekPathForPost', () => {
  it('maps a recap to its week page', () => {
    expect(weekPathForPost(post())).toBe('/week/fall-2026/3');
  });

  it('maps a recap with a custom slug to its week page', () => {
    expect(
      weekPathForPost(
        post({ slug: 'this-site-built-entirely-on-a-brunswick-2000', seasonSlug: 'spring-2026', week: 4 }),
      ),
    ).toBe('/week/spring-2026/4');
  });

  it('returns null for an announcement with no week', () => {
    expect(
      weekPathForPost(
        post({ type: 'announcement', season: undefined, seasonSlug: undefined, week: undefined }),
      ),
    ).toBeNull();
  });

  it('returns null when the week is present but the season slug is not', () => {
    expect(weekPathForPost(post({ seasonSlug: undefined }))).toBeNull();
  });

  it('treats week 0 as a real week', () => {
    expect(weekPathForPost(post({ week: 0 }))).toBe('/week/fall-2026/0');
  });
});
