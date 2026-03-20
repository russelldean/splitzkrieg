import { describe, it, expect } from 'vitest';
import { calculateLaunch, SlingshotInput } from '../SlingshotInput';

describe('calculateLaunch', () => {
  it('straight pull-back produces vy < 0 and vx near 0', () => {
    // Pull straight down (start at y=400, release at y=500)
    // Slingshot reversal: ball goes opposite of drag = upward (negative vy)
    const result = calculateLaunch({ x: 100, y: 400 }, { x: 100, y: 500 });
    expect(result.y).toBeLessThan(0);
    expect(Math.abs(result.x)).toBeLessThan(1);
  });

  it('right-offset release produces positive vx (curve right)', () => {
    const result = calculateLaunch({ x: 100, y: 400 }, { x: 120, y: 500 });
    expect(result.x).toBeGreaterThan(0);
  });

  it('left-offset release produces negative vx (curve left)', () => {
    const result = calculateLaunch({ x: 100, y: 400 }, { x: 80, y: 500 });
    expect(result.x).toBeLessThan(0);
  });

  it('power scales with pull distance', () => {
    const short = calculateLaunch({ x: 100, y: 400 }, { x: 100, y: 430 });
    const long = calculateLaunch({ x: 100, y: 400 }, { x: 100, y: 500 });
    expect(Math.abs(long.y)).toBeGreaterThan(Math.abs(short.y));
  });

  it('power caps at MAX_VELOCITY regardless of pull distance', () => {
    // Very long pull (well beyond MAX_PULL_DISTANCE of 150)
    const result = calculateLaunch({ x: 100, y: 400 }, { x: 100, y: 900 });
    expect(Math.abs(result.y)).toBeLessThanOrEqual(15); // MAX_VELOCITY
  });

  it('zero distance returns {x: 0, y: 0}', () => {
    const result = calculateLaunch({ x: 100, y: 400 }, { x: 100, y: 400 });
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });
});

describe('SlingshotInput', () => {
  it('onPointerUp returns null when not active', () => {
    const slingshot = new SlingshotInput();
    expect(slingshot.onPointerUp()).toBeNull();
  });

  it('onPointerDown + onPointerUp returns launch velocity', () => {
    const slingshot = new SlingshotInput();
    slingshot.onPointerDown({ x: 100, y: 400 });
    slingshot.onPointerMove({ x: 100, y: 500 });
    const result = slingshot.onPointerUp();
    expect(result).not.toBeNull();
    expect(result!.y).toBeLessThan(0);
  });

  it('getAimVector returns null when not active', () => {
    const slingshot = new SlingshotInput();
    expect(slingshot.getAimVector()).toBeNull();
  });

  it('getAimVector returns pull-back vector when aiming', () => {
    const slingshot = new SlingshotInput();
    slingshot.onPointerDown({ x: 100, y: 400 });
    slingshot.onPointerMove({ x: 100, y: 500 });
    const aim = slingshot.getAimVector();
    expect(aim).not.toBeNull();
    expect(aim!.x).toBe(0);
    expect(aim!.y).toBe(-100); // start - current = 400 - 500 = -100... actually start.y - current.y
  });
});
