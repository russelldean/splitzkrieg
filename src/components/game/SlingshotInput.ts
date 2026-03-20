import { Vec2, GAME_CONSTANTS } from './types';

export function calculateLaunch(startPos: Vec2, releasePos: Vec2): Vec2 {
  const dx = startPos.x - releasePos.x;
  const dy = startPos.y - releasePos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance === 0) return { x: 0, y: 0 };

  const power = Math.min(distance / GAME_CONSTANTS.MAX_PULL_DISTANCE, 1.0);
  const mag = distance;
  const vx = (dx / mag) * power * GAME_CONSTANTS.MAX_VELOCITY;
  const vy = (dy / mag) * power * GAME_CONSTANTS.MAX_VELOCITY;

  // Curve from horizontal offset per D-03
  const horizontalOffset = dx / mag;
  const curve = horizontalOffset * GAME_CONSTANTS.CURVE_FACTOR;

  return { x: vx + curve, y: vy };
}

export class SlingshotInput {
  private startPos: Vec2 | null = null;
  private currentPos: Vec2 | null = null;
  private isActive = false;

  onPointerDown(pos: Vec2): void {
    this.startPos = { ...pos };
    this.currentPos = { ...pos };
    this.isActive = true;
  }

  onPointerMove(pos: Vec2): void {
    if (!this.isActive) return;
    this.currentPos = { ...pos };
  }

  onPointerUp(): Vec2 | null {
    if (!this.isActive || !this.startPos || !this.currentPos) {
      this.reset();
      return null;
    }

    const launch = calculateLaunch(this.startPos, this.currentPos);
    this.reset();
    return launch;
  }

  getAimVector(): Vec2 | null {
    if (!this.isActive || !this.startPos || !this.currentPos) return null;
    return {
      x: this.startPos.x - this.currentPos.x,
      y: this.startPos.y - this.currentPos.y,
    };
  }

  private reset(): void {
    this.startPos = null;
    this.currentPos = null;
    this.isActive = false;
  }
}
