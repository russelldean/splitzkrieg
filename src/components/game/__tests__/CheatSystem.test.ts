import { describe, it, expect } from 'vitest';
import { CheatSystem } from '../CheatSystem';
import { CHEAT_POOL } from '../cheats';

describe('CHEAT_POOL registry', () => {
  it('contains at least 10 cheats', () => {
    expect(CHEAT_POOL.length).toBeGreaterThanOrEqual(10);
  });

  it('contains at least 1 cheat per tier (1, 2, 3, 4)', () => {
    for (const tier of [1, 2, 3, 4] as const) {
      const cheatsInTier = CHEAT_POOL.filter(c => c.tier === tier);
      expect(cheatsInTier.length, `tier ${tier} should have at least 1 cheat`).toBeGreaterThanOrEqual(1);
    }
  });

  it('contains at least 1 cheat per category (physics, character, bowling)', () => {
    for (const category of ['physics', 'character', 'bowling'] as const) {
      const cheatsInCategory = CHEAT_POOL.filter(c => c.category === category);
      expect(cheatsInCategory.length, `category ${category} should have at least 1 cheat`).toBeGreaterThanOrEqual(1);
    }
  });

  it('every cheat has a non-empty caption string', () => {
    for (const cheat of CHEAT_POOL) {
      expect(cheat.caption, `cheat ${cheat.id} should have a caption`).toBeTruthy();
      expect(typeof cheat.caption).toBe('string');
      expect(cheat.caption.length).toBeGreaterThan(0);
    }
  });

  it('every cheat has required properties', () => {
    for (const cheat of CHEAT_POOL) {
      expect(cheat.id).toBeTruthy();
      expect(cheat.name).toBeTruthy();
      expect([1, 2, 3, 4]).toContain(cheat.tier);
      expect(['physics', 'character', 'bowling']).toContain(cheat.category);
      expect(cheat.duration).toBeGreaterThan(0);
      expect(typeof cheat.execute).toBe('function');
    }
  });
});

describe('CheatSystem', () => {
  it('selectCheat(tier=1) returns a tier 1 cheat', () => {
    const system = new CheatSystem();
    const cheat = system.selectCheat(1);
    expect(cheat.tier).toBe(1);
  });

  it('selectCheat(tier=2) returns a cheat from tier 1 or 2', () => {
    const system = new CheatSystem();
    // Run multiple times to check range
    for (let i = 0; i < 20; i++) {
      const cheat = system.selectCheat(2);
      expect(cheat.tier).toBeLessThanOrEqual(2);
    }
  });

  it('selectCheat(tier=3) returns a cheat from tiers 1-3', () => {
    const system = new CheatSystem();
    for (let i = 0; i < 20; i++) {
      const cheat = system.selectCheat(3);
      expect(cheat.tier).toBeLessThanOrEqual(3);
    }
  });

  it('selectCheat(tier=4) returns a cheat from tiers 1-4', () => {
    const system = new CheatSystem();
    for (let i = 0; i < 20; i++) {
      const cheat = system.selectCheat(4);
      expect(cheat.tier).toBeLessThanOrEqual(4);
    }
  });

  it('does not repeat the same cheat two throws in a row', () => {
    const system = new CheatSystem();
    let lastId: string | null = null;
    // Run many times at tier 4 (full pool) to stress the no-repeat logic
    for (let i = 0; i < 50; i++) {
      const cheat = system.selectCheat(4);
      if (lastId !== null) {
        expect(cheat.id, `cheat should not repeat: ${cheat.id}`).not.toBe(lastId);
      }
      lastId = cheat.id;
    }
  });

  it('weights toward higher tiers at tier 3+', () => {
    const system = new CheatSystem();
    const tierCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    const runs = 300;
    for (let i = 0; i < runs; i++) {
      const cheat = system.selectCheat(3);
      tierCounts[cheat.tier]++;
    }
    // Tier 3 should appear more often than tier 1 due to weighting
    expect(tierCounts[3]).toBeGreaterThan(tierCounts[1]);
  });
});
