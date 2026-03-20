# Phase 11: Hit the 10 Pin Mini-Game - Research

**Researched:** 2026-03-20
**Domain:** Interactive 2D browser game (physics, canvas rendering, audio, persistence)
**Confidence:** HIGH

## Summary

This phase adds a standalone interactive mini-game to Splitzkrieg -- a rigged 10-pin spare conversion game with comedy cheats, slingshot mechanics, and a winners Hall of Fame. The game is entirely client-side except for Hall of Fame persistence, which uses a new API route backed by the existing Azure SQL database.

The recommended stack is **Matter.js for physics**, **HTML5 Canvas for rendering**, **Howler.js for audio**, and a **Next.js API route + Azure SQL table** for the Hall of Fame. The game architecture separates game logic (physics, state, cheats) from rendering (skins) to support the vector/pixel/hand-drawn skin system. The slingshot mechanic uses pointer events (touch + mouse) with velocity calculation on release, feeding into Matter.js body forces.

**Primary recommendation:** Build on Canvas with Matter.js physics. Do NOT hand-roll physics. Separate game engine (state machine + physics) from renderer (skin-swappable Canvas drawing) from the start.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Drag-and-release slingshot mechanic (like Angry Birds). Pull back on the ball, aim, release.
- **D-02:** Short direction arrow shows initial aim direction only (not full predicted path).
- **D-03:** Slight curve based on release angle. Dragging slightly off-center during release hooks the ball.
- **D-04:** Pull-back distance determines power IF not too complex. Otherwise fixed power, aim only. Claude's discretion on complexity.
- **D-05:** Semi-realistic ball physics. Ball rolls with believable weight and friction.
- **D-06:** Instant release on let-go. Snappy, responsive. No wind-up animation.
- **D-07:** Camera tracks the ball down the lane if achievable without major work. Fall back to fixed view if too complex.
- **D-08:** Optional slow-mo replay after each cheat with a funny caption. Player taps to dismiss.
- **D-09:** Animated demo on first load (2-3 seconds showing a hand pulling back and releasing).
- **D-10:** Sound effects + haptic vibration feedback.
- **D-11:** Random cheats drawn from tiered pools of escalating absurdity.
- **D-12:** Claude's discretion on number of tiers. Fast escalation (2-3 throws per tier).
- **D-13:** Early throws (tier 1) feature near-misses. Pin wobbles but doesn't fall.
- **D-14:** Three categories of cheats: physics cheats, character interruptions, bowling-specific comedy. NO reality-breaking cheats.
- **D-15:** Start with 10 unique cheat animations. Architecture supports adding more later.
- **D-16:** Every cheat gets a funny one-liner caption.
- **D-17:** Astronomically rare win chance (~1 in 1000). Confetti explosion, screen shakes, disbelief text, name prompt for Hall of Fame.
- **D-18:** Score-based end state after set number of attempts. Branded score card with attempt count and cheats encountered.
- **D-19:** Styled HTML results page with screenshot prompt (not server-generated OG image).
- **D-20:** Winners Hall of Fame with lightweight persistence.
- **D-21:** Local leaderboard in localStorage for personal best attempt count.
- **D-22:** Angled/isometric perspective. Elevated view with depth, lane narrows toward pin.
- **D-23:** Clean vector/flat design as default (built first).
- **D-24:** Multiple art style skins: vector (default), pixel art, hand-drawn. Visible toggle.
- **D-25:** Bowling alley color palette (polished wood lane, dark gutters, white pin). NOT site palette.
- **D-26:** Portrait orientation (mobile-first). Lane runs vertically. Desktop gets centered vertical strip.
- **D-27:** Lane only against dark background. No bowling alley environment.
- **D-28:** Claude's discretion on animation approach.
- **D-29:** Multiple entry points: /game route + 404 easter egg.
- **D-30:** In the main nav bar alongside Bowlers, Teams, Seasons.
- **D-31:** 404 easter egg: lonely 10 pin with wobble animation, clicking launches game.
- **D-32:** Minimal chrome on game page. Small logo, game takes most of viewport.
- **D-33:** Completely standalone. No connection to bowler profiles, scores, or league data.
- **D-34:** Secret admin mode where the game always wins. Accessible when logged in or via secret param/code.

### Claude's Discretion
- Starting ball position (fixed center vs draggable left/right)
- Number of absurdity tiers and exact pacing
- Animation approach (sprite-based, procedural, or hybrid)
- Physics engine / rendering technology choice
- How to implement the ~1-in-1000 win mechanic
- Persistence approach for the winners Hall of Fame
- Number of attempts before showing the score card
- Slow-mo replay implementation details
- How admin mode is activated (admin auth check, secret URL param, Konami code, etc.)

### Deferred Ideas (OUT OF SCOPE)
- DeviceMotion throw gesture as alternate input mode
- DeviceOrientation tilt parallax effects on the lane
- Global leaderboard for attempt counts (just local + winners list)
- Generated OG image for richer social sharing
- Connection to bowler data (personalized flavor text, logged-in names)
- Additional art skins beyond the initial three

</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| matter-js | 0.20.0 | 2D physics engine | Most popular JS physics engine. Handles collision detection, rigid bodies, friction, restitution. Well-documented, battle-tested. Avoids hand-rolling physics. |
| @types/matter-js | 0.20.2 | TypeScript definitions | Full type coverage for Matter.js API |
| howler | 2.2.4 | Sound effects | 7KB gzipped, Web Audio with HTML5 Audio fallback, sprite support for multiple SFX in one file, auto-caching. Cross-browser. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none -- Canvas API) | native | Rendering | HTML5 Canvas 2D context for all drawing. No extra library needed for this scope. |
| (none -- Pointer Events) | native | Input handling | Unified touch + mouse via pointerdown/pointermove/pointerup. Better than separate touch/mouse handlers. |
| (none -- Vibration API) | native | Haptic feedback | navigator.vibrate() on Android/Chrome. Not supported on iOS Safari -- degrade gracefully with no-op. |
| (none -- Web Animations API) | native | UI animations | For confetti, screen shake, caption fades. CSS keyframes + WAAPI. No animation library needed. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Matter.js | Planck.js (1.4.3) | Box2D port, slightly better performance in benchmarks, but smaller community, less documentation, pre-release status. Matter.js is sufficient for a single-pin game. |
| Matter.js | No physics engine (pure math) | Tempting for "just one pin" but collision angles, friction, deflection, and the near-miss wobble physics make hand-rolling error-prone. Physics engine pays for itself in cheat implementation. |
| Canvas | SVG | SVG is easier for static shapes but worse for per-frame animation (60fps redraw of moving objects). Canvas is the standard for game loops. |
| Canvas | PixiJS/Konva | Over-engineered for this scope. Canvas 2D API is sufficient. These add WebGL overhead and bundle size for features we don't need. |
| Howler.js | Tone.js | Tone.js is for music synthesis/scheduling. Howler is for sound effects playback -- exactly our use case. |
| Howler.js | Raw Web Audio API | Works but requires manual AudioContext management, buffer loading, cross-browser workarounds. Howler handles all of this in 7KB. |

**Installation:**
```bash
npm install matter-js howler && npm install -D @types/matter-js @types/howler
```

**Version verification:** Versions confirmed via npm registry on 2026-03-20.

## Architecture Patterns

### Recommended Project Structure

```
src/app/game/
  page.tsx                    # Game page (minimal layout, 'use client')
  layout.tsx                  # Custom layout -- no Header/Footer, dark bg
  not-found.tsx               # (optional) game-specific 404

src/components/game/
  GameCanvas.tsx              # Main canvas component, owns the game loop
  GameEngine.ts               # Physics world setup, ball/pin/lane bodies
  GameState.ts                # State machine (idle/aiming/rolling/cheat/replay/result)
  SlingshotInput.ts           # Pointer event handling, aim vector calculation
  CheatSystem.ts              # Tier pools, random selection, cheat execution
  cheats/                     # Individual cheat definitions
    index.ts                  # Registry of all cheats
    physics-cheats.ts         # Ball curves, gutter widens, lane tilts
    character-cheats.ts       # Cat, janitor, pigeon, hand from gutter
    bowling-cheats.ts         # Wrong pins, 7-10 split, pin machine, invading ball
  renderers/
    types.ts                  # Renderer interface
    VectorRenderer.ts         # Clean flat/vector skin (default)
    PixelRenderer.ts          # Pixel art skin
    HandDrawnRenderer.ts      # Hand-drawn/sketchy skin
  ReplaySystem.ts             # Slow-mo replay with frame buffer
  SoundManager.ts             # Howler.js wrapper, sound sprite definitions
  HapticManager.ts            # Vibration API wrapper with iOS no-op fallback
  ScoreCard.tsx               # End-of-game results card (React component)
  HallOfFame.tsx              # Winners list (React component)
  DemoAnimation.tsx           # First-load tutorial animation
  WinCelebration.tsx          # Confetti + screen shake + name prompt
  AdminMode.ts                # Admin detection + always-win flag

src/app/api/game/
  hall-of-fame/
    route.ts                  # GET: list winners, POST: add winner (validated)

src/app/not-found.tsx         # New -- wobbling pin easter egg linking to /game
```

### Pattern 1: Game State Machine

**What:** Central state machine controlling all game flow.
**When to use:** Always. Every game action checks/transitions state.

```typescript
type GamePhase =
  | 'demo'        // First-load tutorial animation
  | 'idle'        // Waiting for player to start aiming
  | 'aiming'      // Player is dragging (slingshot pulled back)
  | 'rolling'     // Ball released, physics simulation running
  | 'cheat'       // Cheat animation playing
  | 'replay'      // Slow-mo replay of the cheat
  | 'result'      // Ball reached end / cheat resolved
  | 'scorecard'   // End of game, showing results
  | 'win'         // Rare win celebration
  ;

interface GameState {
  phase: GamePhase;
  attempt: number;
  maxAttempts: number;        // e.g., 10
  tier: number;               // Current cheat tier
  throwsInTier: number;       // Throws since last tier advance
  cheatsEncountered: string[]; // For score card
  isAdmin: boolean;           // Admin always-win mode
  activeSkin: 'vector' | 'pixel' | 'handdrawn';
}
```

### Pattern 2: Renderer Interface (Skin System)

**What:** Abstract renderer interface that all skins implement. Game engine calls renderer methods without knowing which skin is active.
**When to use:** Every drawing operation goes through the renderer.

```typescript
interface GameRenderer {
  drawLane(ctx: CanvasRenderingContext2D, camera: Camera): void;
  drawBall(ctx: CanvasRenderingContext2D, position: Vec2, angle: number): void;
  drawPin(ctx: CanvasRenderingContext2D, position: Vec2, angle: number, wobble: number): void;
  drawGutters(ctx: CanvasRenderingContext2D, camera: Camera): void;
  drawAimArrow(ctx: CanvasRenderingContext2D, origin: Vec2, direction: Vec2): void;
  drawCheatEffect(ctx: CanvasRenderingContext2D, cheatId: string, progress: number): void;
  drawCaption(ctx: CanvasRenderingContext2D, text: string, progress: number): void;
}
```

### Pattern 3: Cheat Registry

**What:** Cheats defined as data objects with animation callbacks, organized into tier pools.
**When to use:** Adding new cheats should be data-only changes.

```typescript
interface CheatDefinition {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4;
  category: 'physics' | 'character' | 'bowling';
  caption: string;
  execute: (engine: GameEngine, renderer: GameRenderer) => Promise<void>;
  // Duration in ms for the cheat animation
  duration: number;
}

// Registry -- add new cheats by pushing to this array
const CHEAT_POOL: CheatDefinition[] = [
  // Tier 1: Near misses
  { id: 'slight-curve', tier: 1, category: 'physics', caption: 'Huh. Could have sworn that was straight.', ... },
  { id: 'pin-wobble', tier: 1, category: 'physics', caption: 'The pin laughs at your attempt.', ... },
  // Tier 2: Obvious interference
  { id: 'cat-walk', tier: 2, category: 'character', caption: 'Sir, this is a bowling alley.', ... },
  // Tier 3+: Absurd
  { id: 'wrong-pins', tier: 3, category: 'bowling', caption: 'Wait, those aren\'t even the right pins.', ... },
];
```

### Pattern 4: Slingshot Input via Pointer Events

**What:** Unified touch/mouse handling using Pointer Events API.
**When to use:** All drag interaction.

```typescript
// Pointer Events provide unified touch + mouse
canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerup', onPointerUp);

// On pointerdown: record start position, enter 'aiming' state
// On pointermove: calculate pull-back vector (start - current), update aim arrow
// On pointerup: calculate launch velocity from pull-back vector
//   velocity = pullback * powerMultiplier
//   curve = horizontal offset from center line * curveMultiplier
```

### Pattern 5: Camera Tracking

**What:** Virtual camera that follows the ball down the lane via canvas translate.
**When to use:** During 'rolling' phase.

```typescript
// Camera is just a Y offset applied via ctx.translate()
// Lane is drawn in world coordinates, camera pans to follow ball
interface Camera {
  y: number;          // Current Y offset in world coords
  targetY: number;    // Where ball is
  smoothing: number;  // Lerp factor (0.05-0.1 for smooth follow)
}

function updateCamera(camera: Camera, ballY: number) {
  camera.targetY = ballY - canvasHeight * 0.7; // Ball at 70% down screen
  camera.y += (camera.targetY - camera.y) * camera.smoothing;
}

// In render loop:
ctx.save();
ctx.translate(0, -camera.y);
// Draw everything in world coordinates
ctx.restore();
```

### Anti-Patterns to Avoid

- **Coupling game logic to rendering:** Every drawing call must go through the renderer interface. Direct `ctx.fillRect()` calls in game logic code will make skins impossible.
- **Synchronous cheat animations:** Cheats must be async (promise-based) so the game loop waits for completion. Never block the main thread.
- **CSS transforms for game objects:** Use Canvas 2D transforms only. Mixing DOM positioning with Canvas drawing creates z-index and coordinate nightmares.
- **requestAnimationFrame without delta time:** Always pass elapsed time to update functions. Frame rates vary wildly between devices.
- **Physics bodies for decorative elements:** Only the ball and pin need Matter.js bodies. Cheat characters (cat, janitor, etc.) are animated sprites/drawings, not physics objects.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ball-pin collision physics | Custom collision math | Matter.js collision detection + response | Angles of deflection, friction, restitution, wobble physics are extremely hard to get right. Matter.js handles all edge cases. |
| Cross-browser audio playback | Raw AudioContext management | Howler.js | AudioContext autoplay policies, buffer management, iOS audio unlocking, format fallbacks. Howler handles all of this. |
| Touch + mouse input unification | Separate touchstart/mousedown handlers | Pointer Events API | Pointer Events are the standard. Avoids double-firing on touch devices, handles stylus, provides pressure data. |
| Isometric perspective math | Manual trigonometry | Simple canvas scale + skew transform | A 2D canvas transform matrix can create convincing isometric perspective in 4 lines. No 3D math needed. |

**Key insight:** This game needs to FEEL polished -- physics, audio, and input are the three areas where hand-rolled solutions produce janky results. Use proven libraries for these three; hand-build everything else (rendering, cheats, state machine, replay).

## Common Pitfalls

### Pitfall 1: iOS Audio Autoplay Restrictions
**What goes wrong:** Sounds don't play on iOS because Web Audio requires a user gesture to unlock the AudioContext.
**Why it happens:** Safari suspends AudioContext until a touch/click event.
**How to avoid:** Howler.js handles this with `Howler.autoUnlock = true` (default). Still, play a silent sound on the first user tap to be safe. The first slingshot drag is a perfect trigger.
**Warning signs:** Sounds work on desktop but not mobile Safari.

### Pitfall 2: Vibration API Not on iOS
**What goes wrong:** `navigator.vibrate()` silently fails on iOS Safari.
**Why it happens:** Apple has never implemented the Vibration API in Safari (as of March 2026). Android Chrome supports it fully.
**How to avoid:** Feature-detect: `if ('vibrate' in navigator) { navigator.vibrate(pattern); }`. Never assume it works. Treat haptics as progressive enhancement.
**Warning signs:** No error thrown -- just nothing happens on iOS.

### Pitfall 3: Canvas Blurry on Retina/HiDPI
**What goes wrong:** Game looks fuzzy on phones and Macs with 2x/3x displays.
**Why it happens:** Canvas CSS size and pixel buffer size must be different on HiDPI screens.
**How to avoid:** Set canvas width/height to `clientWidth * devicePixelRatio` and `clientHeight * devicePixelRatio`, then scale the context: `ctx.scale(dpr, dpr)`. Set CSS dimensions with `width: 100%; height: 100%`.
**Warning signs:** Everything looks slightly blurred/aliased compared to surrounding DOM elements.

### Pitfall 4: Matter.js Render vs Custom Canvas
**What goes wrong:** Developer uses Matter.js built-in `Render` module, then tries to customize drawing.
**Why it happens:** Matter.Render is convenient for debugging but not designed for custom game graphics.
**How to avoid:** Use Matter.js for physics ONLY (`Engine`, `World`, `Body`, `Runner`). Do ALL drawing with custom Canvas code through the renderer interface. Never import `Matter.Render`.
**Warning signs:** Including `matter-js/build/matter.js` (full bundle with renderer) instead of just the engine.

### Pitfall 5: Game Loop Timing on Background Tabs
**What goes wrong:** requestAnimationFrame pauses when the tab is backgrounded, then physics "catches up" all at once when returning.
**Why it happens:** Browsers throttle rAF in background tabs. If using accumulated delta time, the first frame back has a huge delta.
**How to avoid:** Clamp delta time: `const dt = Math.min(elapsed, 32)` (cap at ~30fps worth of time). Pause the game state when tab loses visibility.
**Warning signs:** Ball teleports or physics explodes after switching back to the tab.

### Pitfall 6: Touch Event Conflicts on Mobile
**What goes wrong:** Scrolling, pull-to-refresh, or pinch-zoom interfere with the game.
**Why it happens:** Default browser touch behaviors conflict with game input.
**How to avoid:** On the game canvas: `touch-action: none` CSS property. Call `event.preventDefault()` in pointer handlers. The game page layout should be non-scrollable (fullscreen game area).
**Warning signs:** Page scrolls or bounces while trying to aim.

### Pitfall 7: Next.js Layout Inheritance
**What goes wrong:** Game page inherits the site Header/Footer/AnnouncementBanner.
**Why it happens:** Root layout.tsx wraps all routes.
**How to avoid:** Create `src/app/game/layout.tsx` as a custom layout that does NOT include Header/Footer. The root layout still provides fonts and html/body -- the game layout just replaces the inner chrome. Alternatively, use a route group `(game)` with its own layout.
**Warning signs:** Nav bar and footer visible on the game page.

## Code Examples

### Canvas Setup with HiDPI Support

```typescript
// Source: MDN Canvas API + standard HiDPI pattern
function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  return ctx;
}
```

### Matter.js Physics Setup (Bowling Pin + Ball)

```typescript
// Source: Matter.js documentation
import Matter from 'matter-js';

const { Engine, World, Bodies, Body, Events } = Matter;

function createGameWorld() {
  const engine = Engine.create({
    gravity: { x: 0, y: 0, scale: 0 }, // Top-down view, no gravity
  });

  // Ball -- circle body
  const ball = Bodies.circle(laneCenter, ballStartY, BALL_RADIUS, {
    restitution: 0.3,
    friction: 0.05,
    density: 0.01,
    label: 'ball',
  });

  // Pin -- circle body (simplified; could be polygon for realism)
  const pin = Bodies.circle(laneCenter, pinY, PIN_RADIUS, {
    restitution: 0.5,
    friction: 0.1,
    density: 0.005,
    label: 'pin',
  });

  // Lane walls (gutters)
  const leftWall = Bodies.rectangle(gutterLeftX, laneCenter, WALL_THICKNESS, LANE_LENGTH, { isStatic: true });
  const rightWall = Bodies.rectangle(gutterRightX, laneCenter, WALL_THICKNESS, LANE_LENGTH, { isStatic: true });

  World.add(engine.world, [ball, pin, leftWall, rightWall]);

  return { engine, ball, pin, leftWall, rightWall };
}
```

### Slingshot Launch Calculation

```typescript
function calculateLaunch(
  startPos: { x: number; y: number },
  releasePos: { x: number; y: number },
): { vx: number; vy: number } {
  // Pull-back vector (reversed for slingshot effect)
  const dx = startPos.x - releasePos.x;
  const dy = startPos.y - releasePos.y;

  // Power from pull distance (D-04)
  const distance = Math.sqrt(dx * dx + dy * dy);
  const power = Math.min(distance / MAX_PULL_DISTANCE, 1.0);

  // Normalize direction and apply power
  const mag = Math.sqrt(dx * dx + dy * dy) || 1;
  const vx = (dx / mag) * power * MAX_VELOCITY;
  const vy = (dy / mag) * power * MAX_VELOCITY;

  // Curve from horizontal offset (D-03)
  const horizontalOffset = dx / mag; // -1 to 1
  const curve = horizontalOffset * CURVE_FACTOR;

  return { vx: vx + curve, vy }; // vy is negative (ball goes UP the lane)
}
```

### Howler.js Sound Setup

```typescript
// Source: howlerjs.com documentation
import { Howl } from 'howler';

const gameSounds = new Howl({
  src: ['/sounds/game-sprites.webm', '/sounds/game-sprites.mp3'],
  sprite: {
    roll:     [0, 2000, true],  // Looping ball roll
    impact:   [2000, 500],       // Ball hits pin
    woosh:    [2500, 400],       // Ball miss / near miss
    cheat:    [2900, 600],       // Generic cheat sound
    fanfare:  [3500, 3000],      // Win celebration
    clatter:  [6500, 800],       // Pin falling
  },
});

// Play with volume control
gameSounds.play('roll');
gameSounds.play('impact');
```

### Slow-Mo Replay System

```typescript
// Record frames during the 'rolling' phase, replay at reduced speed
interface ReplayFrame {
  ballPos: { x: number; y: number };
  ballAngle: number;
  pinPos: { x: number; y: number };
  pinAngle: number;
  timestamp: number;
  // Snapshot of any active cheat visual state
  cheatState?: unknown;
}

class ReplaySystem {
  private frames: ReplayFrame[] = [];
  private isRecording = false;

  startRecording() { this.frames = []; this.isRecording = true; }
  stopRecording() { this.isRecording = false; }

  captureFrame(frame: ReplayFrame) {
    if (this.isRecording) this.frames.push(frame);
  }

  // Play back at 0.25x speed
  async playReplay(renderer: GameRenderer, ctx: CanvasRenderingContext2D) {
    const SLOWMO_FACTOR = 0.25;
    for (let i = 0; i < this.frames.length; i++) {
      const frame = this.frames[i];
      // Clear and redraw at this frame's state
      renderer.drawLane(ctx, /* camera from frame */);
      renderer.drawBall(ctx, frame.ballPos, frame.ballAngle);
      renderer.drawPin(ctx, frame.pinPos, frame.pinAngle, 0);
      // Wait proportional to frame timing
      const nextTime = this.frames[i + 1]?.timestamp ?? frame.timestamp + 16;
      const wait = (nextTime - frame.timestamp) / SLOWMO_FACTOR;
      await new Promise(r => setTimeout(r, wait));
    }
  }
}
```

### Hall of Fame API Route

```typescript
// src/app/api/game/hall-of-fame/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT name, wonAt, attemptCount
    FROM gameWinners
    ORDER BY wonAt DESC
  `);
  return NextResponse.json(result.recordset);
}

export async function POST(request: NextRequest) {
  const { name, attemptCount } = await request.json();

  // Validate
  if (!name || typeof name !== 'string' || name.length > 50) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }
  if (!attemptCount || typeof attemptCount !== 'number') {
    return NextResponse.json({ error: 'Invalid attempt count' }, { status: 400 });
  }

  const pool = await getPool();
  await pool.request()
    .input('name', name.trim().slice(0, 50))
    .input('attemptCount', attemptCount)
    .query(`
      INSERT INTO gameWinners (name, attemptCount, wonAt)
      VALUES (@name, @attemptCount, GETDATE())
    `);

  return NextResponse.json({ success: true });
}
```

### Win Probability Implementation

```typescript
// ~1 in 1000 chance, checked BEFORE physics simulation
// This way the game decides the outcome first, then either lets physics
// play out naturally (win) or triggers a cheat (loss)
function shouldWin(isAdmin: boolean): boolean {
  if (isAdmin) return true;
  return Math.random() < 0.001; // 1 in 1000
}

// In the game loop:
// 1. Player releases ball
// 2. Check shouldWin()
// 3. If win: let physics run normally (ball hits pin)
// 4. If loss: select a cheat from current tier, execute it
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate touch/mouse handlers | Pointer Events API | 2020+ (all browsers) | Single event system for all input types |
| HTML5 Audio element for games | Web Audio API (via Howler.js) | 2018+ | Low-latency, multiple concurrent sounds, sprites |
| CSS animations for game objects | Canvas 2D + requestAnimationFrame | Always for games | Consistent frame timing, no layout thrashing |
| matter-js Render module | Custom canvas rendering | Best practice | Full visual control, skin system possible |

**Deprecated/outdated:**
- `touchstart`/`mousedown` separate handlers: Use Pointer Events instead.
- `setInterval` for game loops: Use `requestAnimationFrame` with delta time.
- Matter.js `Render` module for production games: Debug only.

## Open Questions

1. **Isometric perspective depth**
   - What we know: Canvas 2D transforms (scale + skew) can create convincing pseudo-3D. True isometric is a 2:1 tile ratio.
   - What's unclear: How deep to go with the perspective. A simple `ctx.transform()` matrix with lane narrowing may be sufficient, or we may need per-element scaling for depth.
   - Recommendation: Start with a simple trapezoidal lane (wider at bottom, narrower at top) using `ctx.transform()`. Iterate visually. Physics runs in untransformed coordinates; only rendering is transformed.

2. **Sound sprite file creation**
   - What we know: Howler.js supports sprite maps within a single audio file.
   - What's unclear: Source of bowling sound effects (licensing, creation).
   - Recommendation: Use royalty-free bowling sounds. Create a single sprite file with all effects. Placeholder sounds for initial development, polish later.

3. **Game page layout isolation**
   - What we know: The root layout includes Header, Footer, AnnouncementBanner, FeedbackButton. The game needs none of these.
   - What's unclear: Whether to use a route group `(game)` or a nested layout override.
   - Recommendation: Create `src/app/game/layout.tsx` that provides only the html essentials (fonts). The root layout's children slot means the game layout replaces the inner content. Test that Header/Footer don't render.

4. **Admin mode activation**
   - What we know: Existing admin auth uses JWT in `admin-token` cookie, verified via `jose`. `requireAdmin()` is server-side.
   - What's unclear: Client-side detection. The game is fully client-side.
   - Recommendation: Dual approach: (a) Read `admin-token` cookie client-side and decode the JWT payload (don't verify signature -- just check if role === 'admin' for the UI hint), OR (b) simpler: check for a URL parameter like `?mode=commissioner` combined with a secret stored in env. Option (a) is more elegant and uses existing auth.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

Since this phase has no formal requirement IDs, mapping by feature area:

| Feature | Behavior | Test Type | Automated Command | File Exists? |
|---------|----------|-----------|-------------------|-------------|
| Slingshot input | calculateLaunch returns correct velocity from drag vector | unit | `npx vitest run src/components/game/__tests__/SlingshotInput.test.ts` | No -- Wave 0 |
| Cheat system | Tier advancement after N throws, random selection within tier | unit | `npx vitest run src/components/game/__tests__/CheatSystem.test.ts` | No -- Wave 0 |
| Win probability | shouldWin returns true ~0.1% of the time, always true for admin | unit | `npx vitest run src/components/game/__tests__/GameState.test.ts` | No -- Wave 0 |
| Game state machine | Correct phase transitions (idle->aiming->rolling->cheat->result) | unit | `npx vitest run src/components/game/__tests__/GameState.test.ts` | No -- Wave 0 |
| Hall of Fame API | GET returns winners, POST validates + inserts | integration | `npx vitest run src/app/api/game/__tests__/hall-of-fame.test.ts` | No -- Wave 0 |
| Camera tracking | Camera Y follows ball with smoothing | unit | `npx vitest run src/components/game/__tests__/Camera.test.ts` | No -- Wave 0 |
| Replay system | Frames recorded during rolling, playback at reduced speed | unit | `npx vitest run src/components/game/__tests__/ReplaySystem.test.ts` | No -- Wave 0 |
| Renderer interface | VectorRenderer implements all required methods | unit | `npx vitest run src/components/game/__tests__/VectorRenderer.test.ts` | No -- Wave 0 |
| Score card | Displays attempt count and cheats encountered | manual-only | Visual inspection | N/A |
| Canvas rendering | Isometric lane looks correct | manual-only | Visual inspection | N/A |
| Sound effects | Sounds play on interaction | manual-only | Browser testing | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- [ ] `src/components/game/__tests__/SlingshotInput.test.ts` -- slingshot vector math
- [ ] `src/components/game/__tests__/CheatSystem.test.ts` -- tier advancement, random selection
- [ ] `src/components/game/__tests__/GameState.test.ts` -- state machine transitions, win probability
- [ ] `src/components/game/__tests__/Camera.test.ts` -- camera tracking
- [ ] `src/components/game/__tests__/ReplaySystem.test.ts` -- frame recording/playback
- [ ] `src/app/api/game/__tests__/hall-of-fame.test.ts` -- API endpoint tests

## Sources

### Primary (HIGH confidence)
- [matter-js npm](https://www.npmjs.com/package/matter-js) - v0.20.0, verified 2026-03-20
- [howler npm](https://www.npmjs.com/package/howler) - v2.2.4, verified 2026-03-20
- [@types/matter-js npm](https://www.npmjs.com/package/@types/matter-js) - v0.20.2, verified 2026-03-20
- [MDN Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) - Unified input API
- [MDN Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) - 2D rendering
- [MDN Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API) - Browser support matrix
- [Can I Use Vibration](https://caniuse.com/vibration) - iOS Safari NOT supported
- [Howler.js official](https://howlerjs.com/) - Audio library documentation

### Secondary (MEDIUM confidence)
- [Matter.js official site](https://brm.io/matter-js/) - API documentation and examples
- [Isometric Canvas games](https://docs.bswen.com/blog/2026-02-21-isometric-25d-canvas-games/) - Isometric rendering patterns

### Tertiary (LOW confidence)
- Web search comparisons of physics engines -- multiple sources agree on Matter.js as most popular/documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages verified on npm registry, well-established libraries
- Architecture: HIGH - Standard game loop patterns, clear separation of concerns
- Pitfalls: HIGH - Known browser API limitations verified with MDN/caniuse
- Persistence: HIGH - Reuses existing Azure SQL + API route patterns already in the codebase

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (stable technologies, no fast-moving APIs)
