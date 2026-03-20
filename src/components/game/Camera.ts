import { Camera } from './types';

export function createCamera(): Camera {
  return { y: 0, targetY: 0, smoothing: 0.08 };
}

export function updateCamera(camera: Camera, ballY: number, canvasHeight: number): void {
  camera.targetY = ballY - canvasHeight * 0.7;
  camera.y += (camera.targetY - camera.y) * camera.smoothing;
}
