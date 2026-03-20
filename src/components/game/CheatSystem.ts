import { CHEAT_POOL } from './cheats';
import type { CheatDefinition } from './types';

export class CheatSystem {
  private lastCheatId: string | null = null;

  /**
   * Select a cheat based on the current tier.
   * - Filters pool to cheats with tier <= current tier
   * - Weights toward higher tiers (tier N gets weight N)
   * - Excludes lastCheatId to avoid consecutive repeats
   */
  selectCheat(tier: number): CheatDefinition {
    // Filter to eligible cheats (tier <= current tier)
    let eligible = CHEAT_POOL.filter(c => c.tier <= tier);

    // Exclude last cheat to prevent repeats
    if (this.lastCheatId !== null && eligible.length > 1) {
      eligible = eligible.filter(c => c.id !== this.lastCheatId);
    }

    // Build weighted pool: higher tier cheats appear more often
    const weighted: CheatDefinition[] = [];
    for (const cheat of eligible) {
      // Weight = tier value (tier 4 gets 4x, tier 1 gets 1x)
      const weight = cheat.tier;
      for (let i = 0; i < weight; i++) {
        weighted.push(cheat);
      }
    }

    // Random selection from weighted pool
    const selected = weighted[Math.floor(Math.random() * weighted.length)];
    this.lastCheatId = selected.id;
    return selected;
  }
}
