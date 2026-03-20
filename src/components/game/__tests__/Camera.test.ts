import { describe, it, expect } from 'vitest';
import { createCamera, updateCamera } from '../Camera';

describe('createCamera', () => {
  it('returns default camera state', () => {
    const camera = createCamera();
    expect(camera.y).toBe(0);
    expect(camera.targetY).toBe(0);
    expect(camera.smoothing).toBe(0.08);
  });
});

describe('updateCamera', () => {
  it('sets targetY based on ball position and canvas height', () => {
    const camera = createCamera();
    updateCamera(camera, 200, 600);
    // targetY = 200 - 600 * 0.7 = 200 - 420 = -220
    expect(camera.targetY).toBe(-220);
  });

  it('applies lerp: camera.y moves toward targetY by smoothing factor', () => {
    const camera = createCamera();
    updateCamera(camera, 200, 600);
    // camera.y starts at 0, targetY = -220, smoothing = 0.08
    // y += (-220 - 0) * 0.08 = -17.6
    expect(camera.y).toBeCloseTo(-17.6);
  });

  it('converges camera.y toward targetY with repeated calls', () => {
    const camera = createCamera();
    // Call multiple times with same ball position
    for (let i = 0; i < 100; i++) {
      updateCamera(camera, 200, 600);
    }
    // After many iterations, should be very close to targetY
    expect(camera.y).toBeCloseTo(-220, 0);
  });

  it('tracks ball at different positions', () => {
    const camera = createCamera();
    updateCamera(camera, 500, 600);
    // targetY = 500 - 420 = 80
    expect(camera.targetY).toBe(80);
    expect(camera.y).toBeGreaterThan(0); // moved toward positive target
  });
});
