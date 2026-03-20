import type { CheatDefinition, GameRenderer } from '../types';

function createAnimationLoop(duration: number, onFrame: (progress: number) => void): Promise<void> {
  return new Promise<void>(resolve => {
    const start = performance.now();
    const animate = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      onFrame(progress);
      if (progress < 1) requestAnimationFrame(animate);
      else resolve();
    };
    requestAnimationFrame(animate);
  });
}

export const physicsCheats: CheatDefinition[] = [
  {
    id: 'slight-curve',
    name: 'Slight Curve',
    tier: 1,
    category: 'physics',
    caption: 'Huh. Could have sworn that was straight.',
    duration: 1500,
    execute: async (engine, renderer) => {
      // Apply a lateral force to the ball mid-flight
      await createAnimationLoop(1500, (progress) => {
        if (progress > 0.4 && progress < 0.6 && engine && typeof engine === 'object') {
          const e = engine as { applyCheatForce?: (x: number, y: number) => void };
          e.applyCheatForce?.(3, 0);
        }
      });
    },
  },
  {
    id: 'pin-wobble',
    name: 'Pin Wobble',
    tier: 1,
    category: 'physics',
    caption: 'The pin laughs at your attempt.',
    duration: 2000,
    execute: async (engine, renderer) => {
      // Pin wobbles dramatically but doesn't fall
      await createAnimationLoop(2000, () => {
        // Wobble is handled by the renderer reading cheat state
      });
    },
  },
  {
    id: 'gutter-widen',
    name: 'Gutter Widen',
    tier: 2,
    category: 'physics',
    caption: 'Did the gutters just... grow?',
    duration: 2000,
    execute: async (engine, renderer) => {
      // Gutters visually widen, pulling ball sideways
      await createAnimationLoop(2000, (progress) => {
        if (progress > 0.3 && engine && typeof engine === 'object') {
          const e = engine as { applyCheatForce?: (x: number, y: number) => void };
          const direction = Math.random() > 0.5 ? 4 : -4;
          e.applyCheatForce?.(direction, 0);
        }
      });
    },
  },
  {
    id: 'lane-tilt',
    name: 'Lane Tilt',
    tier: 3,
    category: 'physics',
    caption: 'The building inspector would like a word.',
    duration: 2500,
    execute: async (engine, renderer) => {
      // Lane tilts, ball rolls off
      await createAnimationLoop(2500, (progress) => {
        if (progress > 0.2 && engine && typeof engine === 'object') {
          const e = engine as { applyCheatForce?: (x: number, y: number) => void };
          e.applyCheatForce?.(5 * progress, 0);
        }
      });
    },
  },
];
