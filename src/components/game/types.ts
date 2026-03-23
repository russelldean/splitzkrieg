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
// Proportions based on real bowling lane specs scaled to 400-unit lane width:
//   Real lane width: 42" -> 400 units (1 unit = 0.105")
//   Real ball diameter: 8.6" -> 82 units (radius 41)
//   Real pin diameter (widest): 4.7" -> 45 units (radius ~22)
//   Real gutter width: 9.25" -> 88 units
//   Real pit depth: ~8' behind pins -> 200 units (compressed for gameplay)
//
// Layout (Y axis, top-down view, Y=0 at pin end):
//   Y = LANE_LENGTH (1200): ball start (foul line end)
//   Y = PIN_Y (~5): pin deck (where the 10-pin sits)
//   Y = 0: lane surface ends, pit begins
//   Y = -PIT_DEPTH (-80): back wall
export const GAME_CONSTANTS = {
  LANE_WIDTH: 400,
  LANE_LENGTH: 1200,       // Stretched for top-down (real ratio would be ~6800)
  BALL_RADIUS: 28,         // Shrunk from real-scale 41 for better visual feel on phone
  PIN_RADIUS: 45,          // 50% bigger than 30 for more visual impact
  GUTTER_WIDTH: 88,        // Real: 9.25" = 88 units
  PIT_DEPTH: 80,           // Pit behind pins
  PIN_Y: 5,                // Pin sits at the very end of the lane, just before pit
  MAX_PULL_DISTANCE: 150,
  MAX_VELOCITY: 25,        // Faster to cover the longer lane
  CURVE_FACTOR: 3,
  MAX_ATTEMPTS: 10,
  WIN_PROBABILITY: 0.01,
  THROWS_PER_TIER: 2,
} as const;
