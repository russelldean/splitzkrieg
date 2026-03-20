import { physicsCheats } from './physics-cheats';
import { characterCheats } from './character-cheats';
import { bowlingCheats } from './bowling-cheats';
import type { CheatDefinition } from '../types';

export const CHEAT_POOL: CheatDefinition[] = [
  ...physicsCheats,
  ...characterCheats,
  ...bowlingCheats,
];
