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

export const bowlingCheats: CheatDefinition[] = [
  {
    id: 'wrong-pins',
    name: 'Wrong Pins',
    tier: 3,
    category: 'bowling',
    caption: 'Wait, those aren\'t even the right pins.',
    duration: 2000,
    execute: async (engine, renderer) => {
      // Single pin replaced by a 7-10 split right before impact
      await createAnimationLoop(2000, () => {
        // Visual handled by renderer.drawCheatEffect
      });
    },
  },
  {
    id: 'pin-machine',
    name: 'Pin Machine',
    tier: 2,
    category: 'bowling',
    caption: 'Maintenance window. Try again in 5-7 business days.',
    duration: 2000,
    execute: async (engine, renderer) => {
      // Pin setter machine descends and scoops up the pin
      await createAnimationLoop(2000, () => {
        // Visual handled by renderer.drawCheatEffect
      });
    },
  },
  {
    id: 'invading-ball',
    name: 'Invading Ball',
    tier: 4,
    category: 'bowling',
    caption: 'Lane 7 sends their regards.',
    duration: 2500,
    execute: async (engine, renderer) => {
      // Another bowling ball rolls in from the next lane
      await createAnimationLoop(2500, (progress) => {
        if (progress > 0.4 && engine && typeof engine === 'object') {
          const e = engine as { applyCheatForce?: (x: number, y: number) => void };
          e.applyCheatForce?.(-8, 2);
        }
      });
    },
  },
];
