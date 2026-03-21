import { Camera, GAME_CONSTANTS } from './types';

export function createCamera(): Camera {
  // Start with the camera showing the full lane - ball at the bottom,
  // pin visible in the distance at the top
  return { y: 0, targetY: 0, smoothing: 0.06 };
}

export function updateCamera(camera: Camera, ballY: number, canvasHeight: number): void {
  // Keep the ball in the lower portion of the screen, but clamp so
  // we never scroll past the top of the lane (back wall stays visible)
  const rawTarget = ballY - canvasHeight * 0.75;
  camera.targetY = Math.max(0, rawTarget);
  camera.y += (camera.targetY - camera.y) * camera.smoothing;
}
