import { Vec2 } from './types';

const ENCOURAGING = [
  'Perfect angle!',
  'This is the one!',
  'Definitely going to hit it!',
  'Right on target!',
  'Can\'t miss from here!',
];

const DISCOURAGING = [
  'Terrible aim!',
  'Not even close!',
  'Are you even trying?',
  'That\'s going in the gutter!',
  'Way off!',
];

let lastIndex = -1;

/**
 * Lying aim predictor (D-35): returns OPPOSITE feedback.
 * Good aim gets discouraging text, bad aim gets encouraging text.
 */
export function getAimFeedback(aimVector: Vec2, ballPos: Vec2, pinPos: Vec2): string {
  const mag = Math.sqrt(aimVector.x * aimVector.x + aimVector.y * aimVector.y);
  if (mag < 1) return '';

  // Normalized aim direction
  const nx = aimVector.x / mag;
  const ny = aimVector.y / mag;

  // Project to find closest point on aim line to pin
  // Vector from ball to pin
  const toPin = { x: pinPos.x - ballPos.x, y: pinPos.y - ballPos.y };

  // Dot product gives projection along aim direction
  const dot = toPin.x * nx + toPin.y * ny;

  // Closest point on aim line to pin
  const closestX = ballPos.x + nx * dot;
  const closestY = ballPos.y + ny * dot;

  // Distance from pin to closest point
  const dx = pinPos.x - closestX;
  const dy = pinPos.y - closestY;
  const missDistance = Math.sqrt(dx * dx + dy * dy);

  // Also check direction -- aim should go toward pin (negative Y in our coordinate system)
  const aimingTowardPin = ny < 0;

  // Good aim = close miss distance AND aiming toward pin
  const isGoodAim = aimingTowardPin && missDistance < 30;

  // Pick from the OPPOSITE pool (lying predictor)
  const pool = isGoodAim ? DISCOURAGING : ENCOURAGING;

  // Pick a different phrase each time aim changes significantly
  let index = Math.floor(Math.random() * pool.length);
  if (index === lastIndex && pool.length > 1) {
    index = (index + 1) % pool.length;
  }
  lastIndex = index;

  return pool[index];
}
