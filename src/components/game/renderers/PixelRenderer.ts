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
  pit: '#0a0a0a',
  wall: '#333333',
  aimArrow: 'rgba(255, 255, 255, 0.6)',
  caption: '#ffffff',
  predictorText: 'rgba(255, 255, 100, 0.8)',
  predictorBg: 'rgba(0, 0, 0, 0.5)',
  foulLine: '#ff4444',
  boardLine: 'rgba(139, 105, 20, 0.4)',
} as const;

const { LANE_WIDTH, LANE_LENGTH, BALL_RADIUS, PIN_RADIUS, GUTTER_WIDTH, PIT_DEPTH } = GAME_CONSTANTS;

const PIXEL_SIZE = 4;

// Top-down view: scale world coords to fit the canvas (matches VectorRenderer)
const TOTAL_WIDTH = LANE_WIDTH + GUTTER_WIDTH * 2;
const TOTAL_HEIGHT = PIT_DEPTH + LANE_LENGTH + 60;
const SCALE = Math.min(480 / TOTAL_WIDTH, 810 / TOTAL_HEIGHT);
const X_OFFSET = (500 - TOTAL_WIDTH * SCALE) / 2;
const Y_OFFSET = (832 - TOTAL_HEIGHT * SCALE) / 2;

function worldToScreen(worldX: number, worldY: number): Vec2 {
  const screenX = X_OFFSET + (worldX + GUTTER_WIDTH) * SCALE;
  const screenY = Y_OFFSET + (worldY + PIT_DEPTH) * SCALE;
  return { x: screenX, y: screenY };
}

function worldRadius(radius: number): number {
  return radius * SCALE;
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
    const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    const canvasWidth = ctx.canvas.width / dpr;
    const canvasHeight = ctx.canvas.height / dpr;

    // Dark background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Pit area (dark floor behind the pins)
    const pitTL = worldToScreen(0, -PIT_DEPTH);
    const pitBR = worldToScreen(LANE_WIDTH, 0);
    ctx.fillStyle = COLORS.pit;
    ctx.fillRect(pitTL.x, pitTL.y, pitBR.x - pitTL.x, pitBR.y - pitTL.y);

    // Back wall
    const wallTL = worldToScreen(-GUTTER_WIDTH, -PIT_DEPTH);
    const wallBR = worldToScreen(LANE_WIDTH + GUTTER_WIDTH, -PIT_DEPTH);
    const wallHeight = 12 * SCALE;
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(wallTL.x, wallTL.y - wallHeight, wallBR.x - wallTL.x, wallHeight);

    // Lane surface (rectangle in top-down)
    const laneTL = worldToScreen(0, 0);
    const laneBR = worldToScreen(LANE_WIDTH, LANE_LENGTH);
    ctx.fillStyle = COLORS.laneSurface;
    ctx.fillRect(laneTL.x, laneTL.y, laneBR.x - laneTL.x, laneBR.y - laneTL.y);

    // Board lines as pixel columns
    ctx.fillStyle = COLORS.boardLine;
    const boardCount = 10;
    for (let i = 1; i < boardCount; i++) {
      const fraction = i / boardCount;
      const top = worldToScreen(LANE_WIDTH * fraction, 0);
      const bottom = worldToScreen(LANE_WIDTH * fraction, LANE_LENGTH);
      for (let y = top.y; y < bottom.y; y += PIXEL_SIZE * 3) {
        drawPixel(ctx, top.x, y, PIXEL_SIZE);
      }
    }

    // Lane markers: chevrons at midpoint, dots near foul line
    this.drawLaneChevrons(ctx, LANE_LENGTH / 2);
    this.drawLaneDots(ctx, (LANE_LENGTH * 3) / 4);

    // Foul line
    const foulY = LANE_LENGTH - 160;
    ctx.fillStyle = COLORS.foulLine;
    const foulLeft = worldToScreen(0, foulY);
    const foulRight = worldToScreen(LANE_WIDTH, foulY);
    drawPixelLine(ctx, foulLeft.x, foulLeft.y, foulRight.x, foulRight.y, PIXEL_SIZE);
    drawPixelLine(ctx, foulLeft.x, foulLeft.y + PIXEL_SIZE, foulRight.x, foulRight.y + PIXEL_SIZE, PIXEL_SIZE);

    // Lane/pit boundary line
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    drawPixelLine(ctx, laneTL.x, laneTL.y, laneBR.x, laneTL.y, PIXEL_SIZE);
  }

  private drawLaneDots(ctx: CanvasRenderingContext2D, worldY: number): void {
    const dotPositions = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    ctx.fillStyle = '#6b4c0a';
    for (const frac of dotPositions) {
      const pos = worldToScreen(LANE_WIDTH * frac, worldY);
      const r = worldRadius(3);
      drawPixelCircle(ctx, pos.x, pos.y, r, PIXEL_SIZE);
    }
  }

  private drawLaneChevrons(ctx: CanvasRenderingContext2D, worldY: number): void {
    const positions = [
      { xFrac: 0.5, yOff: 0 },
      { xFrac: 0.5 - 0.08, yOff: 20 },  { xFrac: 0.5 + 0.08, yOff: 20 },
      { xFrac: 0.5 - 0.16, yOff: 40 },  { xFrac: 0.5 + 0.16, yOff: 40 },
      { xFrac: 0.5 - 0.24, yOff: 60 },  { xFrac: 0.5 + 0.24, yOff: 60 },
    ];
    const arrowSize = worldRadius(12);

    ctx.fillStyle = '#5a3d08';
    for (const p of positions) {
      const pos = worldToScreen(LANE_WIDTH * p.xFrac, worldY + p.yOff);
      // Pixel triangle pointing up (toward pins)
      for (let row = 0; row < arrowSize; row += PIXEL_SIZE) {
        const halfWidth = (arrowSize - row) * 0.4;
        for (let col = -halfWidth; col <= halfWidth; col += PIXEL_SIZE) {
          drawPixel(ctx, pos.x + col, pos.y - arrowSize * 0.6 + row, PIXEL_SIZE);
        }
      }
    }
  }

  drawBall(ctx: CanvasRenderingContext2D, position: Vec2, angle: number): void {
    ctx.imageSmoothingEnabled = false;
    const screen = worldToScreen(position.x, position.y);
    const r = worldRadius(BALL_RADIUS);

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
    if (position.x < -100 || position.x > LANE_WIDTH + 200 || position.y < -300 || position.y > LANE_LENGTH + 100) return;
    const s = SCALE;

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(angle + Math.sin(wobble) * 0.1);

    // USBC regulation pin profile, pixelated
    const pinScale = 75 * s / 15; // 1.5x visual scale

    // [inches from base, radius in inches]
    const profile: [number, number][] = [
      [0, 1.015], [0.75, 1.415], [2.25, 1.955], [3.375, 2.255],
      [4.5, 2.383], [5.875, 2.280], [8.625, 1.235], [9.375, 0.985],
      [10.0, 0.890], [10.875, 0.935], [11.75, 1.045], [13.5, 1.274],
      [14.5, 0.9], [15.0, 0],
    ];

    const totalH = 15 * pinScale;
    const halfH = totalH / 2;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    drawPixelEllipse(ctx, 1, halfH + 2, profile[0][1] * pinScale * 1.3, 3 * s, PIXEL_SIZE);

    // Interpolate radius at any Y
    function radiusAtY(inchesFromBase: number): number {
      for (let i = 0; i < profile.length - 1; i++) {
        if (inchesFromBase >= profile[i][0] && inchesFromBase <= profile[i + 1][0]) {
          const t = (inchesFromBase - profile[i][0]) / (profile[i + 1][0] - profile[i][0]);
          return profile[i][1] + (profile[i + 1][1] - profile[i][1]) * t;
        }
      }
      return 0;
    }

    // Draw row by row
    ctx.fillStyle = COLORS.pinBody;
    for (let screenY = -halfH; screenY <= halfH; screenY += PIXEL_SIZE) {
      const inchesFromBase = (halfH - screenY) / pinScale;
      const r = radiusAtY(inchesFromBase) * pinScale;
      for (let px = -r; px <= r; px += PIXEL_SIZE) {
        drawPixel(ctx, px, screenY, PIXEL_SIZE);
      }
    }

    // Red stripes at neck (10" from base)
    ctx.fillStyle = COLORS.pinStripe;
    const neckY = halfH - 10.0 * pinScale;
    const sw = 0.89 * pinScale * 1.8;
    for (let px = -sw; px <= sw; px += PIXEL_SIZE) {
      drawPixel(ctx, px, neckY, PIXEL_SIZE);
      drawPixel(ctx, px, neckY + PIXEL_SIZE, PIXEL_SIZE);
      drawPixel(ctx, px, neckY - 1.2 * pinScale, PIXEL_SIZE);
      drawPixel(ctx, px, neckY - 1.2 * pinScale + PIXEL_SIZE, PIXEL_SIZE);
    }

    ctx.restore();
  }

  drawGutters(ctx: CanvasRenderingContext2D, _camera: Camera): void {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COLORS.gutter;

    // Left gutter
    const lgTL = worldToScreen(-GUTTER_WIDTH, -PIT_DEPTH);
    const lgBR = worldToScreen(0, LANE_LENGTH);
    ctx.fillRect(lgTL.x, lgTL.y, lgBR.x - lgTL.x, lgBR.y - lgTL.y);

    // Right gutter
    const rgTL = worldToScreen(LANE_WIDTH, -PIT_DEPTH);
    const rgBR = worldToScreen(LANE_WIDTH + GUTTER_WIDTH, LANE_LENGTH);
    ctx.fillRect(rgTL.x, rgTL.y, rgBR.x - rgTL.x, rgBR.y - rgTL.y);

    // Gutter inner edge lines
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    const liTop = worldToScreen(0, -PIT_DEPTH);
    const liBot = worldToScreen(0, LANE_LENGTH);
    drawPixelLine(ctx, liTop.x, liTop.y, liBot.x, liBot.y, PIXEL_SIZE);
    const riTop = worldToScreen(LANE_WIDTH, -PIT_DEPTH);
    const riBot = worldToScreen(LANE_WIDTH, LANE_LENGTH);
    drawPixelLine(ctx, riTop.x, riTop.y, riBot.x, riBot.y, PIXEL_SIZE);
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

  drawCheatEffect(ctx: CanvasRenderingContext2D, _cheatId: string, _progress: number): void {
    // TODO: re-implement cheat effects for top-down view
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
