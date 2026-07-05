import { describe, it, expect } from 'vitest';
import { shouldServeMaintenance } from './maintenance';

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
