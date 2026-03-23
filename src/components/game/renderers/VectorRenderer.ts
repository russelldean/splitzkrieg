import { GameRenderer, Vec2, Camera, GAME_CONSTANTS } from './types';

const COLORS = {
  background: '#1a1a2e',
  laneSurface: '#c4956a',
  laneAccent: '#8b6914',
  gutter: '#2a2a2a',
  gutterInner: '#222222',
  ball: '#8b1a1a',
  ballHighlight: '#cc3333',
  ballSwirl: '#a02020',
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

// Top-down view: scale world coords to fit the canvas
const TOTAL_WIDTH = LANE_WIDTH + GUTTER_WIDTH * 2;    // 576
const TOTAL_HEIGHT = PIT_DEPTH + LANE_LENGTH + 60;     // 1340
// Scale to fit: must fit both width (~500px) and height (~832px)
const SCALE = Math.min(480 / TOTAL_WIDTH, 810 / TOTAL_HEIGHT);  // ~0.60
const X_OFFSET = (500 - TOTAL_WIDTH * SCALE) / 2;  // Center horizontally
const Y_OFFSET = (832 - TOTAL_HEIGHT * SCALE) / 2; // Center vertically

/**
 * Top-down: world X,Y maps directly to screen with scale.
 * Y=0 is the lane/pit boundary. Negative Y is the pit. Positive Y is the lane.
 * Screen Y=0 is the top (back wall), screen Y increases downward.
 */
function worldToScreen(worldX: number, worldY: number): Vec2 {
  // World: X goes 0..LANE_WIDTH (lane), with gutters at -GUTTER_WIDTH..0 and LANE_WIDTH..LANE_WIDTH+GUTTER_WIDTH
  // World: Y goes -PIT_DEPTH (back wall) to LANE_LENGTH (foul line area)
  // Screen: shift so -GUTTER_WIDTH maps to 0, -PIT_DEPTH maps to 0
  const screenX = X_OFFSET + (worldX + GUTTER_WIDTH) * SCALE;
  const screenY = Y_OFFSET + (worldY + PIT_DEPTH) * SCALE;
  return { x: screenX, y: screenY };
}

function worldRadius(radius: number): number {
  return radius * SCALE;
}

export class VectorRenderer implements GameRenderer {

  drawLane(ctx: CanvasRenderingContext2D, camera: Camera): void {
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

    // Back wall (top edge of pit)
    const wallTL = worldToScreen(-GUTTER_WIDTH, -PIT_DEPTH);
    const wallBR = worldToScreen(LANE_WIDTH + GUTTER_WIDTH, -PIT_DEPTH);
    const wallHeight = 12 * SCALE;
    const wallGrad = ctx.createLinearGradient(0, wallTL.y - wallHeight, 0, wallTL.y);
    wallGrad.addColorStop(0, '#555555');
    wallGrad.addColorStop(1, '#222222');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(wallTL.x, wallTL.y - wallHeight, wallBR.x - wallTL.x, wallHeight);

    // Rubber cushion strip
    ctx.fillStyle = '#111111';
    ctx.fillRect(wallTL.x, wallTL.y - 2, wallBR.x - wallTL.x, 2);

    // Lane surface
    const laneTL = worldToScreen(0, 0);
    const laneBR = worldToScreen(LANE_WIDTH, LANE_LENGTH);
    ctx.fillStyle = COLORS.laneSurface;
    ctx.fillRect(laneTL.x, laneTL.y, laneBR.x - laneTL.x, laneBR.y - laneTL.y);

    // Lane board lines
    const boardCount = 10;
    ctx.strokeStyle = COLORS.boardLine;
    ctx.lineWidth = 0.5;
    for (let i = 1; i < boardCount; i++) {
      const worldX = LANE_WIDTH * (i / boardCount);
      const top = worldToScreen(worldX, 0);
      const bottom = worldToScreen(worldX, LANE_LENGTH);
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(bottom.x, bottom.y);
      ctx.stroke();
    }

    // Lane markers: chevrons at midpoint, dots near foul line
    this.drawLaneChevrons(ctx, LANE_LENGTH / 2);
    this.drawLaneDots(ctx, (LANE_LENGTH * 3) / 4);

    // Foul line
    const foulY = LANE_LENGTH - 160;
    const foulLeft = worldToScreen(0, foulY);
    const foulRight = worldToScreen(LANE_WIDTH, foulY);
    ctx.beginPath();
    ctx.moveTo(foulLeft.x, foulLeft.y);
    ctx.lineTo(foulRight.x, foulRight.y);
    ctx.strokeStyle = COLORS.foulLine;
    ctx.lineWidth = 2;
    ctx.stroke();

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
    const dotR = worldRadius(3);

    ctx.fillStyle = '#6b4c0a';
    for (const frac of dotPositions) {
      const pos = worldToScreen(LANE_WIDTH * frac, worldY);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawLaneChevrons(ctx: CanvasRenderingContext2D, worldY: number): void {
    // V-pattern chevrons pointing toward pins (negative Y direction)
    // Symmetric from center, each chevron steps further from centerline and further from foul line
    const chevronSize = worldRadius(12);
    const positions = [
      { xFrac: 0.5, yOff: 0 },
      { xFrac: 0.5 - 0.08, yOff: 20 },  { xFrac: 0.5 + 0.08, yOff: 20 },
      { xFrac: 0.5 - 0.16, yOff: 40 },  { xFrac: 0.5 + 0.16, yOff: 40 },
      { xFrac: 0.5 - 0.24, yOff: 60 },  { xFrac: 0.5 + 0.24, yOff: 60 },
    ];

    ctx.fillStyle = '#5a3d08';
    for (const p of positions) {
      const pos = worldToScreen(LANE_WIDTH * p.xFrac, worldY + p.yOff);
      // Small chevron/triangle pointing up (toward pins)
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y - chevronSize * 0.6);
      ctx.lineTo(pos.x - chevronSize * 0.4, pos.y + chevronSize * 0.4);
      ctx.lineTo(pos.x + chevronSize * 0.4, pos.y + chevronSize * 0.4);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawBall(ctx: CanvasRenderingContext2D, position: Vec2, angle: number): void {
    const screen = worldToScreen(position.x, position.y);
    const r = worldRadius(BALL_RADIUS);

    ctx.save();

    // Ball circle clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
    ctx.clip();

    // Red gradient
    const grad = ctx.createRadialGradient(
      screen.x - r * 0.3, screen.y - r * 0.3, r * 0.1,
      screen.x, screen.y, r
    );
    grad.addColorStop(0, COLORS.ballHighlight);
    grad.addColorStop(0.7, COLORS.ball);
    grad.addColorStop(1, '#5a0e0e');
    ctx.fillStyle = grad;
    ctx.fillRect(screen.x - r, screen.y - r, r * 2, r * 2);

    // Swirl pattern
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = COLORS.ballSwirl;
    ctx.lineWidth = r * 0.18;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const baseAngle = angle + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.05) {
        const wave = Math.sin(t * Math.PI * 2.5 + i) * r * 0.3;
        const dist = t * r * 0.9;
        const px = screen.x + Math.cos(baseAngle) * dist + Math.cos(baseAngle + Math.PI / 2) * wave;
        const py = screen.y + Math.sin(baseAngle) * dist + Math.sin(baseAngle + Math.PI / 2) * wave;
        if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Sheen
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(screen.x - r * 0.15, screen.y - r * 0.2, r * 0.7, r * 0.35, -0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // end ball clip

    // Finger holes
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    const holeR = r * 0.16;
    const holeDist = r * 0.4;
    const holes = [
      { a: angle - 0.35, d: holeDist, s: holeR },
      { a: angle + 0.35, d: holeDist, s: holeR },
      { a: angle + Math.PI - 0.1, d: holeDist * 0.7, s: holeR * 1.15 },
    ];
    for (const h of holes) {
      const hx = screen.x + Math.cos(h.a) * h.d;
      const hy = screen.y + Math.sin(h.a) * h.d;
      ctx.beginPath();
      ctx.arc(hx, hy, h.s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(hx + h.s * 0.15, hy + h.s * 0.15, h.s * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    }

    ctx.restore();
  }

  drawPin(ctx: CanvasRenderingContext2D, position: Vec2, angle: number, wobble: number): void {
    const screen = worldToScreen(position.x, position.y);
    if (position.x < -100 || position.x > LANE_WIDTH + 200 || position.y < -300 || position.y > LANE_LENGTH + 100) return;
    const s = SCALE;

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(angle + Math.sin(wobble) * 0.1);

    // USBC regulation bowling pin profile
    // Height: 15", Max diameter (belly): 4.766" at 4.5" from base
    // Scaled so pin height = 50 * SCALE units
    const pinScale = 75 * s / 15; // world units per inch (1.5x visual scale)

    // USBC diameter profile: [inches from base, radius in inches]
    const profile: [number, number][] = [
      [0,      1.015],   // base
      [0.75,   1.415],   // base flare
      [2.25,   1.955],   // lower belly
      [3.375,  2.255],   // upper belly approach
      [4.5,    2.383],   // BELLY (widest)
      [5.875,  2.280],   // below waist
      [8.625,  1.235],   // upper taper
      [9.375,  0.985],   // approaching neck
      [10.0,   0.890],   // NECK (narrowest)
      [10.875, 0.935],   // below head
      [11.75,  1.045],   // lower head
      [13.5,   1.274],   // HEAD (widest of head)
      [14.5,   0.9],     // above head (approaching dome)
      [15.0,   0],        // crown
    ];

    const totalH = 15 * pinScale;
    const halfH = totalH / 2;

    // Convert profile to screen coords (0,0 = pin center)
    const points = profile.map(([y, r]) => ({
      y: halfH - y * pinScale,  // flip: base at bottom (positive), crown at top (negative)
      r: r * pinScale,
    }));

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(1 * s, halfH + 2 * s, points[0].r * 1.3, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw pin using smooth curve through profile points
    ctx.fillStyle = COLORS.pinBody;
    ctx.beginPath();

    // Right side (top to bottom)
    ctx.moveTo(0, -halfH); // crown
    for (let i = points.length - 2; i >= 0; i--) {
      const p = points[i];
      ctx.lineTo(p.r, p.y);
    }
    // Flat base
    ctx.lineTo(-points[0].r, points[0].y);
    // Left side (bottom to top)
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      ctx.lineTo(-p.r, p.y);
    }
    ctx.closePath();

    // Smooth it with a second pass using quadratic curves
    ctx.fill();

    // Now draw a smooth version on top
    ctx.beginPath();
    ctx.moveTo(0, -halfH);
    // Right side, crown to base
    for (let i = points.length - 2; i >= 0; i--) {
      const curr = points[i];
      const prev = i < points.length - 2 ? points[i + 1] : { y: -halfH, r: 0 };
      const midY = (prev.y + curr.y) / 2;
      const midR = (prev.r + curr.r) / 2;
      ctx.quadraticCurveTo(prev.r, prev.y, midR, midY);
    }
    ctx.lineTo(points[0].r, points[0].y);
    // Base
    ctx.lineTo(-points[0].r, points[0].y);
    // Left side, base to crown
    for (let i = 1; i < points.length; i++) {
      const curr = points[i];
      const prev = points[i - 1];
      const midY = (prev.y + curr.y) / 2;
      const midR = -(prev.r + curr.r) / 2;
      ctx.quadraticCurveTo(-prev.r, prev.y, midR, midY);
    }
    ctx.lineTo(0, -halfH);
    ctx.closePath();
    ctx.fillStyle = COLORS.pinBody;
    ctx.fill();

    // Outline
    ctx.strokeStyle = 'rgba(180, 180, 170, 0.5)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Red stripes at neck (10" from base = neck position)
    const neckScreenY = halfH - 10.0 * pinScale;
    const stripeW = 0.89 * pinScale * 1.8;
    ctx.fillStyle = COLORS.pinStripe;
    ctx.fillRect(-stripeW, neckScreenY - 0.3 * pinScale, stripeW * 2, 0.6 * pinScale);
    ctx.fillRect(-stripeW, neckScreenY - 1.5 * pinScale, stripeW * 2, 0.6 * pinScale);

    // 3D highlight on belly
    const bellyScreenY = halfH - 4.5 * pinScale;
    const bellyR = 2.383 * pinScale;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.ellipse(-bellyR * 0.3, bellyScreenY, bellyR * 0.2, 2 * pinScale, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Shading on right
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.beginPath();
    ctx.ellipse(bellyR * 0.3, bellyScreenY, bellyR * 0.2, 1.5 * pinScale, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawGutters(ctx: CanvasRenderingContext2D, camera: Camera): void {
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
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    // Left inner
    const liTop = worldToScreen(0, -PIT_DEPTH);
    const liBot = worldToScreen(0, LANE_LENGTH);
    ctx.beginPath();
    ctx.moveTo(liTop.x, liTop.y);
    ctx.lineTo(liBot.x, liBot.y);
    ctx.stroke();
    // Right inner
    const riTop = worldToScreen(LANE_WIDTH, -PIT_DEPTH);
    const riBot = worldToScreen(LANE_WIDTH, LANE_LENGTH);
    ctx.beginPath();
    ctx.moveTo(riTop.x, riTop.y);
    ctx.lineTo(riBot.x, riBot.y);
    ctx.stroke();
  }

  drawAimArrow(ctx: CanvasRenderingContext2D, origin: Vec2, direction: Vec2): void {
    const screen = worldToScreen(origin.x, origin.y);
    const mag = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (mag === 0) return;

    const nx = direction.x / mag;
    const ny = direction.y / mag;
    const arrowLength = 80;
    const endX = screen.x + nx * arrowLength;
    const endY = screen.y + ny * arrowLength;

    ctx.save();
    ctx.strokeStyle = COLORS.aimArrow;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);

    const headLength = 10;
    const headAngle = Math.atan2(ny, nx);
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLength * Math.cos(headAngle - 0.4), endY - headLength * Math.sin(headAngle - 0.4));
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLength * Math.cos(headAngle + 0.4), endY - headLength * Math.sin(headAngle + 0.4));
    ctx.stroke();
    ctx.restore();
  }

  drawCheatEffect(ctx: CanvasRenderingContext2D, cheatId: string, progress: number): void {
    // TODO: re-implement cheat effects for top-down view
  }

  drawCaption(ctx: CanvasRenderingContext2D, text: string, progress: number): void {
    const alpha = progress < 0.2 ? progress / 0.2 : progress > 0.8 ? (1 - progress) / 0.2 : 1;
    const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    const canvasWidth = ctx.canvas.width / dpr;
    const canvasHeight = ctx.canvas.height / dpr;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 20px Inter, sans-serif';
    const metrics = ctx.measureText(text);
    const pillW = metrics.width + 32;
    const pillH = 42;
    const pillX = canvasWidth / 2 - pillW / 2;
    const pillY = canvasHeight * 0.85 - pillH / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    ctx.fillStyle = COLORS.caption;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvasWidth / 2, canvasHeight * 0.85);
    ctx.restore();
  }

  drawPredictorText(ctx: CanvasRenderingContext2D, text: string): void {
    const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    const canvasWidth = ctx.canvas.width / dpr;

    ctx.save();
    ctx.font = 'italic 16px Inter, sans-serif';
    const metrics = ctx.measureText(text);
    const pillW = metrics.width + 28;
    const pillH = 28;
    const pillX = canvasWidth / 2 - pillW / 2;
    const pillY = 44;

    ctx.fillStyle = COLORS.predictorBg;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 14);
    ctx.fill();

    ctx.fillStyle = COLORS.predictorText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvasWidth / 2, pillY + pillH / 2);
    ctx.restore();
  }
}
