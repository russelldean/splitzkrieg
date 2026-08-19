import { describe, it, expect } from 'vitest';
import { shouldExpandWriteup, weekPathForPost, postHref, excerptWorthShowing, draftDestinationForPost } from './week-writeup';
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

describe('postHref', () => {
  it('sends a recap to its week page', () => {
    expect(postHref(post())).toBe('/week/fall-2026/3');
  });

  it('falls back to the blog URL for a post with no week', () => {
    expect(
      postHref(post({ type: 'announcement', seasonSlug: undefined, week: undefined, slug: 'some-post' })),
    ).toBe('/blog/some-post');
  });
});

describe('excerptWorthShowing', () => {
  it('drops an excerpt that just restates the title', () => {
    expect(
      excerptWorthShowing('Season XXXVI Week 3 recap', 'Season XXXVI - Week 3 Recap')
    ).toBe(null);
  });

  it('drops the restatement regardless of punctuation and case', () => {
    expect(excerptWorthShowing('season xxxv week 9 RECAP!', 'Season XXXV - Week 9 Recap')).toBe(null);
  });

  it('drops a null excerpt', () => {
    expect(excerptWorthShowing(null, 'Season XXXV - Week 5 Recap')).toBe(null);
  });

  it('drops a whitespace-only excerpt', () => {
    expect(excerptWorthShowing('   ', 'Season XXXV - Week 5 Recap')).toBe(null);
  });

  it('keeps an excerpt that says something the title does not', () => {
    expect(
      excerptWorthShowing('We have a website - splitzkrieg.com! ', 'This Site Built Entirely on a Brunswick 2000')
    ).toBe('We have a website - splitzkrieg.com!');
  });

  it('keeps an excerpt that extends the title rather than repeating it', () => {
    expect(
      excerptWorthShowing('Week 3 Recap: the night the Alley Cats collapsed', 'Season XXXVI - Week 3 Recap')
    ).toBe('Week 3 Recap: the night the Alley Cats collapsed');
  });

  it('drops an excerpt that is a fragment of the title', () => {
    expect(excerptWorthShowing('Week 3 Recap', 'Season XXXVI - Week 3 Recap')).toBe(null);
  });
});

describe('draftDestinationForPost', () => {
  it('sends a week-scoped draft to the admin preview route', () => {
    expect(draftDestinationForPost(post())).toBe(
      '/evillair/preview/week/fall-2026/3?slug=season-xxxvi-week-3-recap'
    );
  });

  it('encodes a slug that needs escaping', () => {
    expect(draftDestinationForPost(post({ slug: 'week 3 & 4' }))).toBe(
      '/evillair/preview/week/fall-2026/3?slug=week%203%20%26%204'
    );
  });

  it('sends an announcement to its own blog page', () => {
    expect(
      draftDestinationForPost(
        post({ type: 'announcement', season: undefined, seasonSlug: undefined, week: undefined, slug: 'some-lines' }),
      ),
    ).toBe('/blog/some-lines');
  });

  it('falls back to the blog page when the week is missing', () => {
    expect(draftDestinationForPost(post({ week: undefined }))).toBe(
      '/blog/season-xxxvi-week-3-recap'
    );
  });

  it('falls back to the blog page when the season slug is missing', () => {
    expect(draftDestinationForPost(post({ seasonSlug: undefined }))).toBe(
      '/blog/season-xxxvi-week-3-recap'
    );
  });
});
