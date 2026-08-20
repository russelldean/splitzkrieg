import { describe, it, expect } from 'vitest';
import { recapSlug, recapTitle } from './recap-naming';

// These must match the posts already in the database, because the build-time
// redirect map keys on the slug. A mismatch silently breaks that week's link in
// every weekly email.
describe('recapSlug', () => {
  it('matches the stored slug for season XXXVI week 3', () => {
    expect(recapSlug('XXXVI', 3)).toBe('season-xxxvi-week-3-recap');
  });

  it('matches the stored slug for season XXXV week 9', () => {
    expect(recapSlug('XXXV', 9)).toBe('season-xxxv-week-9-recap');
  });

  it('lowercases the roman numeral', () => {
    expect(recapSlug('XL', 1)).toBe('season-xl-week-1-recap');
  });

  it('does not zero pad the week', () => {
    expect(recapSlug('XXXVI', 10)).toBe('season-xxxvi-week-10-recap');
  });
});

describe('recapTitle', () => {
  it('matches the stored title for season XXXVI week 3', () => {
    expect(recapTitle('XXXVI', 3)).toBe('Season XXXVI - Week 3 Recap');
  });

  it('uses a hyphen, never an em dash', () => {
    // The project bans em dashes site wide. Written as an escape rather than the
    // literal character so the em dash checker does not flag this assertion.
    expect(recapTitle('XXXV', 9)).not.toMatch(/\u2014/);
    expect(recapTitle('XXXV', 9)).toBe('Season XXXV - Week 9 Recap');
  });
});
