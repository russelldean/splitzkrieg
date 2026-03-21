import { GameRenderer, Vec2, Camera, GAME_CONSTANTS } from './types';

const COLORS = {
  background: '#1a1a2e',
  laneSurface: '#c4956a',
  laneAccent: '#8b6914',
  gutter: '#2a2a2a',
  ball: '#8b1a1a',
  ballHighlight: '#cc3333',
  ballSwirl: '#a02020',
  pinBody: '#f5f5f0',
  pinStripe: '#cc3333',
  backWall: '#2e2e2e',
  backWallTop: '#3a3a3a',
  backWallCushion: '#1a1a1a',
  aimArrow: 'rgba(255, 255, 255, 0.6)',
  caption: '#ffffff',
  predictorText: 'rgba(255, 255, 100, 0.8)',
  predictorBg: 'rgba(0, 0, 0, 0.5)',
  foulLine: '#ff4444',
  boardLine: 'rgba(139, 105, 20, 0.3)',
} as const;

const { LANE_WIDTH, LANE_LENGTH, BALL_RADIUS, PIN_RADIUS, GUTTER_WIDTH } = GAME_CONSTANTS;

// Near-floor-level perspective: lane narrows sharply toward the pins
const TOP_WIDTH_RATIO = 0.18;
const TOP_WIDTH = LANE_WIDTH * TOP_WIDTH_RATIO;

// Horizontal offset so the left gutter isn't clipped off the canvas edge
const X_OFFSET = GUTTER_WIDTH;

// Strong vertical foreshortening: far end is highly compressed,
// near end (ball area) stretches out like you're crouching behind it
const PERSPECTIVE_POWER = 2.5;

/**
 * Map a world-space X,Y to the perspective screen position.
 * Y runs from 0 (pin end / top) to LANE_LENGTH (ball end / bottom).
 * The lane is wider at the bottom and narrower at the top.
 * Y is also compressed at the far end for depth foreshortening.
 */
function worldToScreen(worldX: number, worldY: number): Vec2 {
  const t = Math.max(0, Math.min(1, worldY / LANE_LENGTH)); // 0 at top, 1 at bottom
  // Foreshorten Y: compress the far (top) end, stretch the near (bottom) end
  const screenT = Math.pow(t, 1 / PERSPECTIVE_POWER);
  const screenY = screenT * LANE_LENGTH;

  const currentWidth = TOP_WIDTH + (LANE_WIDTH - TOP_WIDTH) * t;
  const leftEdge = (LANE_WIDTH - currentWidth) / 2;
  const screenX = X_OFFSET + leftEdge + (worldX / LANE_WIDTH) * currentWidth;
  return { x: screenX, y: screenY };
}

// Objects shrink less than the lane narrows - they're 3D, not flat
const MIN_OBJECT_SCALE = 0.6;
function worldRadiusAtY(radius: number, worldY: number): number {
  const t = worldY / LANE_LENGTH;
  const scale = MIN_OBJECT_SCALE + (1 - MIN_OBJECT_SCALE) * t;
  return radius * scale;
}

export class VectorRenderer implements GameRenderer {

  drawLane(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const cameraY = camera.y;

    // Dark background fill
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, -cameraY, ctx.canvas.width, ctx.canvas.height);

    // Back wall at the end of the lane
    // From this perspective (looking down the lane), the wall is a narrow
    // horizontal band rising up from the end of the lane
    const wallBaseY = 0;
    const wallBase = worldToScreen(LANE_WIDTH / 2, wallBaseY);
    const wallLeftPt = worldToScreen(-GUTTER_WIDTH, wallBaseY);
    const wallRightPt = worldToScreen(LANE_WIDTH + GUTTER_WIDTH, wallBaseY);
    const wallHeight = 45;

    // Wall face - gradient from dark at bottom (shadow) to lighter at top
    const wallGrad = ctx.createLinearGradient(0, wallBase.y - wallHeight, 0, wallBase.y);
    wallGrad.addColorStop(0, '#555555');
    wallGrad.addColorStop(0.3, '#444444');
    wallGrad.addColorStop(0.8, '#2a2a2a');
    wallGrad.addColorStop(1, '#1a1a1a');

    ctx.fillStyle = wallGrad;
    ctx.beginPath();
    ctx.moveTo(wallLeftPt.x, wallLeftPt.y - wallHeight);
    ctx.lineTo(wallRightPt.x, wallRightPt.y - wallHeight);
    ctx.lineTo(wallRightPt.x, wallRightPt.y);
    ctx.lineTo(wallLeftPt.x, wallLeftPt.y);
    ctx.closePath();
    ctx.fill();

    // Top edge - bright highlight like overhead light hitting the top
    ctx.fillStyle = '#666666';
    ctx.fillRect(wallLeftPt.x, wallLeftPt.y - wallHeight, wallRightPt.x - wallLeftPt.x, 2);

    // Rubber cushion at the base (the dark strip the ball hits)
    ctx.fillStyle = '#111111';
    ctx.fillRect(wallLeftPt.x, wallLeftPt.y - 5, wallRightPt.x - wallLeftPt.x, 5);

    // Subtle horizontal seam line across the middle of the wall
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wallLeftPt.x, wallLeftPt.y - wallHeight * 0.5);
    ctx.lineTo(wallRightPt.x, wallRightPt.y - wallHeight * 0.5);
    ctx.stroke();

    // Trapezoidal lane surface
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

    // Tiny black pit strip right at the wall base
    ctx.fillStyle = '#000000';
    ctx.fillRect(wallLeftPt.x, wallLeftPt.y - 1, wallRightPt.x - wallLeftPt.x, 6);

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
    // Always render at the real position
    const screen = worldToScreen(position.x, Math.max(0, position.y));
    const r = worldRadiusAtY(BALL_RADIUS, Math.max(0, position.y));

    // The pit strip bottom edge in screen coords - this is where the lane ends
    // and the ball would sink below the surface
    const pitClipY = worldToScreen(0, 0).y + 5;

    ctx.save();

    // If the ball's center is above the pit edge, clip so the lane hides the bottom
    if (screen.y < pitClipY) {
      ctx.beginPath();
      ctx.rect(0, 0, ctx.canvas.width, pitClipY);
      ctx.clip();
    }

    // Clip to ball circle
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
    ctx.clip();

    // Base red gradient (highlight top-left for 3D look)
    const grad = ctx.createRadialGradient(
      screen.x - r * 0.3, screen.y - r * 0.3, r * 0.1,
      screen.x, screen.y, r
    );
    grad.addColorStop(0, COLORS.ballHighlight);
    grad.addColorStop(0.7, COLORS.ball);
    grad.addColorStop(1, '#5a0e0e');

    ctx.fillStyle = grad;
    ctx.fillRect(screen.x - r, screen.y - r, r * 2, r * 2);

    // Wavy swirl pattern that rotates with the ball
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
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Pearlescent sheen (lighter arc across the surface)
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(
      screen.x - r * 0.15, screen.y - r * 0.2,
      r * 0.7, r * 0.35,
      -0.5, 0, Math.PI * 2
    );
    ctx.fill();

    ctx.restore();

    // Three finger holes (rotate with angle)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    const holeRadius = r * 0.16;
    const holeDistance = r * 0.4;
    // Two finger holes close together + one thumb hole offset
    const holes = [
      { a: angle - 0.35, d: holeDistance, s: holeRadius },
      { a: angle + 0.35, d: holeDistance, s: holeRadius },
      { a: angle + Math.PI - 0.1, d: holeDistance * 0.7, s: holeRadius * 1.15 },
    ];
    for (const h of holes) {
      const hx = screen.x + Math.cos(h.a) * h.d;
      const hy = screen.y + Math.sin(h.a) * h.d;
      ctx.beginPath();
      ctx.arc(hx, hy, h.s, 0, Math.PI * 2);
      ctx.fill();
      // Inner shadow for depth
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(hx + h.s * 0.15, hy + h.s * 0.15, h.s * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    }
  }

  drawPin(ctx: CanvasRenderingContext2D, position: Vec2, angle: number, wobble: number): void {
    const screen = worldToScreen(position.x, position.y);
    // Don't draw if pin has flown off screen
    if (position.x < -100 || position.x > LANE_WIDTH + 200 || position.y < -100 || position.y > LANE_LENGTH + 100) return;
    const scale = worldRadiusAtY(1, Math.max(0, position.y));

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(angle + Math.sin(wobble) * 0.1);

    // Pin shape - tall bowling pin with belly, neck, and head
    const bellyW = 9 * scale;
    const bellyH = 12 * scale;
    const neckW = 4 * scale;
    const neckH = 20 * scale;
    const headR = 6 * scale;

    // Shadow beneath pin
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(1 * scale, bellyH * 0.4, bellyW * 1.1, 3 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly (wide bottom)
    ctx.fillStyle = COLORS.pinBody;
    ctx.beginPath();
    ctx.ellipse(0, bellyH * 0.15, bellyW, bellyH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Neck (narrowing above belly)
    ctx.beginPath();
    ctx.moveTo(-neckW, -bellyH * 0.3);
    ctx.quadraticCurveTo(-neckW * 0.8, -bellyH * 0.3 - neckH, 0, -bellyH * 0.3 - neckH);
    ctx.quadraticCurveTo(neckW * 0.8, -bellyH * 0.3 - neckH, neckW, -bellyH * 0.3);
    ctx.quadraticCurveTo(bellyW * 0.6, -bellyH * 0.1, -bellyW * 0.6, -bellyH * 0.1);
    ctx.closePath();
    ctx.fill();

    // Head (round top)
    ctx.beginPath();
    ctx.arc(0, -bellyH * 0.3 - neckH - headR * 0.5, headR, 0, Math.PI * 2);
    ctx.fill();

    // Red stripes on the neck
    ctx.fillStyle = COLORS.pinStripe;
    ctx.fillRect(-neckW * 0.9, -bellyH * 0.3 - 2 * scale, neckW * 1.8, 2 * scale);
    ctx.fillRect(-neckW * 0.9, -bellyH * 0.3 - 5 * scale, neckW * 1.8, 2 * scale);

    // Highlight (sheen on the belly)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.ellipse(-bellyW * 0.25, 0, bellyW * 0.4, bellyH * 0.5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Outline
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.ellipse(0, bellyH * 0.15, bellyW, bellyH, 0, 0, Math.PI * 2);
    ctx.stroke();

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

  // --- Physics cheat effects ---

  private drawSlightCurveEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    // Faint curved trail showing the impossible curve
    if (progress < 0.3 || progress > 0.9) return;
    const t = (progress - 0.3) / 0.6;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#ff6666';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const startX = LANE_WIDTH / 2;
    const startY = 200;
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(startX + 60 * t, startY - 80 * t, startX + 80 * t, startY - 150 * t);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawPinWobbleEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    // Draw motion lines around the pin to indicate wobble
    const pinScreen = worldToScreen(LANE_WIDTH / 2, 60);
    const wobbleAmount = Math.sin(progress * Math.PI * 8) * 6 * (1 - progress);
    ctx.save();
    ctx.globalAlpha = 0.5 * (1 - progress);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + progress * 10;
      const r = 15 + Math.abs(wobbleAmount);
      ctx.beginPath();
      ctx.arc(pinScreen.x + Math.cos(angle) * r, pinScreen.y + Math.sin(angle) * r, 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawGutterWidenEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    // Overlay wider gutters that grow with progress
    const expansion = progress * 30;
    ctx.save();
    ctx.globalAlpha = 0.6 * progress;
    ctx.fillStyle = '#1a1a1a';

    // Left expanding gutter
    const ltTop = worldToScreen(-GUTTER_WIDTH - expansion, 0);
    const lTop = worldToScreen(expansion, 0);
    const lBottom = worldToScreen(expansion, LANE_LENGTH);
    const ltBottom = worldToScreen(-GUTTER_WIDTH - expansion, LANE_LENGTH);
    ctx.beginPath();
    ctx.moveTo(ltTop.x, ltTop.y);
    ctx.lineTo(lTop.x, lTop.y);
    ctx.lineTo(lBottom.x, lBottom.y);
    ctx.lineTo(ltBottom.x, ltBottom.y);
    ctx.closePath();
    ctx.fill();

    // Right expanding gutter
    const rTop = worldToScreen(LANE_WIDTH - expansion, 0);
    const rBottom = worldToScreen(LANE_WIDTH - expansion, LANE_LENGTH);
    const rtTop = worldToScreen(LANE_WIDTH + GUTTER_WIDTH + expansion, 0);
    const rtBottom = worldToScreen(LANE_WIDTH + GUTTER_WIDTH + expansion, LANE_LENGTH);
    ctx.beginPath();
    ctx.moveTo(rTop.x, rTop.y);
    ctx.lineTo(rtTop.x, rtTop.y);
    ctx.lineTo(rtBottom.x, rtBottom.y);
    ctx.lineTo(rBottom.x, rBottom.y);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private drawLaneTiltEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    // Apply a rotation effect to simulate lane tilting
    const tiltAngle = progress * 0.08;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.translate(LANE_WIDTH / 2, LANE_LENGTH / 2);
    ctx.rotate(tiltAngle);
    ctx.translate(-LANE_WIDTH / 2, -LANE_LENGTH / 2);

    // Draw a tilted overlay
    ctx.fillStyle = 'rgba(100, 50, 0, 0.15)';
    const topLeft = worldToScreen(0, 0);
    const topRight = worldToScreen(LANE_WIDTH, 0);
    const bottomRight = worldToScreen(LANE_WIDTH, LANE_LENGTH);
    const bottomLeft = worldToScreen(0, LANE_LENGTH);
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // --- Character cheat effects ---

  private drawCatWalkEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    // Simple cat silhouette walking across the lane at ball height
    const catX = -50 + (LANE_WIDTH + 100) * progress;
    const catY = 400; // mid-lane area
    const screen = worldToScreen(catX, catY);
    const scale = worldRadiusAtY(1, catY);

    ctx.save();
    ctx.fillStyle = '#333333';

    // Body (ellipse)
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, 18 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head (circle)
    const headX = screen.x + 14 * scale * (progress > 0.5 ? 1 : -1);
    ctx.beginPath();
    ctx.arc(headX, screen.y - 6 * scale, 7 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Ears (triangles)
    ctx.beginPath();
    ctx.moveTo(headX - 5 * scale, screen.y - 11 * scale);
    ctx.lineTo(headX - 2 * scale, screen.y - 18 * scale);
    ctx.lineTo(headX + 1 * scale, screen.y - 11 * scale);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(headX + 2 * scale, screen.y - 11 * scale);
    ctx.lineTo(headX + 5 * scale, screen.y - 18 * scale);
    ctx.lineTo(headX + 8 * scale, screen.y - 11 * scale);
    ctx.fill();

    // Tail (curved line)
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    const tailDir = progress > 0.5 ? -1 : 1;
    ctx.moveTo(screen.x - 16 * scale * tailDir, screen.y);
    ctx.quadraticCurveTo(
      screen.x - 25 * scale * tailDir, screen.y - 15 * scale,
      screen.x - 20 * scale * tailDir, screen.y - 25 * scale
    );
    ctx.stroke();

    // Legs (small lines, animate walking)
    const legPhase = progress * 20;
    ctx.lineWidth = 2 * scale;
    for (let i = 0; i < 4; i++) {
      const legX = screen.x + (-10 + i * 7) * scale;
      const legOffset = Math.sin(legPhase + i * Math.PI / 2) * 4 * scale;
      ctx.beginPath();
      ctx.moveTo(legX, screen.y + 8 * scale);
      ctx.lineTo(legX + legOffset, screen.y + 18 * scale);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawJanitorSweepEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    // Stick figure with broom sweeping from right to left near the pin
    const janitorX = LANE_WIDTH + 30 - (LANE_WIDTH + 60) * progress;
    const janitorY = 60; // at pin position
    const screen = worldToScreen(janitorX, janitorY);
    const scale = worldRadiusAtY(1, janitorY);

    ctx.save();
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 2 * scale;
    ctx.lineCap = 'round';

    // Head
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - 20 * scale, 6 * scale, 0, Math.PI * 2);
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - 14 * scale);
    ctx.lineTo(screen.x, screen.y + 5 * scale);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y + 5 * scale);
    ctx.lineTo(screen.x - 6 * scale, screen.y + 18 * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y + 5 * scale);
    ctx.lineTo(screen.x + 6 * scale, screen.y + 18 * scale);
    ctx.stroke();

    // Arms holding broom
    const broomAngle = Math.sin(progress * Math.PI * 4) * 0.3;
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - 8 * scale);
    ctx.lineTo(screen.x + 15 * scale, screen.y - 2 * scale);
    ctx.stroke();

    // Broom
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3 * scale;
    const broomX = screen.x + 15 * scale;
    const broomY = screen.y - 2 * scale;
    ctx.beginPath();
    ctx.moveTo(broomX, broomY);
    ctx.lineTo(broomX + 12 * scale * Math.cos(broomAngle), broomY + 15 * scale);
    ctx.stroke();

    // Broom bristles
    ctx.strokeStyle = '#DAA520';
    ctx.lineWidth = 1 * scale;
    const bristleX = broomX + 12 * scale * Math.cos(broomAngle);
    const bristleY = broomY + 15 * scale;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(bristleX + i * 2 * scale, bristleY);
      ctx.lineTo(bristleX + i * 3 * scale, bristleY + 6 * scale);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawPigeonEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    // Pigeon flies in, lands on pin, then lifts it away
    const pinScreen = worldToScreen(LANE_WIDTH / 2, 60);
    const scale = worldRadiusAtY(1, 60);

    let birdX: number, birdY: number;
    if (progress < 0.3) {
      // Flying in from top-right
      const t = progress / 0.3;
      birdX = pinScreen.x + (1 - t) * 100;
      birdY = pinScreen.y - (1 - t) * 80;
    } else if (progress < 0.6) {
      // Sitting on pin
      birdX = pinScreen.x;
      birdY = pinScreen.y - 12 * scale;
    } else {
      // Flying away with pin (going up)
      const t = (progress - 0.6) / 0.4;
      birdX = pinScreen.x - t * 60;
      birdY = pinScreen.y - 12 * scale - t * 120;
    }

    ctx.save();
    ctx.fillStyle = '#777788';

    // Body (oval)
    ctx.beginPath();
    ctx.ellipse(birdX, birdY, 10 * scale, 6 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head (circle)
    ctx.beginPath();
    ctx.arc(birdX + 8 * scale, birdY - 3 * scale, 4 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#FFAA00';
    ctx.beginPath();
    ctx.moveTo(birdX + 12 * scale, birdY - 3 * scale);
    ctx.lineTo(birdX + 16 * scale, birdY - 2 * scale);
    ctx.lineTo(birdX + 12 * scale, birdY - 1 * scale);
    ctx.closePath();
    ctx.fill();

    // Wings (flapping)
    ctx.fillStyle = '#666677';
    const wingFlap = Math.sin(progress * Math.PI * 12) * 8 * scale;
    ctx.beginPath();
    ctx.ellipse(birdX, birdY - wingFlap, 12 * scale, 4 * scale, -0.3, 0, Math.PI);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#FF3300';
    ctx.beginPath();
    ctx.arc(birdX + 9 * scale, birdY - 4 * scale, 1.5 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // --- Bowling cheat effects ---

  private drawWrongPinsEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    // Replace single pin with 7-10 split positions
    if (progress < 0.3) return;
    const alpha = Math.min((progress - 0.3) / 0.2, 1);

    ctx.save();
    ctx.globalAlpha = alpha;

    // Draw two pins at 7-10 split positions (far left and far right)
    const leftPos = worldToScreen(25, 60);
    const rightPos = worldToScreen(LANE_WIDTH - 25, 60);
    const r = worldRadiusAtY(PIN_RADIUS, 60);

    for (const pos of [leftPos, rightPos]) {
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y, r, r * 1.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.pinBody;
      ctx.fill();
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Red stripes
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y - r * 0.3, r * 0.8, r * 0.15, 0, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.pinStripe;
      ctx.fill();
    }

    ctx.restore();
  }

  private drawPinMachineEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    // Pin setter machine descending from top
    const machineY = -60 + progress * 120; // descends from above
    const machineWidth = LANE_WIDTH * 0.8;
    const machineHeight = 40;
    const machineX = (LANE_WIDTH - machineWidth) / 2;

    const topLeft = worldToScreen(machineX, machineY);
    const topRight = worldToScreen(machineX + machineWidth, machineY);
    const bottomLeft = worldToScreen(machineX, machineY + machineHeight);
    const bottomRight = worldToScreen(machineX + machineWidth, machineY + machineHeight);

    ctx.save();

    // Machine body
    ctx.fillStyle = '#444444';
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.fill();

    // Machine details (horizontal lines)
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const lineY = machineY + (machineHeight * i) / 4;
      const ll = worldToScreen(machineX, lineY);
      const lr = worldToScreen(machineX + machineWidth, lineY);
      ctx.beginPath();
      ctx.moveTo(ll.x, ll.y);
      ctx.lineTo(lr.x, lr.y);
      ctx.stroke();
    }

    // Clamp arms
    ctx.fillStyle = '#555555';
    const clampWidth = 8;
    for (const xOffset of [machineWidth * 0.25, machineWidth * 0.75]) {
      const cl = worldToScreen(machineX + xOffset - clampWidth / 2, machineY + machineHeight);
      const cr = worldToScreen(machineX + xOffset + clampWidth / 2, machineY + machineHeight + 20);
      ctx.fillRect(cl.x, cl.y, cr.x - cl.x, cr.y - cl.y);
    }

    ctx.restore();
  }

  private drawInvadingBallEffect(ctx: CanvasRenderingContext2D, progress: number): void {
    // Another ball rolling in from the side
    const invaderX = LANE_WIDTH + 40 - (LANE_WIDTH + 80) * progress;
    const invaderY = 300 + progress * 200;
    const screen = worldToScreen(invaderX, invaderY);
    const r = worldRadiusAtY(BALL_RADIUS, invaderY);

    ctx.save();

    // Invading ball with different color
    const grad = ctx.createRadialGradient(
      screen.x - r * 0.3, screen.y - r * 0.3, r * 0.1,
      screen.x, screen.y, r
    );
    grad.addColorStop(0, '#884444');
    grad.addColorStop(1, '#662222');

    ctx.beginPath();
    ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Finger holes
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    const holeRadius = r * 0.18;
    const holeDistance = r * 0.45;
    const angle = progress * Math.PI * 4;
    for (const offset of [-0.4, 0, 0.4]) {
      const hx = screen.x + Math.cos(angle + offset) * holeDistance;
      const hy = screen.y + Math.sin(angle + offset) * holeDistance;
      ctx.beginPath();
      ctx.arc(hx, hy, holeRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawCaption(ctx: CanvasRenderingContext2D, text: string, progress: number): void {
    // Centered text with fade based on progress (0 to 1)
    // Fade in 0-0.2, hold 0.2-0.8, fade out 0.8-1.0
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

    // Measure text for background pill
    ctx.font = 'bold 20px Inter, sans-serif';
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const pillPadX = 16;
    const pillPadY = 10;
    const pillW = textWidth + pillPadX * 2;
    const pillH = 32 + pillPadY;
    const pillX = centerX - pillW / 2;
    const pillY = centerY - pillH / 2;

    // Semi-transparent dark background pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    // Caption text
    ctx.fillStyle = COLORS.caption;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    ctx.fillText(text, centerX, centerY);

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
