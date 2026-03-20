import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  transitionState,
  shouldWin,
  advanceTier,
} from '../GameState';
import type { GameState } from '../types';

describe('createInitialState', () => {
  it('returns state with correct defaults', () => {
    const state = createInitialState();
    expect(state.phase).toBe('demo');
    expect(state.attempt).toBe(0);
    expect(state.maxAttempts).toBe(10);
    expect(state.tier).toBe(1);
    expect(state.throwsInTier).toBe(0);
    expect(state.cheatsEncountered).toEqual([]);
    expect(state.isAdmin).toBe(false);
    expect(state.activeSkin).toBe('vector');
  });

  it('accepts isAdmin parameter', () => {
    const state = createInitialState(true);
    expect(state.isAdmin).toBe(true);
  });
});

describe('transitionState', () => {
  it('demo + start -> idle', () => {
    const state = createInitialState();
    const next = transitionState(state, 'start');
    expect(next.phase).toBe('idle');
  });

  it('idle + pointerdown -> aiming', () => {
    const state = { ...createInitialState(), phase: 'idle' as const };
    const next = transitionState(state, 'pointerdown');
    expect(next.phase).toBe('aiming');
  });

  it('aiming + release -> rolling', () => {
    const state = { ...createInitialState(), phase: 'aiming' as const };
    const next = transitionState(state, 'release');
    expect(next.phase).toBe('rolling');
  });

  it('rolling + cheat -> cheat', () => {
    const state = { ...createInitialState(), phase: 'rolling' as const };
    const next = transitionState(state, 'cheat');
    expect(next.phase).toBe('cheat');
  });

  it('rolling + win -> win', () => {
    const state = { ...createInitialState(), phase: 'rolling' as const };
    const next = transitionState(state, 'win');
    expect(next.phase).toBe('win');
  });

  it('cheat + replay -> replay', () => {
    const state = { ...createInitialState(), phase: 'cheat' as const };
    const next = transitionState(state, 'replay');
    expect(next.phase).toBe('replay');
  });

  it('cheat + skip -> result', () => {
    const state = { ...createInitialState(), phase: 'cheat' as const };
    const next = transitionState(state, 'skip');
    expect(next.phase).toBe('result');
  });

  it('replay + done -> result', () => {
    const state = { ...createInitialState(), phase: 'replay' as const };
    const next = transitionState(state, 'done');
    expect(next.phase).toBe('result');
  });

  it('result + next -> idle when attempt < maxAttempts', () => {
    const state: GameState = { ...createInitialState(), phase: 'result', attempt: 3 };
    const next = transitionState(state, 'next');
    expect(next.phase).toBe('idle');
  });

  it('result + next -> scorecard when attempt >= maxAttempts', () => {
    const state: GameState = { ...createInitialState(), phase: 'result', attempt: 10 };
    const next = transitionState(state, 'next');
    expect(next.phase).toBe('scorecard');
  });

  it('invalid event returns current phase unchanged', () => {
    const state = createInitialState();
    const next = transitionState(state, 'invalid_event');
    expect(next.phase).toBe(state.phase);
  });

  it('idle + release (invalid) returns idle unchanged', () => {
    const state = { ...createInitialState(), phase: 'idle' as const };
    const next = transitionState(state, 'release');
    expect(next.phase).toBe('idle');
  });
});

describe('shouldWin', () => {
  it('always returns true for admin', () => {
    for (let i = 0; i < 100; i++) {
      expect(shouldWin(true)).toBe(true);
    }
  });

  it('returns true approximately 1% of the time for non-admin', () => {
    let wins = 0;
    const iterations = 10000;
    for (let i = 0; i < iterations; i++) {
      if (shouldWin(false)) wins++;
    }
    // Expect 50-150 wins out of 10000 (1% = 100, with generous bounds)
    expect(wins).toBeGreaterThanOrEqual(50);
    expect(wins).toBeLessThanOrEqual(150);
  });
});

describe('advanceTier', () => {
  it('increments throwsInTier when throwsInTier < 2', () => {
    const state: GameState = { ...createInitialState(), tier: 1, throwsInTier: 0 };
    const next = advanceTier(state);
    expect(next.throwsInTier).toBe(1);
    expect(next.tier).toBe(1);
  });

  it('increments tier and resets throwsInTier when throwsInTier >= 2', () => {
    const state: GameState = { ...createInitialState(), tier: 1, throwsInTier: 2 };
    const next = advanceTier(state);
    expect(next.tier).toBe(2);
    expect(next.throwsInTier).toBe(0);
  });

  it('caps tier at 4', () => {
    const state: GameState = { ...createInitialState(), tier: 4, throwsInTier: 2 };
    const next = advanceTier(state);
    expect(next.tier).toBe(4);
    expect(next.throwsInTier).toBe(0);
  });
});
