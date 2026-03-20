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

export const characterCheats: CheatDefinition[] = [
  {
    id: 'cat-walk',
    name: 'Cat Walk',
    tier: 2,
    category: 'character',
    caption: 'Sir, this is a bowling alley.',
    duration: 2000,
    execute: async (engine, renderer) => {
      // A cat walks across the lane, blocking the ball
      await createAnimationLoop(2000, () => {
        // Visual handled by renderer.drawCheatEffect
      });
    },
  },
  {
    id: 'janitor-sweep',
    name: 'Janitor Sweep',
    tier: 3,
    category: 'character',
    caption: 'Sorry, we\'re closing early today.',
    duration: 2500,
    execute: async (engine, renderer) => {
      // A janitor sweeps the pin away
      await createAnimationLoop(2500, () => {
        // Visual handled by renderer.drawCheatEffect
      });
    },
  },
  {
    id: 'pigeon',
    name: 'Pigeon',
    tier: 4,
    category: 'character',
    caption: 'You\'ve been outplayed by a bird.',
    duration: 3000,
    execute: async (engine, renderer) => {
      // A pigeon lands on the pin and carries it away
      await createAnimationLoop(3000, () => {
        // Visual handled by renderer.drawCheatEffect
      });
    },
  },
];
