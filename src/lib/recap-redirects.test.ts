import { describe, it, expect } from 'vitest';
import { recapRedirectsFrom } from './recap-redirects';

describe('recapRedirectsFrom', () => {
  it('sends a week-scoped post to its week page', () => {
    expect(
      recapRedirectsFrom([{ slug: 'season-xxxvi-week-3-recap', seasonSlug: 'fall-2026', week: 3 }])
    ).toEqual([
      { source: '/blog/season-xxxvi-week-3-recap', destination: '/week/fall-2026/3', permanent: false },
    ]);
  });

  it('handles a recap whose slug does not look like a recap', () => {
    // postID 1 is a real recap with a custom slug. Pattern matching the slug
    // would miss it, which is why this comes from the database.
    expect(
      recapRedirectsFrom([{ slug: 'brunswick-2000', seasonSlug: 'spring-2026', week: 4 }])
    ).toEqual([
      { source: '/blog/brunswick-2000', destination: '/week/spring-2026/4', permanent: false },
    ]);
  });

  it('skips a post with no week', () => {
    expect(recapRedirectsFrom([{ slug: 'some-lines', seasonSlug: 'fall-2026', week: null }])).toEqual([]);
  });

  it('skips a post with no season slug', () => {
    expect(recapRedirectsFrom([{ slug: 'some-lines', seasonSlug: null, week: 3 }])).toEqual([]);
  });

  it('keeps week 0 rather than treating it as missing', () => {
    expect(
      recapRedirectsFrom([{ slug: 'wk0', seasonSlug: 'fall-2026', week: 0 }])
    ).toEqual([
      { source: '/blog/wk0', destination: '/week/fall-2026/0', permanent: false },
    ]);
  });

  it('drops a post with an empty slug rather than emitting /blog/', () => {
    expect(recapRedirectsFrom([{ slug: '', seasonSlug: 'fall-2026', week: 3 }])).toEqual([]);
  });

  it('is never permanent, so a recap can be moved back without poisoning caches', () => {
    const [entry] = recapRedirectsFrom([
      { slug: 'season-xxxvi-week-3-recap', seasonSlug: 'fall-2026', week: 3 },
    ]);
    expect(entry.permanent).toBe(false);
  });

  it('maps a whole set at once', () => {
    const out = recapRedirectsFrom([
      { slug: 'a', seasonSlug: 'fall-2026', week: 1 },
      { slug: 'b', seasonSlug: null, week: 2 },
      { slug: 'c', seasonSlug: 'fall-2026', week: 3 },
    ]);
    expect(out.map((r) => r.source)).toEqual(['/blog/a', '/blog/c']);
  });
});
