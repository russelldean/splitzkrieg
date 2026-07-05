import { describe, it, expect } from 'vitest';
import { shouldServeMaintenance, hasValidBypass } from './maintenance';

describe('shouldServeMaintenance', () => {
  it('does nothing when mode is not "on"', () => {
    expect(shouldServeMaintenance('/', undefined)).toBe(false);
    expect(shouldServeMaintenance('/', 'off')).toBe(false);
    expect(shouldServeMaintenance('/bowler/john-doe', 'off')).toBe(false);
  });

  it('gates public pages when mode is on', () => {
    expect(shouldServeMaintenance('/', 'on')).toBe(true);
    expect(shouldServeMaintenance('/season/spring-2026', 'on')).toBe(true);
    expect(shouldServeMaintenance('/bowler/john-doe', 'on')).toBe(true);
  });

  it('always lets admin and api through', () => {
    expect(shouldServeMaintenance('/evillair', 'on')).toBe(false);
    expect(shouldServeMaintenance('/evillair/playoffs', 'on')).toBe(false);
    expect(shouldServeMaintenance('/api/revalidate', 'on')).toBe(false);
    expect(shouldServeMaintenance('/api/cron/lineup-reminder', 'on')).toBe(false);
  });

  it('lets asset-like paths (with a file extension) through', () => {
    expect(shouldServeMaintenance('/favicon.ico', 'on')).toBe(false);
    expect(shouldServeMaintenance('/robots.txt', 'on')).toBe(false);
    expect(shouldServeMaintenance('/og.png', 'on')).toBe(false);
  });
});

describe('hasValidBypass', () => {
  it('is false when no secret is configured (bypass disabled by default)', () => {
    expect(hasValidBypass('anything', 'anything', undefined)).toBe(false);
    expect(hasValidBypass('anything', 'anything', '')).toBe(false);
  });

  it('is true when the query token matches the secret', () => {
    expect(hasValidBypass('s3cret', undefined, 's3cret')).toBe(true);
  });

  it('is true when the cookie token matches the secret', () => {
    expect(hasValidBypass(undefined, 's3cret', 's3cret')).toBe(true);
  });

  it('is false when neither token matches', () => {
    expect(hasValidBypass('wrong', 'alsowrong', 's3cret')).toBe(false);
    expect(hasValidBypass(undefined, undefined, 's3cret')).toBe(false);
  });
});
