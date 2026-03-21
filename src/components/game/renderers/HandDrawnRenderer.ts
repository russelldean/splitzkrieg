import { GameRenderer, Vec2, Camera, GAME_CONSTANTS } from '../types';

const COLORS = {
  background: '#1a1a2e',
  laneSurface: '#c4956a',
  laneAccent: '#8b6914',
  gutter: '#2a2a2a',
  ball: '#1a1a3e',
  ballHighlight: '#2a2a5e',
  pinBody: '#f5f5f0',
  pinStripe: '#cc3333',
  aimArrow: 'rgba(255, 255, 255, 0.6)',
  caption: '#ffffff',
  predictorText: 'rgba(255, 255, 100, 0.8)',
  predictorBg: 'rgba(0, 0, 0, 0.5)',
  foulLine: '#ff4444',
  boardLine: 'rgba(139, 105, 20, 0.3)',
} as const;

const { LANE_WIDTH, LANE_LENGTH, BALL_RADIUS, PIN_RADIUS, GUTTER_WIDTH } = GAME_CONSTANTS;

const TOP_WIDTH_RATIO = 0.18;
const TOP_WIDTH = LANE_WIDTH * TOP_WIDTH_RATIO;
const PERSPECTIVE_POWER = 2.5;

// Seeded random for consistent wobble per frame
let wobbleSeed = 0;
function seededRandom(): number {
  wobbleSeed = (wobbleSeed * 16807 + 7) % 2147483647;
  return (wobbleSeed % 1000) / 1000;
}

function resetWobbleSeed(seed: number): void {
  wobbleSeed = Math.abs(Math.floor(seed * 1000)) || 1;
}

const X_OFFSET = GUTTER_WIDTH;

function worldToScreen(worldX: number, worldY: number): Vec2 {
  const t = Math.max(0, Math.min(1, worldY / LANE_LENGTH));
  const screenT = Math.pow(t, 1 / PERSPECTIVE_POWER);
  const screenY = screenT * LANE_LENGTH;
  const currentWidth = TOP_WIDTH + (LANE_WIDTH - TOP_WIDTH) * t;
  const leftEdge = (LANE_WIDTH - currentWidth) / 2;
  const screenX = X_OFFSET + leftEdge + (worldX / LANE_WIDTH) * currentWidth;
  return { x: screenX, y: screenY };
}

const MIN_OBJECT_SCALE = 0.6;
function worldRadiusAtY(radius: number, worldY: number): number {
  const t = worldY / LANE_LENGTH;
  const scale = MIN_OBJECT_SCALE + (1 - MIN_OBJECT_SCALE) * t;
  return radius * scale;
}

/** Add jitter to a coordinate */
function jitter(value: number, amount: number = 2): number {
  return value + (seededRandom() - 0.5) * amount;
}

/** Draw a wobbly line from (x1,y1) to (x2,y2) */
function wobblyLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, wobbleAmount: number = 3): void {
  const midX = (x1 + x2) / 2 + (seededRandom() - 0.5) * wobbleAmount;
  const midY = (y1 + y2) / 2 + (seededRandom() - 0.5) * wobbleAmount;
  ctx.beginPath();
  ctx.moveTo(jitter(x1, 1), jitter(y1, 1));
  ctx.quadraticCurveTo(midX, midY, jitter(x2, 1), jitter(y2, 1));
  ctx.stroke();
}

/** Draw a sketchy circle with jittered segments */
function sketchyCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, segments: number = 12): void {
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const jr = r + (seededRandom() - 0.5) * r * 0.15;
    const x = cx + Math.cos(angle) * jr;
    const y = cy + Math.sin(angle) * jr;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      const prevAngle = ((i - 0.5) / segments) * Math.PI * 2;
      const cpR = r + (seededRandom() - 0.5) * r * 0.2;
      const cpX = cx + Math.cos(prevAngle) * cpR;
      const cpY = cy + Math.sin(prevAngle) * cpR;
      ctx.quadraticCurveTo(cpX, cpY, x, y);
    }
  }
  ctx.closePath();
}

/** Draw a sketchy ellipse */
function sketchyEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, segments: number = 12): void {
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const jrx = rx + (seededRandom() - 0.5) * rx * 0.12;
    const jry = ry + (seededRandom() - 0.5) * ry * 0.12;
    const x = cx + Math.cos(angle) * jrx;
    const y = cy + Math.sin(angle) * jry;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      const prevAngle = ((i - 0.5) / segments) * Math.PI * 2;
      const cpRx = rx + (seededRandom() - 0.5) * rx * 0.15;
      const cpRy = ry + (seededRandom() - 0.5) * ry * 0.15;
      const cpX = cx + Math.cos(prevAngle) * cpRx;
      const cpY = cy + Math.sin(prevAngle) * cpRy;
      ctx.quadraticCurveTo(cpX, cpY, x, y);
    }
  }
  ctx.closePath();
}

/** Add crosshatch texture to a region */
function crosshatch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, spacing: number = 8, color: string = 'rgba(0,0,0,0.1)'): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;
  for (let i = -h; i < w + h; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i - h, y + h);
    ctx.stroke();
  }
  ctx.restore();
}

export class HandDrawnRenderer implements GameRenderer {

  drawLane(ctx: CanvasRenderingContext2D, camera: Camera): void {
    resetWobbleSeed(42);
    const cameraY = camera.y;

    // Dark background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, -cameraY, ctx.canvas.width, ctx.canvas.height);

    // Trapezoidal lane with sketchy edges
    const topLeft = worldToScreen(0, 0);
    const topRight = worldToScreen(LANE_WIDTH, 0);
    const bottomLeft = worldToScreen(0, LANE_LENGTH);
    const bottomRight = worldToScreen(LANE_WIDTH, LANE_LENGTH);

    // Fill lane surface
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.fillStyle = COLORS.laneSurface;
    ctx.fill();

    // Crosshatch wood texture
    crosshatch(ctx, topLeft.x, 0, LANE_WIDTH, LANE_LENGTH, 12, 'rgba(139, 105, 20, 0.15)');

    // Wobbly lane border lines
    ctx.strokeStyle = COLORS.boardLine;
    ctx.lineWidth = 1;

    // Left edge
    wobblyLine(ctx, topLeft.x, topLeft.y, bottomLeft.x, bottomLeft.y, 3);
    // Right edge
    wobblyLine(ctx, topRight.x, topRight.y, bottomRight.x, bottomRight.y, 3);

    // Board lines (wobbly)
    const boardCount = 10;
    ctx.strokeStyle = COLORS.boardLine;
    ctx.lineWidth = 0.5;
    for (let i = 1; i < boardCount; i++) {
      const fraction = i / boardCount;
      const top = worldToScreen(LANE_WIDTH * fraction, 0);
      const bottom = worldToScreen(LANE_WIDTH * fraction, LANE_LENGTH);
      wobblyLine(ctx, top.x, top.y, bottom.x, bottom.y, 2);
    }

    // Arrow markers
    this.drawLaneArrows(ctx, LANE_LENGTH / 3);
    this.drawLaneArrows(ctx, (LANE_LENGTH * 2) / 3);

    // Foul line (wobbly)
    const foulY = LANE_LENGTH - 80;
    const foulLeft = worldToScreen(0, foulY);
    const foulRight = worldToScreen(LANE_WIDTH, foulY);
    ctx.strokeStyle = COLORS.foulLine;
    ctx.lineWidth = 2.5;
    wobblyLine(ctx, foulLeft.x, foulLeft.y, foulRight.x, foulRight.y, 4);
  }

  private drawLaneArrows(ctx: CanvasRenderingContext2D, worldY: number): void {
    const arrowPositions = [0.3, 0.4, 0.5, 0.6, 0.7];
    ctx.fillStyle = COLORS.laneAccent;

    for (const frac of arrowPositions) {
      const pos = worldToScreen(LANE_WIDTH * frac, worldY);
      const dotR = worldRadiusAtY(3, worldY);
      sketchyCircle(ctx, pos.x, pos.y, dotR, 8);
      ctx.fill();
    }

    // Central arrow (sketchy triangle)
    const centerPos = worldToScreen(LANE_WIDTH * 0.5, worldY);
    const arrowSize = worldRadiusAtY(6, worldY);
    ctx.beginPath();
    ctx.moveTo(jitter(centerPos.x), jitter(centerPos.y - arrowSize));
    ctx.quadraticCurveTo(
      jitter(centerPos.x - arrowSize * 0.3), jitter(centerPos.y),
      jitter(centerPos.x - arrowSize * 0.6), jitter(centerPos.y + arrowSize * 0.5)
    );
    ctx.lineTo(jitter(centerPos.x + arrowSize * 0.6), jitter(centerPos.y + arrowSize * 0.5));
    ctx.closePath();
    ctx.fill();
  }

  drawBall(ctx: CanvasRenderingContext2D, position: Vec2, angle: number): void {
    resetWobbleSeed(position.x * 7 + position.y * 13);
    const screen = worldToScreen(position.x, position.y);
    const r = worldRadiusAtY(BALL_RADIUS, position.y);

    // Ball body (sketchy circle with visible strokes)
    ctx.fillStyle = COLORS.ball;
    sketchyCircle(ctx, screen.x, screen.y, r, 16);
    ctx.fill();

    // Stroke outline for "drawn" feel
    ctx.strokeStyle = COLORS.ballHighlight;
    ctx.lineWidth = 1.5;
    sketchyCircle(ctx, screen.x, screen.y, r, 16);
    ctx.stroke();

    // Highlight scribble
    ctx.strokeStyle = 'rgba(80, 80, 140, 0.4)';
    ctx.lineWidth = 2;
    const hlAngle = -0.5;
    ctx.beginPath();
    ctx.arc(screen.x - r * 0.2, screen.y - r * 0.2, r * 0.5, hlAngle, hlAngle + 1.2);
    ctx.stroke();

    // Finger holes (sketchy circles)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    const holeRadius = r * 0.18;
    const holeDistance = r * 0.45;
    const holeAngles = [angle - 0.4, angle, angle + 0.4];
    for (const hAngle of holeAngles) {
      const hx = screen.x + Math.cos(hAngle) * holeDistance;
      const hy = screen.y + Math.sin(hAngle) * holeDistance;
      sketchyCircle(ctx, hx, hy, holeRadius, 8);
      ctx.fill();
    }
  }

  drawPin(ctx: CanvasRenderingContext2D, position: Vec2, angle: number, wobble: number): void {
    resetWobbleSeed(position.x * 11 + position.y * 17);
    const screen = worldToScreen(position.x, position.y);
    const r = worldRadiusAtY(PIN_RADIUS, position.y);

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(angle + Math.sin(wobble) * 0.1);

    // Pin body (sketchy ellipse)
    ctx.fillStyle = COLORS.pinBody;
    sketchyEllipse(ctx, 0, 0, r, r * 1.3, 14);
    ctx.fill();

    // Outline
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    sketchyEllipse(ctx, 0, 0, r, r * 1.3, 14);
    ctx.stroke();

    // Red stripes (sketchy ellipses)
    ctx.fillStyle = COLORS.pinStripe;
    sketchyEllipse(ctx, 0, -r * 0.3, r * 0.8, r * 0.15, 10);
    ctx.fill();

    sketchyEllipse(ctx, 0, r * 0.3, r * 0.8, r * 0.15, 10);
    ctx.fill();

    ctx.restore();
  }

  drawGutters(ctx: CanvasRenderingContext2D, _camera: Camera): void {
    resetWobbleSeed(99);
    ctx.fillStyle = COLORS.gutter;

    // Left gutter (filled shape with wobbly edges)
    const ltTop = worldToScreen(-GUTTER_WIDTH, 0);
    const ltBottom = worldToScreen(-GUTTER_WIDTH, LANE_LENGTH);
    const lTop = worldToScreen(0, 0);
    const lBottom = worldToScreen(0, LANE_LENGTH);

    ctx.beginPath();
    ctx.moveTo(jitter(ltTop.x, 2), ltTop.y);
    ctx.lineTo(jitter(lTop.x, 2), lTop.y);
    ctx.lineTo(jitter(lBottom.x, 2), lBottom.y);
    ctx.lineTo(jitter(ltBottom.x, 2), ltBottom.y);
    ctx.closePath();
    ctx.fill();

    // Right gutter
    const rTop = worldToScreen(LANE_WIDTH, 0);
    const rBottom = worldToScreen(LANE_WIDTH, LANE_LENGTH);
    const rtTop = worldToScreen(LANE_WIDTH + GUTTER_WIDTH, 0);
    const rtBottom = worldToScreen(LANE_WIDTH + GUTTER_WIDTH, LANE_LENGTH);

    ctx.beginPath();
    ctx.moveTo(jitter(rTop.x, 2), rTop.y);
    ctx.lineTo(jitter(rtTop.x, 2), rtTop.y);
    ctx.lineTo(jitter(rtBottom.x, 2), rtBottom.y);
    ctx.lineTo(jitter(rBottom.x, 2), rBottom.y);
    ctx.closePath();
    ctx.fill();

    // Add sketchy texture lines on gutters
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.3)';
    ctx.lineWidth = 0.5;
    for (let y = 0; y < LANE_LENGTH; y += 30) {
      const ll = worldToScreen(-GUTTER_WIDTH, y);
      const lr = worldToScreen(0, y);
      wobblyLine(ctx, ll.x, ll.y, lr.x, lr.y, 1);

      const rl = worldToScreen(LANE_WIDTH, y);
      const rr = worldToScreen(LANE_WIDTH + GUTTER_WIDTH, y);
      wobblyLine(ctx, rl.x, rl.y, rr.x, rr.y, 1);
    }
  }

  drawAimArrow(ctx: CanvasRenderingContext2D, origin: Vec2, direction: Vec2): void {
    resetWobbleSeed(77);
    const screen = worldToScreen(origin.x, origin.y);
    const mag = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (mag === 0) return;

    const nx = direction.x / mag;
    const ny = direction.y / mag;
    const arrowLength = 60;

    const endX = screen.x + nx * arrowLength;
    const endY = screen.y + ny * arrowLength;

    // Wobbly dashed line
    ctx.save();
    ctx.strokeStyle = COLORS.aimArrow;
    ctx.lineWidth = 2;

    const segments = 6;
    for (let i = 0; i < segments; i++) {
      if (i % 2 === 0) {
        const t1 = i / segments;
        const t2 = (i + 1) / segments;
        const x1 = screen.x + (endX - screen.x) * t1;
        const y1 = screen.y + (endY - screen.y) * t1;
        const x2 = screen.x + (endX - screen.x) * t2;
        const y2 = screen.y + (endY - screen.y) * t2;
        wobblyLine(ctx, x1, y1, x2, y2, 2);
      }
    }

    // Sketchy arrowhead
    const headLength = 10;
    const headAngle = Math.atan2(ny, nx);
    ctx.lineWidth = 2;
    wobblyLine(ctx, endX, endY,
      endX - headLength * Math.cos(headAngle - 0.4),
      endY - headLength * Math.sin(headAngle - 0.4), 2);
    wobblyLine(ctx, endX, endY,
      endX - headLength * Math.cos(headAngle + 0.4),
      endY - headLength * Math.sin(headAngle + 0.4), 2);

    ctx.restore();
  }

  drawCheatEffect(ctx: CanvasRenderingContext2D, cheatId: string, progress: number): void {
    resetWobbleSeed(cheatId.length * 31 + Math.floor(progress * 100));
    switch (cheatId) {
      case 'slight-curve':
        this.drawSlightCurveEffect(ctx, progress);
        break;
      case 'pin-wobble':
        this.drawPinWobbleEffect(ctx, progress);
        break;
      case 'gutter-widen':
        this.drawGutterWidenEffect(ctx, progress);
        break;
      case 'lane-tilt':
        this.drawLaneTiltEffect(ctx, progress);
        break;
      case 'cat-walk':
        this.drawCatWalkEffect(ctx, progress);
        break;
      case 'janitor-sweep':
        this.drawJanitorSweepEffect(ctx, progress);
        break;
      case 'pigeon':
        this.drawPigeonEffect(ctx, progress);
        break;
      case 'wrong-pins':
        this.drawWrongPinsEffect(ctx, progress);
        break;
      case 'pin-machine':
        this.drawPinMachineEffect(ctx, progress);
        break;
      case 'invading-ball':
        this.drawInvadingBallEffect(ctx, progress);
        break;
    }
  }

  private drawSlightCurveEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    if (progress < 0.3 || progress > 0.9) return;
    const t = (progress - 0.3) / 0.6;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#ff6666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const startX = LANE_WIDTH / 2;
    const startY = 200;
    ctx.moveTo(jitter(startX), jitter(startY));
    ctx.quadraticCurveTo(
      jitter(startX + 60 * t, 4), jitter(startY - 80 * t, 4),
      jitter(startX + 80 * t, 4), jitter(startY - 150 * t, 4)
    );
    ctx.stroke();
    ctx.restore();
  }

  private drawPinWobbleEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    const pinScreen = worldToScreen(LANE_WIDTH / 2, 60);
    const wobbleAmount = Math.sin(progress * Math.PI * 8) * 6 * (1 - progress);
    ctx.save();
    ctx.globalAlpha = 0.5 * (1 - progress);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + progress * 10;
      const r = 15 + Math.abs(wobbleAmount);
      const sx = pinScreen.x + Math.cos(a) * r;
      const sy = pinScreen.y + Math.sin(a) * r;
      sketchyCircle(ctx, sx, sy, 3, 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawGutterWidenEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    const expansion = progress * 30;
    ctx.save();
    ctx.globalAlpha = 0.6 * progress;
    ctx.fillStyle = '#1a1a1a';

    const ltTop = worldToScreen(-GUTTER_WIDTH - expansion, 0);
    const lTop = worldToScreen(expansion, 0);
    const lBottom = worldToScreen(expansion, LANE_LENGTH);
    const ltBottom = worldToScreen(-GUTTER_WIDTH - expansion, LANE_LENGTH);
    ctx.beginPath();
    ctx.moveTo(jitter(ltTop.x), ltTop.y);
    ctx.lineTo(jitter(lTop.x), lTop.y);
    ctx.lineTo(jitter(lBottom.x), lBottom.y);
    ctx.lineTo(jitter(ltBottom.x), ltBottom.y);
    ctx.closePath();
    ctx.fill();

    const rTop = worldToScreen(LANE_WIDTH - expansion, 0);
    const rBottom = worldToScreen(LANE_WIDTH - expansion, LANE_LENGTH);
    const rtTop = worldToScreen(LANE_WIDTH + GUTTER_WIDTH + expansion, 0);
    const rtBottom = worldToScreen(LANE_WIDTH + GUTTER_WIDTH + expansion, LANE_LENGTH);
    ctx.beginPath();
    ctx.moveTo(jitter(rTop.x), rTop.y);
    ctx.lineTo(jitter(rtTop.x), rtTop.y);
    ctx.lineTo(jitter(rtBottom.x), rtBottom.y);
    ctx.lineTo(jitter(rBottom.x), rBottom.y);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private drawLaneTiltEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    const tiltAngle = progress * 0.08;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.translate(LANE_WIDTH / 2, LANE_LENGTH / 2);
    ctx.rotate(tiltAngle);
    ctx.translate(-LANE_WIDTH / 2, -LANE_LENGTH / 2);
    ctx.fillStyle = 'rgba(100, 50, 0, 0.15)';
    const topLeft = worldToScreen(0, 0);
    const topRight = worldToScreen(LANE_WIDTH, 0);
    const bottomRight = worldToScreen(LANE_WIDTH, LANE_LENGTH);
    const bottomLeft = worldToScreen(0, LANE_LENGTH);
    ctx.beginPath();
    ctx.moveTo(jitter(topLeft.x), jitter(topLeft.y));
    ctx.lineTo(jitter(topRight.x), jitter(topRight.y));
    ctx.lineTo(jitter(bottomRight.x), jitter(bottomRight.y));
    ctx.lineTo(jitter(bottomLeft.x), jitter(bottomLeft.y));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawCatWalkEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    const catX = -50 + (LANE_WIDTH + 100) * progress;
    const catY = 400;
    const screen = worldToScreen(catX, catY);
    const scale = worldRadiusAtY(1, catY);

    ctx.save();

    // Body (sketchy ellipse)
    ctx.fillStyle = '#333333';
    sketchyEllipse(ctx, screen.x, screen.y, 18 * scale, 10 * scale, 10);
    ctx.fill();
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;
    sketchyEllipse(ctx, screen.x, screen.y, 18 * scale, 10 * scale, 10);
    ctx.stroke();

    // Head
    const headX = screen.x + 14 * scale * (progress > 0.5 ? 1 : -1);
    sketchyCircle(ctx, headX, screen.y - 6 * scale, 7 * scale, 8);
    ctx.fill();

    // Ears (wobbly triangles)
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;
    wobblyLine(ctx, headX - 5 * scale, screen.y - 11 * scale, headX - 2 * scale, screen.y - 18 * scale, 1);
    wobblyLine(ctx, headX - 2 * scale, screen.y - 18 * scale, headX + 1 * scale, screen.y - 11 * scale, 1);
    wobblyLine(ctx, headX + 2 * scale, screen.y - 11 * scale, headX + 5 * scale, screen.y - 18 * scale, 1);
    wobblyLine(ctx, headX + 5 * scale, screen.y - 18 * scale, headX + 8 * scale, screen.y - 11 * scale, 1);

    // Tail (wobbly curve)
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2 * scale;
    const tailDir = progress > 0.5 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(screen.x - 16 * scale * tailDir, screen.y);
    ctx.quadraticCurveTo(
      jitter(screen.x - 25 * scale * tailDir, 3), jitter(screen.y - 15 * scale, 3),
      jitter(screen.x - 20 * scale * tailDir, 3), jitter(screen.y - 25 * scale, 3)
    );
    ctx.stroke();

    // Stick-figure legs
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2 * scale;
    const legPhase = progress * 20;
    for (let i = 0; i < 4; i++) {
      const legX = screen.x + (-10 + i * 7) * scale;
      const legOffset = Math.sin(legPhase + i * Math.PI / 2) * 4 * scale;
      wobblyLine(ctx, legX, screen.y + 8 * scale, legX + legOffset, screen.y + 18 * scale, 1);
    }

    ctx.restore();
  }

  private drawJanitorSweepEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    const janitorX = LANE_WIDTH + 30 - (LANE_WIDTH + 60) * progress;
    const janitorY = 60;
    const screen = worldToScreen(janitorX, janitorY);
    const scale = worldRadiusAtY(1, janitorY);

    ctx.save();
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 2 * scale;
    ctx.lineCap = 'round';

    // Head (sketchy circle)
    sketchyCircle(ctx, screen.x, screen.y - 20 * scale, 6 * scale, 8);
    ctx.stroke();

    // Body (wobbly line)
    wobblyLine(ctx, screen.x, screen.y - 14 * scale, screen.x, screen.y + 5 * scale, 2);

    // Legs (wobbly)
    wobblyLine(ctx, screen.x, screen.y + 5 * scale, screen.x - 6 * scale, screen.y + 18 * scale, 2);
    wobblyLine(ctx, screen.x, screen.y + 5 * scale, screen.x + 6 * scale, screen.y + 18 * scale, 2);

    // Arms
    wobblyLine(ctx, screen.x, screen.y - 8 * scale, screen.x + 15 * scale, screen.y - 2 * scale, 2);

    // Broom
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3 * scale;
    const broomAngle = Math.sin(progress * Math.PI * 4) * 0.3;
    const broomX = screen.x + 15 * scale;
    const broomY = screen.y - 2 * scale;
    wobblyLine(ctx, broomX, broomY, broomX + 12 * scale * Math.cos(broomAngle), broomY + 15 * scale, 2);

    // Bristles (short wobbly lines)
    ctx.strokeStyle = '#DAA520';
    ctx.lineWidth = 1 * scale;
    const bristleX = broomX + 12 * scale * Math.cos(broomAngle);
    const bristleY = broomY + 15 * scale;
    for (let i = -3; i <= 3; i++) {
      wobblyLine(ctx, bristleX + i * 2 * scale, bristleY, bristleX + i * 3 * scale, bristleY + 6 * scale, 1);
    }

    ctx.restore();
  }

  private drawPigeonEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    const pinScreen = worldToScreen(LANE_WIDTH / 2, 60);
    const scale = worldRadiusAtY(1, 60);

    let birdX: number, birdY: number;
    if (progress < 0.3) {
      const t = progress / 0.3;
      birdX = pinScreen.x + (1 - t) * 100;
      birdY = pinScreen.y - (1 - t) * 80;
    } else if (progress < 0.6) {
      birdX = pinScreen.x;
      birdY = pinScreen.y - 12 * scale;
    } else {
      const t = (progress - 0.6) / 0.4;
      birdX = pinScreen.x - t * 60;
      birdY = pinScreen.y - 12 * scale - t * 120;
    }

    ctx.save();

    // Body (sketchy ellipse)
    ctx.fillStyle = '#777788';
    sketchyEllipse(ctx, birdX, birdY, 10 * scale, 6 * scale, 10);
    ctx.fill();
    ctx.strokeStyle = '#666677';
    ctx.lineWidth = 1;
    sketchyEllipse(ctx, birdX, birdY, 10 * scale, 6 * scale, 10);
    ctx.stroke();

    // Head
    sketchyCircle(ctx, birdX + 8 * scale, birdY - 3 * scale, 4 * scale, 8);
    ctx.fill();

    // Beak (wobbly triangle)
    ctx.fillStyle = '#FFAA00';
    ctx.beginPath();
    ctx.moveTo(jitter(birdX + 12 * scale), jitter(birdY - 3 * scale));
    ctx.lineTo(jitter(birdX + 16 * scale), jitter(birdY - 2 * scale));
    ctx.lineTo(jitter(birdX + 12 * scale), jitter(birdY - 1 * scale));
    ctx.closePath();
    ctx.fill();

    // Wings (sketchy arc)
    ctx.fillStyle = '#666677';
    const wingFlap = Math.sin(progress * Math.PI * 12) * 8 * scale;
    sketchyEllipse(ctx, birdX, birdY - wingFlap, 12 * scale, 4 * scale, 8);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#FF3300';
    sketchyCircle(ctx, birdX + 9 * scale, birdY - 4 * scale, 1.5 * scale, 6);
    ctx.fill();

    ctx.restore();
  }

  private drawWrongPinsEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    if (progress < 0.3) return;
    const alpha = Math.min((progress - 0.3) / 0.2, 1);

    ctx.save();
    ctx.globalAlpha = alpha;

    const leftPos = worldToScreen(25, 60);
    const rightPos = worldToScreen(LANE_WIDTH - 25, 60);
    const r = worldRadiusAtY(PIN_RADIUS, 60);

    for (const pos of [leftPos, rightPos]) {
      ctx.fillStyle = COLORS.pinBody;
      sketchyEllipse(ctx, pos.x, pos.y, r, r * 1.3, 12);
      ctx.fill();
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 0.5;
      sketchyEllipse(ctx, pos.x, pos.y, r, r * 1.3, 12);
      ctx.stroke();

      ctx.fillStyle = COLORS.pinStripe;
      sketchyEllipse(ctx, pos.x, pos.y - r * 0.3, r * 0.8, r * 0.15, 8);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawPinMachineEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    const machineY = -60 + progress * 120;
    const machineWidth = LANE_WIDTH * 0.8;
    const machineHeight = 40;
    const machineX = (LANE_WIDTH - machineWidth) / 2;

    const topLeft = worldToScreen(machineX, machineY);
    const topRight = worldToScreen(machineX + machineWidth, machineY);
    const bottomLeft = worldToScreen(machineX, machineY + machineHeight);
    const bottomRight = worldToScreen(machineX + machineWidth, machineY + machineHeight);

    ctx.save();

    // Sketchy machine body
    ctx.fillStyle = '#444444';
    ctx.beginPath();
    ctx.moveTo(jitter(topLeft.x), jitter(topLeft.y));
    ctx.lineTo(jitter(topRight.x), jitter(topRight.y));
    ctx.lineTo(jitter(bottomRight.x), jitter(bottomRight.y));
    ctx.lineTo(jitter(bottomLeft.x), jitter(bottomLeft.y));
    ctx.closePath();
    ctx.fill();

    // Crosshatch on machine
    crosshatch(ctx, topLeft.x, topLeft.y, topRight.x - topLeft.x, machineHeight, 6, 'rgba(100, 100, 100, 0.3)');

    // Wobbly detail lines
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const lineY = machineY + (machineHeight * i) / 4;
      const ll = worldToScreen(machineX, lineY);
      const lr = worldToScreen(machineX + machineWidth, lineY);
      wobblyLine(ctx, ll.x, ll.y, lr.x, lr.y, 2);
    }

    // Clamp arms (wobbly rectangles)
    ctx.fillStyle = '#555555';
    const clampWidth = 8;
    for (const xOffset of [machineWidth * 0.25, machineWidth * 0.75]) {
      const cl = worldToScreen(machineX + xOffset - clampWidth / 2, machineY + machineHeight);
      const cr = worldToScreen(machineX + xOffset + clampWidth / 2, machineY + machineHeight + 20);
      ctx.beginPath();
      ctx.moveTo(jitter(cl.x), jitter(cl.y));
      ctx.lineTo(jitter(cr.x), jitter(cl.y));
      ctx.lineTo(jitter(cr.x), jitter(cr.y));
      ctx.lineTo(jitter(cl.x), jitter(cr.y));
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private drawInvadingBallEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    const invaderX = LANE_WIDTH + 40 - (LANE_WIDTH + 80) * progress;
    const invaderY = 300 + progress * 200;
    const screen = worldToScreen(invaderX, invaderY);
    const r = worldRadiusAtY(BALL_RADIUS, invaderY);

    ctx.save();

    // Sketchy ball
    ctx.fillStyle = '#662222';
    sketchyCircle(ctx, screen.x, screen.y, r, 14);
    ctx.fill();

    // Highlight scribble
    ctx.strokeStyle = 'rgba(136, 68, 68, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screen.x - r * 0.2, screen.y - r * 0.2, r * 0.4, -0.5, 1);
    ctx.stroke();

    // Finger holes
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    const holeRadius = r * 0.18;
    const holeDistance = r * 0.45;
    const angle = progress * Math.PI * 4;
    for (const offset of [-0.4, 0, 0.4]) {
      const hx = screen.x + Math.cos(angle + offset) * holeDistance;
      const hy = screen.y + Math.sin(angle + offset) * holeDistance;
      sketchyCircle(ctx, hx, hy, holeRadius, 6);
      ctx.fill();
    }

    ctx.restore();
  }

  drawCaption(ctx: CanvasRenderingContext2D, text: string, progress: number): void {
    resetWobbleSeed(text.length * 7);
    const alpha = progress < 0.2
      ? progress / 0.2
      : progress > 0.8
        ? (1 - progress) / 0.2
        : 1;

    const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    const canvasWidth = ctx.canvas.width / dpr;
    const canvasHeight = ctx.canvas.height / dpr;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight * 0.85;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Slightly rotated for hand-written feel
    const rotation = (seededRandom() - 0.5) * 0.04;
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);

    // Measure text
    ctx.font = 'italic bold 20px Georgia, serif';
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const pillPadX = 18;
    const pillPadY = 12;
    const pillW = textWidth + pillPadX * 2;
    const pillH = 32 + pillPadY;

    // Sketchy background pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    const hw = pillW / 2;
    const hh = pillH / 2;
    ctx.moveTo(jitter(-hw, 3), jitter(-hh, 2));
    ctx.quadraticCurveTo(jitter(0, 2), jitter(-hh - 3, 2), jitter(hw, 3), jitter(-hh, 2));
    ctx.quadraticCurveTo(jitter(hw + 3, 2), jitter(0, 2), jitter(hw, 3), jitter(hh, 2));
    ctx.quadraticCurveTo(jitter(0, 2), jitter(hh + 3, 2), jitter(-hw, 3), jitter(hh, 2));
    ctx.quadraticCurveTo(jitter(-hw - 3, 2), jitter(0, 2), jitter(-hw, 3), jitter(-hh, 2));
    ctx.closePath();
    ctx.fill();

    // Text
    ctx.fillStyle = COLORS.caption;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fillText(text, 0, 0);

    ctx.restore();
  }

  drawPredictorText(ctx: CanvasRenderingContext2D, text: string): void {
    resetWobbleSeed(text.length * 13);
    const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    const canvasWidth = ctx.canvas.width / dpr;

    ctx.save();

    // Slight tilt
    const rotation = (seededRandom() - 0.5) * 0.03;

    ctx.font = 'italic 16px Georgia, serif';
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const pillPadX = 14;
    const pillW = textWidth + pillPadX * 2;
    const pillH = 28;
    const pillCenterX = canvasWidth / 2;
    const pillCenterY = 44 + pillH / 2;

    ctx.translate(pillCenterX, pillCenterY);
    ctx.rotate(rotation);

    // Sketchy background
    ctx.fillStyle = COLORS.predictorBg;
    const hw = pillW / 2;
    const hh = pillH / 2;
    ctx.beginPath();
    ctx.moveTo(jitter(-hw, 2), jitter(-hh, 1));
    ctx.lineTo(jitter(hw, 2), jitter(-hh, 1));
    ctx.lineTo(jitter(hw, 2), jitter(hh, 1));
    ctx.lineTo(jitter(-hw, 2), jitter(hh, 1));
    ctx.closePath();
    ctx.fill();

    // Text
    ctx.fillStyle = COLORS.predictorText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);

    ctx.restore();
  }
}
