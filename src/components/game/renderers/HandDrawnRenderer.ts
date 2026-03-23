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
  boardLine: 'rgba(139, 105, 20, 0.3)',
} as const;

const { LANE_WIDTH, LANE_LENGTH, BALL_RADIUS, PIN_RADIUS, GUTTER_WIDTH, PIT_DEPTH } = GAME_CONSTANTS;

// Top-down view: scale world coords to fit the canvas (matches VectorRenderer)
const TOTAL_WIDTH = LANE_WIDTH + GUTTER_WIDTH * 2;
const TOTAL_HEIGHT = PIT_DEPTH + LANE_LENGTH + 60;
const SCALE = Math.min(480 / TOTAL_WIDTH, 810 / TOTAL_HEIGHT);
const X_OFFSET = (500 - TOTAL_WIDTH * SCALE) / 2;
const Y_OFFSET = (832 - TOTAL_HEIGHT * SCALE) / 2;

// Seeded random for consistent wobble per frame
let wobbleSeed = 0;
function seededRandom(): number {
  wobbleSeed = (wobbleSeed * 16807 + 7) % 2147483647;
  return (wobbleSeed % 1000) / 1000;
}

function resetWobbleSeed(seed: number): void {
  wobbleSeed = Math.abs(Math.floor(seed * 1000)) || 1;
}

function worldToScreen(worldX: number, worldY: number): Vec2 {
  const screenX = X_OFFSET + (worldX + GUTTER_WIDTH) * SCALE;
  const screenY = Y_OFFSET + (worldY + PIT_DEPTH) * SCALE;
  return { x: screenX, y: screenY };
}

function worldRadius(radius: number): number {
  return radius * SCALE;
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
    const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    const canvasWidth = ctx.canvas.width / dpr;
    const canvasHeight = ctx.canvas.height / dpr;

    // Dark background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Pit area
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

    // Crosshatch wood texture
    crosshatch(ctx, laneTL.x, laneTL.y, laneBR.x - laneTL.x, laneBR.y - laneTL.y, 12, 'rgba(139, 105, 20, 0.15)');

    // Wobbly lane border lines
    ctx.strokeStyle = COLORS.boardLine;
    ctx.lineWidth = 1;
    wobblyLine(ctx, laneTL.x, laneTL.y, laneTL.x, laneBR.y, 3);
    wobblyLine(ctx, laneBR.x, laneTL.y, laneBR.x, laneBR.y, 3);

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

    // Lane markers: chevrons at midpoint, dots near foul line
    this.drawLaneChevrons(ctx, LANE_LENGTH / 2);
    this.drawLaneDots(ctx, (LANE_LENGTH * 3) / 4);

    // Foul line (wobbly)
    const foulY = LANE_LENGTH - 160;
    const foulLeft = worldToScreen(0, foulY);
    const foulRight = worldToScreen(LANE_WIDTH, foulY);
    ctx.strokeStyle = COLORS.foulLine;
    ctx.lineWidth = 2.5;
    wobblyLine(ctx, foulLeft.x, foulLeft.y, foulRight.x, foulRight.y, 4);

    // Lane/pit boundary line
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(laneTL.x, laneTL.y);
    ctx.lineTo(laneBR.x, laneTL.y);
    ctx.stroke();
  }

  private drawLaneDots(ctx: CanvasRenderingContext2D, worldY: number): void {
    const dotPositions = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    ctx.fillStyle = '#6b4c0a';

    for (const frac of dotPositions) {
      const pos = worldToScreen(LANE_WIDTH * frac, worldY);
      const dotR = worldRadius(3);
      sketchyCircle(ctx, pos.x, pos.y, dotR, 8);
      ctx.fill();
    }
  }

  private drawLaneChevrons(ctx: CanvasRenderingContext2D, worldY: number): void {
    const positions = [
      { xFrac: 0.5, yOff: 0 },
      { xFrac: 0.5 - 0.08, yOff: 20 },  { xFrac: 0.5 + 0.08, yOff: 20 },
      { xFrac: 0.5 - 0.16, yOff: 40 },  { xFrac: 0.5 + 0.16, yOff: 40 },
      { xFrac: 0.5 - 0.24, yOff: 60 },  { xFrac: 0.5 + 0.24, yOff: 60 },
    ];
    const s = worldRadius(12);

    ctx.fillStyle = '#5a3d08';
    for (const p of positions) {
      const pos = worldToScreen(LANE_WIDTH * p.xFrac, worldY + p.yOff);
      // Sketchy chevron triangle pointing up (toward pins)
      ctx.beginPath();
      ctx.moveTo(jitter(pos.x), jitter(pos.y - s * 0.6));
      ctx.quadraticCurveTo(
        jitter(pos.x - s * 0.2), jitter(pos.y),
        jitter(pos.x - s * 0.4), jitter(pos.y + s * 0.4)
      );
      ctx.lineTo(jitter(pos.x + s * 0.4), jitter(pos.y + s * 0.4));
      ctx.closePath();
      ctx.fill();
    }
  }

  drawBall(ctx: CanvasRenderingContext2D, position: Vec2, angle: number): void {
    resetWobbleSeed(position.x * 7 + position.y * 13);
    const screen = worldToScreen(position.x, position.y);
    const r = worldRadius(BALL_RADIUS);

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
    if (position.x < -100 || position.x > LANE_WIDTH + 200 || position.y < -300 || position.y > LANE_LENGTH + 100) return;
    const s = SCALE;

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(angle + Math.sin(wobble) * 0.1);

    // Tall pin: belly low, long taper to neck, round head on top (1.5x visual scale)
    const bellyW = 15 * s;
    const baseW = 12.75 * s;
    const neckW = 5.25 * s;
    const headR = 8.25 * s;
    const totalH = 78 * s;
    const halfH = totalH / 2;

    const base = halfH;
    const bellyY = halfH - totalH * 0.3;
    const neckY = -halfH + totalH * 0.18;
    const headY = -halfH + totalH * 0.08;
    const crown = -halfH;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    sketchyEllipse(ctx, 1, base + 2 * s, baseW * 1.05, 3 * s, 8);
    ctx.fill();

    // Pin silhouette (sketchy bezier, matching VectorRenderer shape)
    ctx.fillStyle = COLORS.pinBody;
    ctx.beginPath();
    // Right side, bottom to top
    ctx.moveTo(jitter(baseW), jitter(base));
    ctx.bezierCurveTo(
      jitter(bellyW * 1.02), jitter(base),
      jitter(bellyW * 1.05), jitter(bellyY + (base - bellyY) * 0.4),
      jitter(bellyW), jitter(bellyY)
    );
    ctx.bezierCurveTo(
      jitter(bellyW * 0.9), jitter(bellyY - (bellyY - neckY) * 0.35),
      jitter(neckW * 1.5), jitter(neckY + (bellyY - neckY) * 0.2),
      jitter(neckW), jitter(neckY)
    );
    ctx.bezierCurveTo(
      jitter(neckW), jitter(neckY - (neckY - headY) * 0.3),
      jitter(headR * 1.05), jitter(headY + headR * 0.5),
      jitter(headR), jitter(headY)
    );
    ctx.bezierCurveTo(
      jitter(headR), jitter(headY - headR * 0.55),
      jitter(headR * 0.55), jitter(crown),
      jitter(0), jitter(crown)
    );
    // Left side, top to bottom
    ctx.bezierCurveTo(
      jitter(-headR * 0.55), jitter(crown),
      jitter(-headR), jitter(headY - headR * 0.55),
      jitter(-headR), jitter(headY)
    );
    ctx.bezierCurveTo(
      jitter(-headR * 1.05), jitter(headY + headR * 0.5),
      jitter(-neckW), jitter(neckY - (neckY - headY) * 0.3),
      jitter(-neckW), jitter(neckY)
    );
    ctx.bezierCurveTo(
      jitter(-neckW * 1.5), jitter(neckY + (bellyY - neckY) * 0.2),
      jitter(-bellyW * 0.9), jitter(bellyY - (bellyY - neckY) * 0.35),
      jitter(-bellyW), jitter(bellyY)
    );
    ctx.bezierCurveTo(
      jitter(-bellyW * 1.05), jitter(bellyY + (base - bellyY) * 0.4),
      jitter(-bellyW * 1.02), jitter(base),
      jitter(-baseW), jitter(base)
    );
    ctx.closePath();
    ctx.fill();

    // Sketchy outline
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Red stripes at neck
    ctx.fillStyle = COLORS.pinStripe;
    const sw = neckW * 2;
    sketchyEllipse(ctx, 0, neckY - 1.5 * s, sw, 1.2 * s, 8);
    ctx.fill();
    sketchyEllipse(ctx, 0, neckY - 6 * s, sw, 1.2 * s, 8);
    ctx.fill();

    ctx.restore();
  }

  drawGutters(ctx: CanvasRenderingContext2D, _camera: Camera): void {
    resetWobbleSeed(99);
    ctx.fillStyle = COLORS.gutter;

    // Left gutter
    const lgTL = worldToScreen(-GUTTER_WIDTH, -PIT_DEPTH);
    const lgBR = worldToScreen(0, LANE_LENGTH);
    ctx.fillRect(lgTL.x, lgTL.y, lgBR.x - lgTL.x, lgBR.y - lgTL.y);

    // Right gutter
    const rgTL = worldToScreen(LANE_WIDTH, -PIT_DEPTH);
    const rgBR = worldToScreen(LANE_WIDTH + GUTTER_WIDTH, LANE_LENGTH);
    ctx.fillRect(rgTL.x, rgTL.y, rgBR.x - rgTL.x, rgBR.y - rgTL.y);

    // Add sketchy texture lines on gutters
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.3)';
    ctx.lineWidth = 0.5;
    const laneTop = worldToScreen(0, 0);
    const laneBot = worldToScreen(0, LANE_LENGTH);
    for (let screenY = lgTL.y; screenY < lgBR.y; screenY += 30) {
      wobblyLine(ctx, lgTL.x, screenY, lgBR.x, screenY, 1);
      wobblyLine(ctx, rgTL.x, screenY, rgBR.x, screenY, 1);
    }

    // Gutter inner edge lines (wobbly)
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    wobblyLine(ctx, laneTop.x, lgTL.y, laneBot.x, lgBR.y, 2);
    const rTop = worldToScreen(LANE_WIDTH, -PIT_DEPTH);
    const rBot = worldToScreen(LANE_WIDTH, LANE_LENGTH);
    wobblyLine(ctx, rTop.x, rTop.y, rBot.x, rBot.y, 2);
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

  drawCheatEffect(ctx: CanvasRenderingContext2D, _cheatId: string, _progress: number): void {
    // TODO: re-implement cheat effects for top-down view
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
