import { describe, it, expect } from 'vitest';
import { tags } from './cache-tags';

describe('cache-tags', () => {
  it('builds channel + entity tags', () => {
    expect(tags.scoresForSeason(36)).toBe('scores-36');
    expect(tags.scheduleForSeason(36)).toBe('schedule-36');
    expect(tags.bowler(297)).toBe('bowler-297');
    expect(tags.team(12)).toBe('team-12');
    expect(tags.season(36)).toBe('season-36');
  });

  it('exposes coarse channel tags for cross-season queries', () => {
    expect(tags.scoresAll).toBe('scores');
    expect(tags.scheduleAll).toBe('schedule');
    expect(tags.playoffsAll).toBe('playoffs');
  });

  it('builds per-season playoff tags and the current-season pointer', () => {
    expect(tags.playoffsForSeason(36)).toBe('playoffs-36');
    expect(tags.currentSeasonPointer).toBe('current-season');
  });
});
