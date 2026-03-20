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
  boardLine: 'rgba(139, 105, 20, 0.4)',
} as const;

const { LANE_WIDTH, LANE_LENGTH, BALL_RADIUS, PIN_RADIUS, GUTTER_WIDTH } = GAME_CONSTANTS;

const TOP_WIDTH_RATIO = 0.7;
const TOP_WIDTH = LANE_WIDTH * TOP_WIDTH_RATIO;
const PIXEL_SIZE = 4;

function worldToScreen(worldX: number, worldY: number): Vec2 {
  const t = worldY / LANE_LENGTH;
  const currentWidth = TOP_WIDTH + (LANE_WIDTH - TOP_WIDTH) * t;
  const leftEdge = (LANE_WIDTH - currentWidth) / 2;
  const screenX = leftEdge + (worldX / LANE_WIDTH) * currentWidth;
  return { x: screenX, y: worldY };
}

function worldRadiusAtY(radius: number, worldY: number): number {
  const t = worldY / LANE_LENGTH;
  const scale = TOP_WIDTH_RATIO + (1 - TOP_WIDTH_RATIO) * t;
  return radius * scale;
}

/** Snap coordinate to pixel grid and draw a pixel block */
function drawPixel(ctx: CanvasRenderingContext2D, x: number, y: number, size: number = PIXEL_SIZE) {
  ctx.fillRect(Math.floor(x / size) * size, Math.floor(y / size) * size, size, size);
}

/** Draw a pixelated circle using pixel blocks */
function drawPixelCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, size: number = PIXEL_SIZE) {
  const rSnap = Math.max(r, size);
  for (let py = -rSnap; py <= rSnap; py += size) {
    for (let px = -rSnap; px <= rSnap; px += size) {
      if (px * px + py * py <= rSnap * rSnap) {
        drawPixel(ctx, cx + px, cy + py, size);
      }
    }
  }
}

/** Draw a pixelated ellipse */
function drawPixelEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, size: number = PIXEL_SIZE) {
  for (let py = -ry; py <= ry; py += size) {
    for (let px = -rx; px <= rx; px += size) {
      if ((px * px) / (rx * rx) + (py * py) / (ry * ry) <= 1) {
        drawPixel(ctx, cx + px, cy + py, size);
      }
    }
  }
}

/** Draw a pixelated line using Bresenham-like stepping */
function drawPixelLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size: number = PIXEL_SIZE) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const steps = Math.max(dx, dy) / size;
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    drawPixel(ctx, x, y, size);
  }
}

export class PixelRenderer implements GameRenderer {

  drawLane(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.imageSmoothingEnabled = false;
    const cameraY = camera.y;

    // Dark background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, -cameraY, ctx.canvas.width, ctx.canvas.height);

    // Trapezoidal lane shape filled with pixel blocks
    const topLeft = worldToScreen(0, 0);
    const topRight = worldToScreen(LANE_WIDTH, 0);
    const bottomLeft = worldToScreen(0, LANE_LENGTH);
    const bottomRight = worldToScreen(LANE_WIDTH, LANE_LENGTH);

    // Fill lane row by row with pixel blocks
    ctx.fillStyle = COLORS.laneSurface;
    for (let y = 0; y < LANE_LENGTH; y += PIXEL_SIZE) {
      const t = y / LANE_LENGTH;
      const leftX = topLeft.x + (bottomLeft.x - topLeft.x) * t;
      const rightX = topRight.x + (bottomRight.x - topRight.x) * t;
      for (let x = leftX; x < rightX; x += PIXEL_SIZE) {
        drawPixel(ctx, x, y, PIXEL_SIZE);
      }
    }

    // Board lines as pixel columns
    ctx.fillStyle = COLORS.boardLine;
    const boardCount = 10;
    for (let i = 1; i < boardCount; i++) {
      const fraction = i / boardCount;
      for (let y = 0; y < LANE_LENGTH; y += PIXEL_SIZE * 3) {
        const pos = worldToScreen(LANE_WIDTH * fraction, y);
        drawPixel(ctx, pos.x, pos.y, PIXEL_SIZE);
      }
    }

    // Lane arrow dots
    this.drawLaneArrows(ctx, LANE_LENGTH / 3);
    this.drawLaneArrows(ctx, (LANE_LENGTH * 2) / 3);

    // Foul line
    const foulY = LANE_LENGTH - 80;
    ctx.fillStyle = COLORS.foulLine;
    const foulLeft = worldToScreen(0, foulY);
    const foulRight = worldToScreen(LANE_WIDTH, foulY);
    drawPixelLine(ctx, foulLeft.x, foulLeft.y, foulRight.x, foulRight.y, PIXEL_SIZE);
    drawPixelLine(ctx, foulLeft.x, foulLeft.y + PIXEL_SIZE, foulRight.x, foulRight.y + PIXEL_SIZE, PIXEL_SIZE);
  }

  private drawLaneArrows(ctx: CanvasRenderingContext2D, worldY: number): void {
    const arrowPositions = [0.3, 0.4, 0.5, 0.6, 0.7];
    ctx.fillStyle = COLORS.laneAccent;
    for (const frac of arrowPositions) {
      const pos = worldToScreen(LANE_WIDTH * frac, worldY);
      const r = worldRadiusAtY(3, worldY);
      drawPixelCircle(ctx, pos.x, pos.y, r, PIXEL_SIZE);
    }

    // Central arrow (pixel triangle)
    const centerPos = worldToScreen(LANE_WIDTH * 0.5, worldY);
    const arrowSize = worldRadiusAtY(6, worldY);
    for (let row = 0; row < arrowSize; row += PIXEL_SIZE) {
      const halfWidth = (arrowSize - row) * 0.6;
      for (let col = -halfWidth; col <= halfWidth; col += PIXEL_SIZE) {
        drawPixel(ctx, centerPos.x + col, centerPos.y - arrowSize + row, PIXEL_SIZE);
      }
    }
  }

  drawBall(ctx: CanvasRenderingContext2D, position: Vec2, angle: number): void {
    ctx.imageSmoothingEnabled = false;
    const screen = worldToScreen(position.x, position.y);
    const r = worldRadiusAtY(BALL_RADIUS, position.y);

    // Ball body
    ctx.fillStyle = COLORS.ball;
    drawPixelCircle(ctx, screen.x, screen.y, r, PIXEL_SIZE);

    // Highlight (offset circle)
    ctx.fillStyle = COLORS.ballHighlight;
    drawPixelCircle(ctx, screen.x - r * 0.3, screen.y - r * 0.3, r * 0.4, PIXEL_SIZE);

    // Three finger holes
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    const holeDistance = r * 0.45;
    const holeRadius = r * 0.18;
    const holeAngles = [angle - 0.4, angle, angle + 0.4];
    for (const hAngle of holeAngles) {
      const hx = screen.x + Math.cos(hAngle) * holeDistance;
      const hy = screen.y + Math.sin(hAngle) * holeDistance;
      drawPixelCircle(ctx, hx, hy, holeRadius, PIXEL_SIZE);
    }
  }

  drawPin(ctx: CanvasRenderingContext2D, position: Vec2, angle: number, wobble: number): void {
    ctx.imageSmoothingEnabled = false;
    const screen = worldToScreen(position.x, position.y);
    const r = worldRadiusAtY(PIN_RADIUS, position.y);

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(angle + Math.sin(wobble) * 0.1);

    // Pin body (pixel ellipse)
    ctx.fillStyle = COLORS.pinBody;
    drawPixelEllipse(ctx, 0, 0, r, r * 1.3, PIXEL_SIZE);

    // Red stripes
    ctx.fillStyle = COLORS.pinStripe;
    drawPixelEllipse(ctx, 0, -r * 0.3, r * 0.7, PIXEL_SIZE, PIXEL_SIZE);
    drawPixelEllipse(ctx, 0, r * 0.3, r * 0.7, PIXEL_SIZE, PIXEL_SIZE);

    ctx.restore();
  }

  drawGutters(ctx: CanvasRenderingContext2D, _camera: Camera): void {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COLORS.gutter;

    // Left gutter
    for (let y = 0; y < LANE_LENGTH; y += PIXEL_SIZE) {
      const t = y / LANE_LENGTH;
      const gutterLeft = worldToScreen(-GUTTER_WIDTH, y);
      const laneLeft = worldToScreen(0, y);
      for (let x = gutterLeft.x; x < laneLeft.x; x += PIXEL_SIZE) {
        drawPixel(ctx, x, y, PIXEL_SIZE);
      }
    }

    // Right gutter
    for (let y = 0; y < LANE_LENGTH; y += PIXEL_SIZE) {
      const rLane = worldToScreen(LANE_WIDTH, y);
      const rGutter = worldToScreen(LANE_WIDTH + GUTTER_WIDTH, y);
      for (let x = rLane.x; x < rGutter.x; x += PIXEL_SIZE) {
        drawPixel(ctx, x, y, PIXEL_SIZE);
      }
    }
  }

  drawAimArrow(ctx: CanvasRenderingContext2D, origin: Vec2, direction: Vec2): void {
    ctx.imageSmoothingEnabled = false;
    const screen = worldToScreen(origin.x, origin.y);
    const mag = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (mag === 0) return;

    const nx = direction.x / mag;
    const ny = direction.y / mag;
    const arrowLength = 60;

    const endX = screen.x + nx * arrowLength;
    const endY = screen.y + ny * arrowLength;

    // Dotted pixel line
    ctx.fillStyle = COLORS.aimArrow;
    const steps = Math.floor(arrowLength / (PIXEL_SIZE * 2));
    for (let i = 0; i < steps; i++) {
      if (i % 2 === 0) {
        const t = i / steps;
        const px = screen.x + (endX - screen.x) * t;
        const py = screen.y + (endY - screen.y) * t;
        drawPixel(ctx, px, py, PIXEL_SIZE);
      }
    }

    // Arrowhead (3 pixel blocks in V shape)
    const headAngle = Math.atan2(ny, nx);
    const headLen = 10;
    for (const offset of [-0.5, 0.5]) {
      const hx = endX - headLen * Math.cos(headAngle + offset);
      const hy = endY - headLen * Math.sin(headAngle + offset);
      drawPixel(ctx, hx, hy, PIXEL_SIZE);
      const hx2 = endX - headLen * 0.5 * Math.cos(headAngle + offset);
      const hy2 = endY - headLen * 0.5 * Math.sin(headAngle + offset);
      drawPixel(ctx, hx2, hy2, PIXEL_SIZE);
    }
    drawPixel(ctx, endX, endY, PIXEL_SIZE);
  }

  drawCheatEffect(ctx: CanvasRenderingContext2D, cheatId: string, progress: number): void {
    ctx.imageSmoothingEnabled = false;
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
    ctx.fillStyle = '#ff6666';
    const startX = LANE_WIDTH / 2;
    const startY = 200;
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const st = i / steps * t;
      const px = startX + 80 * st * st;
      const py = startY - 150 * st;
      drawPixel(ctx, px, py, PIXEL_SIZE);
    }
    ctx.restore();
  }

  private drawPinWobbleEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    const pinScreen = worldToScreen(LANE_WIDTH / 2, 60);
    const wobbleAmount = Math.sin(progress * Math.PI * 8) * 6 * (1 - progress);
    ctx.save();
    ctx.globalAlpha = 0.5 * (1 - progress);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + progress * 10;
      const r = 15 + Math.abs(wobbleAmount);
      drawPixel(ctx, pinScreen.x + Math.cos(a) * r, pinScreen.y + Math.sin(a) * r, PIXEL_SIZE);
    }
    ctx.restore();
  }

  private drawGutterWidenEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    const expansion = progress * 30;
    ctx.save();
    ctx.globalAlpha = 0.6 * progress;
    ctx.fillStyle = '#1a1a1a';
    for (let y = 0; y < LANE_LENGTH; y += PIXEL_SIZE * 2) {
      const left = worldToScreen(expansion, y);
      for (let x = 0; x < expansion; x += PIXEL_SIZE) {
        drawPixel(ctx, left.x - x, y, PIXEL_SIZE);
      }
      const right = worldToScreen(LANE_WIDTH - expansion, y);
      for (let x = 0; x < expansion; x += PIXEL_SIZE) {
        drawPixel(ctx, right.x + x, y, PIXEL_SIZE);
      }
    }
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
    for (let y = 0; y < LANE_LENGTH; y += PIXEL_SIZE * 4) {
      const left = worldToScreen(0, y);
      const right = worldToScreen(LANE_WIDTH, y);
      for (let x = left.x; x < right.x; x += PIXEL_SIZE * 4) {
        drawPixel(ctx, x, y, PIXEL_SIZE);
      }
    }
    ctx.restore();
  }

  private drawCatWalkEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    const catX = -50 + (LANE_WIDTH + 100) * progress;
    const catY = 400;
    const screen = worldToScreen(catX, catY);
    const scale = worldRadiusAtY(1, catY);

    ctx.save();
    ctx.fillStyle = '#333333';

    // Pixel body (rectangle)
    for (let px = -16 * scale; px <= 16 * scale; px += PIXEL_SIZE) {
      for (let py = -8 * scale; py <= 8 * scale; py += PIXEL_SIZE) {
        drawPixel(ctx, screen.x + px, screen.y + py, PIXEL_SIZE);
      }
    }

    // Pixel head
    const headX = screen.x + 14 * scale * (progress > 0.5 ? 1 : -1);
    drawPixelCircle(ctx, headX, screen.y - 6 * scale, 6 * scale, PIXEL_SIZE);

    // Pixel ears (small blocks)
    drawPixel(ctx, headX - 4 * scale, screen.y - 14 * scale, PIXEL_SIZE);
    drawPixel(ctx, headX + 2 * scale, screen.y - 14 * scale, PIXEL_SIZE);

    // Legs (pixel columns)
    const legPhase = progress * 20;
    for (let i = 0; i < 4; i++) {
      const legX = screen.x + (-10 + i * 7) * scale;
      const legOffset = Math.sin(legPhase + i * Math.PI / 2) * 3 * scale;
      drawPixel(ctx, legX + legOffset, screen.y + 10 * scale, PIXEL_SIZE);
      drawPixel(ctx, legX + legOffset, screen.y + 14 * scale, PIXEL_SIZE);
    }

    ctx.restore();
  }

  private drawJanitorSweepEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    const janitorX = LANE_WIDTH + 30 - (LANE_WIDTH + 60) * progress;
    const janitorY = 60;
    const screen = worldToScreen(janitorX, janitorY);
    const scale = worldRadiusAtY(1, janitorY);

    ctx.save();
    ctx.fillStyle = '#888888';

    // Head (pixel circle)
    drawPixelCircle(ctx, screen.x, screen.y - 20 * scale, 5 * scale, PIXEL_SIZE);

    // Body (pixel column)
    for (let py = -14 * scale; py <= 5 * scale; py += PIXEL_SIZE) {
      drawPixel(ctx, screen.x, screen.y + py, PIXEL_SIZE);
    }

    // Legs
    for (let py = 5 * scale; py <= 16 * scale; py += PIXEL_SIZE) {
      drawPixel(ctx, screen.x - 4 * scale, screen.y + py, PIXEL_SIZE);
      drawPixel(ctx, screen.x + 4 * scale, screen.y + py, PIXEL_SIZE);
    }

    // Broom handle
    ctx.fillStyle = '#8B4513';
    drawPixelLine(ctx, screen.x + 8 * scale, screen.y - 8 * scale, screen.x + 20 * scale, screen.y + 10 * scale, PIXEL_SIZE);

    // Broom bristles
    ctx.fillStyle = '#DAA520';
    for (let i = -3; i <= 3; i++) {
      drawPixel(ctx, screen.x + 20 * scale + i * 2 * scale, screen.y + 12 * scale, PIXEL_SIZE);
      drawPixel(ctx, screen.x + 20 * scale + i * 2 * scale, screen.y + 16 * scale, PIXEL_SIZE);
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
    ctx.fillStyle = '#777788';

    // Body (pixel rectangle)
    for (let px = -8 * scale; px <= 8 * scale; px += PIXEL_SIZE) {
      for (let py = -4 * scale; py <= 4 * scale; py += PIXEL_SIZE) {
        drawPixel(ctx, birdX + px, birdY + py, PIXEL_SIZE);
      }
    }

    // Head
    drawPixelCircle(ctx, birdX + 8 * scale, birdY - 3 * scale, 3 * scale, PIXEL_SIZE);

    // Beak
    ctx.fillStyle = '#FFAA00';
    drawPixel(ctx, birdX + 12 * scale, birdY - 3 * scale, PIXEL_SIZE);

    // Wings (flapping)
    ctx.fillStyle = '#666677';
    const wingFlap = Math.sin(progress * Math.PI * 12) * 6 * scale;
    drawPixel(ctx, birdX - 4 * scale, birdY - wingFlap, PIXEL_SIZE);
    drawPixel(ctx, birdX, birdY - wingFlap, PIXEL_SIZE);
    drawPixel(ctx, birdX + 4 * scale, birdY - wingFlap, PIXEL_SIZE);

    // Eye
    ctx.fillStyle = '#FF3300';
    drawPixel(ctx, birdX + 9 * scale, birdY - 4 * scale, PIXEL_SIZE);

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
      drawPixelEllipse(ctx, pos.x, pos.y, r, r * 1.3, PIXEL_SIZE);
      ctx.fillStyle = COLORS.pinStripe;
      drawPixelEllipse(ctx, pos.x, pos.y - r * 0.3, r * 0.7, PIXEL_SIZE, PIXEL_SIZE);
    }

    ctx.restore();
  }

  private drawPinMachineEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    const machineY = -60 + progress * 120;
    const machineWidth = LANE_WIDTH * 0.8;
    const machineHeight = 40;
    const machineX = (LANE_WIDTH - machineWidth) / 2;

    ctx.save();
    ctx.fillStyle = '#444444';

    // Machine body as pixel blocks
    for (let y = machineY; y < machineY + machineHeight; y += PIXEL_SIZE) {
      const left = worldToScreen(machineX, y);
      const right = worldToScreen(machineX + machineWidth, y);
      for (let x = left.x; x < right.x; x += PIXEL_SIZE) {
        drawPixel(ctx, x, y, PIXEL_SIZE);
      }
    }

    // Machine detail lines
    ctx.fillStyle = '#666666';
    for (let i = 1; i <= 3; i++) {
      const lineY = machineY + (machineHeight * i) / 4;
      const ll = worldToScreen(machineX, lineY);
      const lr = worldToScreen(machineX + machineWidth, lineY);
      drawPixelLine(ctx, ll.x, ll.y, lr.x, lr.y, PIXEL_SIZE);
    }

    // Clamp arms
    ctx.fillStyle = '#555555';
    for (const xOffset of [machineWidth * 0.25, machineWidth * 0.75]) {
      const clampPos = worldToScreen(machineX + xOffset, machineY + machineHeight);
      for (let py = 0; py < 20; py += PIXEL_SIZE) {
        drawPixel(ctx, clampPos.x, clampPos.y + py, PIXEL_SIZE);
        drawPixel(ctx, clampPos.x + PIXEL_SIZE, clampPos.y + py, PIXEL_SIZE);
      }
    }

    ctx.restore();
  }

  private drawInvadingBallEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    const invaderX = LANE_WIDTH + 40 - (LANE_WIDTH + 80) * progress;
    const invaderY = 300 + progress * 200;
    const screen = worldToScreen(invaderX, invaderY);
    const r = worldRadiusAtY(BALL_RADIUS, invaderY);

    ctx.save();
    ctx.fillStyle = '#662222';
    drawPixelCircle(ctx, screen.x, screen.y, r, PIXEL_SIZE);

    // Highlight
    ctx.fillStyle = '#884444';
    drawPixelCircle(ctx, screen.x - r * 0.3, screen.y - r * 0.3, r * 0.3, PIXEL_SIZE);

    // Holes
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    const holeDistance = r * 0.45;
    const holeRadius = r * 0.18;
    const angle = progress * Math.PI * 4;
    for (const offset of [-0.4, 0, 0.4]) {
      const hx = screen.x + Math.cos(angle + offset) * holeDistance;
      const hy = screen.y + Math.sin(angle + offset) * holeDistance;
      drawPixelCircle(ctx, hx, hy, holeRadius, PIXEL_SIZE);
    }

    ctx.restore();
  }

  drawCaption(ctx: CanvasRenderingContext2D, text: string, progress: number): void {
    ctx.imageSmoothingEnabled = false;
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

    // Pixelated text style (monospace, all caps)
    ctx.font = 'bold 18px monospace';
    const metrics = ctx.measureText(text.toUpperCase());
    const textWidth = metrics.width;
    const pillPadX = 16;
    const pillPadY = 10;
    const pillW = textWidth + pillPadX * 2;
    const pillH = 30 + pillPadY;
    const pillX = centerX - pillW / 2;
    const pillY = centerY - pillH / 2;

    // Background (pixel blocks for retro feel)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    // Snap to pixel grid
    const snapX = Math.floor(pillX / PIXEL_SIZE) * PIXEL_SIZE;
    const snapY = Math.floor(pillY / PIXEL_SIZE) * PIXEL_SIZE;
    const snapW = Math.ceil(pillW / PIXEL_SIZE) * PIXEL_SIZE;
    const snapH = Math.ceil(pillH / PIXEL_SIZE) * PIXEL_SIZE;
    ctx.fillRect(snapX, snapY, snapW, snapH);

    // Text
    ctx.fillStyle = COLORS.caption;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), centerX, centerY);

    ctx.restore();
  }

  drawPredictorText(ctx: CanvasRenderingContext2D, text: string): void {
    ctx.imageSmoothingEnabled = false;
    const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    const canvasWidth = ctx.canvas.width / dpr;

    ctx.save();

    ctx.font = 'bold 14px monospace';
    const metrics = ctx.measureText(text.toUpperCase());
    const textWidth = metrics.width;
    const pillPadX = 14;
    const pillX = Math.floor((canvasWidth / 2 - textWidth / 2 - pillPadX) / PIXEL_SIZE) * PIXEL_SIZE;
    const pillY = 44;
    const pillW = Math.ceil((textWidth + pillPadX * 2) / PIXEL_SIZE) * PIXEL_SIZE;
    const pillH = 28;

    // Background
    ctx.fillStyle = COLORS.predictorBg;
    ctx.fillRect(pillX, pillY, pillW, pillH);

    // Text
    ctx.fillStyle = COLORS.predictorText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), canvasWidth / 2, pillY + pillH / 2);

    ctx.restore();
  }
}
