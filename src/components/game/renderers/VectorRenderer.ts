import { GameRenderer, Vec2, Camera, GAME_CONSTANTS } from './types';

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

// Isometric perspective: lane narrows at the top (pin end)
const TOP_WIDTH_RATIO = 0.7;
const TOP_WIDTH = LANE_WIDTH * TOP_WIDTH_RATIO;

/**
 * Map a world-space X,Y to the isometric (trapezoidal) screen position.
 * Y runs from 0 (pin end / top) to LANE_LENGTH (ball end / bottom).
 * The lane is wider at the bottom and narrower at the top.
 */
function worldToScreen(worldX: number, worldY: number): Vec2 {
  const t = worldY / LANE_LENGTH; // 0 at top, 1 at bottom
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

export class VectorRenderer implements GameRenderer {

  drawLane(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const cameraY = camera.y;

    // Dark background fill
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, -cameraY, ctx.canvas.width, ctx.canvas.height);

    // Trapezoidal lane shape
    const topLeft = worldToScreen(0, 0);
    const topRight = worldToScreen(LANE_WIDTH, 0);
    const bottomLeft = worldToScreen(0, LANE_LENGTH);
    const bottomRight = worldToScreen(LANE_WIDTH, LANE_LENGTH);

    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.fillStyle = COLORS.laneSurface;
    ctx.fill();

    // Lane board lines (thin vertical lines for realism)
    const boardCount = 10;
    ctx.strokeStyle = COLORS.boardLine;
    ctx.lineWidth = 0.5;
    for (let i = 1; i < boardCount; i++) {
      const fraction = i / boardCount;
      const worldX = LANE_WIDTH * fraction;
      const top = worldToScreen(worldX, 0);
      const bottom = worldToScreen(worldX, LANE_LENGTH);
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(bottom.x, bottom.y);
      ctx.stroke();
    }

    // Arrow markers at 1/3 and 2/3 down the lane
    this.drawLaneArrows(ctx, LANE_LENGTH / 3);
    this.drawLaneArrows(ctx, (LANE_LENGTH * 2) / 3);

    // Foul line near the bottom
    const foulY = LANE_LENGTH - 80;
    const foulLeft = worldToScreen(0, foulY);
    const foulRight = worldToScreen(LANE_WIDTH, foulY);
    ctx.beginPath();
    ctx.moveTo(foulLeft.x, foulLeft.y);
    ctx.lineTo(foulRight.x, foulRight.y);
    ctx.strokeStyle = COLORS.foulLine;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawLaneArrows(ctx: CanvasRenderingContext2D, worldY: number): void {
    const arrowPositions = [0.3, 0.4, 0.5, 0.6, 0.7];
    const dotRadius = worldRadiusAtY(3, worldY);

    ctx.fillStyle = COLORS.laneAccent;
    for (const frac of arrowPositions) {
      const pos = worldToScreen(LANE_WIDTH * frac, worldY);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Central arrow shape (triangle pointing up / toward pin)
    const centerPos = worldToScreen(LANE_WIDTH * 0.5, worldY);
    const arrowSize = worldRadiusAtY(6, worldY);
    ctx.beginPath();
    ctx.moveTo(centerPos.x, centerPos.y - arrowSize);
    ctx.lineTo(centerPos.x - arrowSize * 0.6, centerPos.y + arrowSize * 0.5);
    ctx.lineTo(centerPos.x + arrowSize * 0.6, centerPos.y + arrowSize * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  drawBall(ctx: CanvasRenderingContext2D, position: Vec2, angle: number): void {
    const screen = worldToScreen(position.x, position.y);
    const r = worldRadiusAtY(BALL_RADIUS, position.y);

    // Ball body with radial gradient
    const grad = ctx.createRadialGradient(
      screen.x - r * 0.3, screen.y - r * 0.3, r * 0.1,
      screen.x, screen.y, r
    );
    grad.addColorStop(0, COLORS.ballHighlight);
    grad.addColorStop(1, COLORS.ball);

    ctx.beginPath();
    ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Three finger holes (rotate with angle)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    const holeRadius = r * 0.18;
    const holeDistance = r * 0.45;
    const holeAngles = [angle - 0.4, angle, angle + 0.4];
    for (const hAngle of holeAngles) {
      const hx = screen.x + Math.cos(hAngle) * holeDistance;
      const hy = screen.y + Math.sin(hAngle) * holeDistance;
      ctx.beginPath();
      ctx.arc(hx, hy, holeRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPin(ctx: CanvasRenderingContext2D, position: Vec2, angle: number, wobble: number): void {
    const screen = worldToScreen(position.x, position.y);
    const r = worldRadiusAtY(PIN_RADIUS, position.y);

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(angle + Math.sin(wobble) * 0.1);

    // Pin body (oval / cylinder from above)
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 1.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.pinBody;
    ctx.fill();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Red stripe(s)
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.3, r * 0.8, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.pinStripe;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(0, r * 0.3, r * 0.8, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.pinStripe;
    ctx.fill();

    ctx.restore();
  }

  drawGutters(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.fillStyle = COLORS.gutter;

    // Left gutter
    const ltTop = worldToScreen(-GUTTER_WIDTH, 0);
    const ltBottom = worldToScreen(-GUTTER_WIDTH, LANE_LENGTH);
    const lTop = worldToScreen(0, 0);
    const lBottom = worldToScreen(0, LANE_LENGTH);

    ctx.beginPath();
    ctx.moveTo(ltTop.x, ltTop.y);
    ctx.lineTo(lTop.x, lTop.y);
    ctx.lineTo(lBottom.x, lBottom.y);
    ctx.lineTo(ltBottom.x, ltBottom.y);
    ctx.closePath();
    ctx.fill();

    // Right gutter
    const rTop = worldToScreen(LANE_WIDTH, 0);
    const rBottom = worldToScreen(LANE_WIDTH, LANE_LENGTH);
    const rtTop = worldToScreen(LANE_WIDTH + GUTTER_WIDTH, 0);
    const rtBottom = worldToScreen(LANE_WIDTH + GUTTER_WIDTH, LANE_LENGTH);

    ctx.beginPath();
    ctx.moveTo(rTop.x, rTop.y);
    ctx.lineTo(rtTop.x, rtTop.y);
    ctx.lineTo(rtBottom.x, rtBottom.y);
    ctx.lineTo(rBottom.x, rBottom.y);
    ctx.closePath();
    ctx.fill();
  }

  drawAimArrow(ctx: CanvasRenderingContext2D, origin: Vec2, direction: Vec2): void {
    const screen = worldToScreen(origin.x, origin.y);
    const mag = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (mag === 0) return;

    const nx = direction.x / mag;
    const ny = direction.y / mag;
    const arrowLength = 60;

    const endX = screen.x + nx * arrowLength;
    const endY = screen.y + ny * arrowLength;

    // Dashed line
    ctx.save();
    ctx.strokeStyle = COLORS.aimArrow;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead
    const headLength = 10;
    const headAngle = Math.atan2(ny, nx);
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headLength * Math.cos(headAngle - 0.4),
      endY - headLength * Math.sin(headAngle - 0.4)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headLength * Math.cos(headAngle + 0.4),
      endY - headLength * Math.sin(headAngle + 0.4)
    );
    ctx.stroke();
    ctx.restore();
  }

  drawCheatEffect(ctx: CanvasRenderingContext2D, cheatId: string, progress: number): void {
    // Stub -- filled in by Plan 04 (cheats)
  }

  drawCaption(ctx: CanvasRenderingContext2D, text: string, progress: number): void {
    // Centered text with fade based on progress (0 to 1)
    const alpha = progress < 0.1
      ? progress / 0.1
      : progress > 0.8
        ? (1 - progress) / 0.2
        : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillStyle = COLORS.caption;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    const canvasWidth = ctx.canvas.width / (window?.devicePixelRatio || 1);
    const canvasHeight = ctx.canvas.height / (window?.devicePixelRatio || 1);
    ctx.fillText(text, canvasWidth / 2, canvasHeight * 0.85);

    ctx.restore();
  }

  drawPredictorText(ctx: CanvasRenderingContext2D, text: string): void {
    const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    const canvasWidth = ctx.canvas.width / dpr;

    ctx.save();

    // Measure text for background pill
    ctx.font = 'italic 16px Inter, sans-serif';
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const pillPadX = 14;
    const pillPadY = 8;
    const pillX = canvasWidth / 2 - textWidth / 2 - pillPadX;
    const pillY = 44;
    const pillW = textWidth + pillPadX * 2;
    const pillH = 28;
    const pillR = 14;

    // Semi-transparent dark background pill
    ctx.fillStyle = COLORS.predictorBg;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillR);
    ctx.fill();

    // Predictor text
    ctx.fillStyle = COLORS.predictorText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvasWidth / 2, pillY + pillH / 2);

    ctx.restore();
  }
}
