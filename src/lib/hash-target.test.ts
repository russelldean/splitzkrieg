import { describe, it, expect } from 'vitest';
import { targetIdFromHash } from './hash-target';

describe('targetIdFromHash', () => {
  it('reads the id out of a normal fragment', () => {
    expect(targetIdFromHash('#results')).toBe('results');
  });

  it('accepts a value with no leading hash', () => {
    expect(targetIdFromHash('results')).toBe('results');
  });

  it('is null for an empty hash', () => {
    expect(targetIdFromHash('')).toBeNull();
  });

  it('is null for a bare hash', () => {
    expect(targetIdFromHash('#')).toBeNull();
  });

  it('decodes a percent encoded fragment', () => {
    expect(targetIdFromHash('#match%20results')).toBe('match results');
  });

  it('falls back to the raw value on a malformed escape rather than throwing', () => {
    // Throwing here would surface inside a useEffect and break the page.
    expect(targetIdFromHash('#100%')).toBe('100%');
  });
});
