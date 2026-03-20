export type GamePhase = 'demo' | 'idle' | 'aiming' | 'rolling' | 'cheat' | 'replay' | 'result' | 'scorecard' | 'win';

export interface Vec2 { x: number; y: number; }

export interface GameState {
  phase: GamePhase;
  attempt: number;
  maxAttempts: number;      // 10
  tier: number;             // Current cheat tier (1-4)
  throwsInTier: number;     // Throws since last tier advance (0-2)
  cheatsEncountered: string[]; // Cheat IDs for score card
  isAdmin: boolean;         // Admin always-win mode
  activeSkin: 'vector' | 'pixel' | 'handdrawn';
}

export interface Camera {
  y: number;
  targetY: number;
  smoothing: number;        // Lerp factor 0.05-0.1
}

export interface GameRenderer {
  drawLane(ctx: CanvasRenderingContext2D, camera: Camera): void;
  drawBall(ctx: CanvasRenderingContext2D, position: Vec2, angle: number): void;
  drawPin(ctx: CanvasRenderingContext2D, position: Vec2, angle: number, wobble: number): void;
  drawGutters(ctx: CanvasRenderingContext2D, camera: Camera): void;
  drawAimArrow(ctx: CanvasRenderingContext2D, origin: Vec2, direction: Vec2): void;
  drawCheatEffect(ctx: CanvasRenderingContext2D, cheatId: string, progress: number): void;
  drawCaption(ctx: CanvasRenderingContext2D, text: string, progress: number): void;
  drawPredictorText(ctx: CanvasRenderingContext2D, text: string): void;
}

export interface CheatDefinition {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4;
  category: 'physics' | 'character' | 'bowling';
  caption: string;
  duration: number; // ms
  execute: (engine: unknown, renderer: GameRenderer) => Promise<void>;
}

export interface ReplayFrame {
  ballPos: Vec2;
  ballAngle: number;
  pinPos: Vec2;
  pinAngle: number;
  timestamp: number;
  cheatState?: unknown;
}

// Game world constants
export const GAME_CONSTANTS = {
  LANE_WIDTH: 200,
  LANE_LENGTH: 800,
  BALL_RADIUS: 12,
  PIN_RADIUS: 8,
  GUTTER_WIDTH: 30,
  MAX_PULL_DISTANCE: 150,
  MAX_VELOCITY: 15,
  CURVE_FACTOR: 3,
  MAX_ATTEMPTS: 10,
  WIN_PROBABILITY: 0.01,
  THROWS_PER_TIER: 2,
} as const;
