import { describe, it, expect } from 'vitest';
import { DESTINATION_LABELS, getNextStop } from './nav-labels';

describe('getNextStop', () => {
  it('sends the week page to the season standings page', () => {
    expect(getNextStop('week', 'fall-2026')).toMatchObject({
      href: '/season/fall-2026',
      title: 'Standings & Highlights',
    });
  });

  it('sends the season page to the stats page', () => {
    expect(getNextStop('season', 'fall-2026')).toMatchObject({
      href: '/stats/fall-2026',
      title: 'Leaderboards & Stats',
    });
  });

  it('falls back to the index pages when there is no season slug', () => {
    expect(getNextStop('week', undefined)?.href).toBe('/seasons');
    expect(getNextStop('season', undefined)?.href).toBe('/stats');
  });

  it('returns null for a page with no next stop', () => {
    expect(getNextStop('nonsense', 'fall-2026')).toBe(null);
  });

  it('still routes the tail of the trail', () => {
    expect(getNextStop('stats', 'fall-2026')?.href).toBe('/milestones');
    expect(getNextStop('milestones', 'fall-2026')?.href).toBe('/stats/all-time');
  });
});

describe('label parity with the trail', () => {
  // The bug this guards: TrailNav called /season "Standings & Highlights" while
  // the Up next card called the same page "Season Standings", so one page
  // advertised two names for one destination.
  it('uses the trail label for the season destination', () => {
    expect(getNextStop('week', 'fall-2026')?.title).toBe(DESTINATION_LABELS.season);
  });

  it('uses the trail label for the stats destination', () => {
    expect(getNextStop('season', 'fall-2026')?.title).toBe(DESTINATION_LABELS.stats);
  });
});
