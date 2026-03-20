import { GamePhase, GameState, GAME_CONSTANTS } from './types';

const TRANSITIONS: Record<string, Record<string, GamePhase>> = {
  demo: { start: 'idle' },
  idle: { pointerdown: 'aiming' },
  aiming: { release: 'rolling' },
  rolling: { cheat: 'cheat', win: 'win' },
  cheat: { replay: 'replay', skip: 'result' },
  replay: { done: 'result' },
  // 'result' handled specially (depends on attempt count)
};

export function createInitialState(isAdmin = false): GameState {
  return {
    phase: 'demo',
    attempt: 0,
    maxAttempts: GAME_CONSTANTS.MAX_ATTEMPTS,
    tier: 1,
    throwsInTier: 0,
    cheatsEncountered: [],
    isAdmin,
    activeSkin: 'vector',
  };
}

export function transitionState(state: GameState, event: string): GameState {
  // Special handling for 'result' phase
  if (state.phase === 'result' && event === 'next') {
    const nextPhase: GamePhase = state.attempt >= state.maxAttempts ? 'scorecard' : 'idle';
    return { ...state, phase: nextPhase };
  }

  const phaseTransitions = TRANSITIONS[state.phase];
  if (!phaseTransitions) return state;

  const nextPhase = phaseTransitions[event];
  if (!nextPhase) return state;

  return { ...state, phase: nextPhase };
}

export function shouldWin(isAdmin: boolean): boolean {
  if (isAdmin) return true;
  return Math.random() < GAME_CONSTANTS.WIN_PROBABILITY;
}

export function advanceTier(state: GameState): GameState {
  const newThrowsInTier = state.throwsInTier + 1;

  if (newThrowsInTier >= GAME_CONSTANTS.THROWS_PER_TIER) {
    return {
      ...state,
      tier: Math.min(state.tier + 1, 4),
      throwsInTier: 0,
    };
  }

  return {
    ...state,
    throwsInTier: newThrowsInTier,
  };
}
