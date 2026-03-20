import * as Matter from 'matter-js';
import { Vec2, GAME_CONSTANTS } from './types';

const { Engine, World, Bodies, Body } = Matter;

export class GameEngine {
  private engine: Matter.Engine;
  private ball: Matter.Body;
  private pin: Matter.Body;
  private leftWall: Matter.Body;
  private rightWall: Matter.Body;
  private pinStartPosition: Vec2;

  constructor() {
    this.engine = Engine.create({
      gravity: { x: 0, y: 0, scale: 0 },
    });

    const laneCenter = GAME_CONSTANTS.LANE_WIDTH / 2;

    // Ball at the bottom of the lane
    this.ball = Bodies.circle(
      laneCenter,
      GAME_CONSTANTS.LANE_LENGTH - 50,
      GAME_CONSTANTS.BALL_RADIUS,
      {
        restitution: 0.3,
        friction: 0.05,
        density: 0.01,
        label: 'ball',
      }
    );

    // Pin near the top of the lane (static until ball approaches)
    this.pin = Bodies.circle(
      laneCenter,
      60,
      GAME_CONSTANTS.PIN_RADIUS,
      {
        restitution: 0.5,
        friction: 0.1,
        density: 0.005,
        label: 'pin',
        isStatic: true,
      }
    );

    this.pinStartPosition = { x: laneCenter, y: 60 };

    // Gutter walls
    const wallThickness = GAME_CONSTANTS.GUTTER_WIDTH;
    const wallHeight = GAME_CONSTANTS.LANE_LENGTH;

    this.leftWall = Bodies.rectangle(
      -wallThickness / 2,
      wallHeight / 2,
      wallThickness,
      wallHeight,
      { isStatic: true, label: 'leftWall' }
    );

    this.rightWall = Bodies.rectangle(
      GAME_CONSTANTS.LANE_WIDTH + wallThickness / 2,
      wallHeight / 2,
      wallThickness,
      wallHeight,
      { isStatic: true, label: 'rightWall' }
    );

    World.add(this.engine.world, [this.ball, this.pin, this.leftWall, this.rightWall]);
  }

  update(delta: number): void {
    Engine.update(this.engine, delta);
  }

  launchBall(velocity: Vec2): void {
    Body.setVelocity(this.ball, { x: velocity.x, y: velocity.y });
  }

  resetBall(): void {
    const laneCenter = GAME_CONSTANTS.LANE_WIDTH / 2;
    Body.setPosition(this.ball, { x: laneCenter, y: GAME_CONSTANTS.LANE_LENGTH - 50 });
    Body.setVelocity(this.ball, { x: 0, y: 0 });
    Body.setAngle(this.ball, 0);
    Body.setAngularVelocity(this.ball, 0);
  }

  getBallPosition(): Vec2 {
    return { x: this.ball.position.x, y: this.ball.position.y };
  }

  getPinPosition(): Vec2 {
    return { x: this.pin.position.x, y: this.pin.position.y };
  }

  getBallAngle(): number {
    return this.ball.angle;
  }

  getPinAngle(): number {
    return this.pin.angle;
  }

  isPinHit(): boolean {
    const dx = this.pin.position.x - this.pinStartPosition.x;
    const dy = this.pin.position.y - this.pinStartPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance > GAME_CONSTANTS.PIN_RADIUS;
  }

  isBallOutOfBounds(): boolean {
    const ballPos = this.ball.position;
    // Ball passed the pin (went past top of lane)
    if (ballPos.y < -GAME_CONSTANTS.BALL_RADIUS * 2) return true;
    // Ball in the gutter (past lane edges)
    if (ballPos.x < 0 || ballPos.x > GAME_CONSTANTS.LANE_WIDTH) return true;
    // Ball went past bottom of lane
    if (ballPos.y > GAME_CONSTANTS.LANE_LENGTH + GAME_CONSTANTS.BALL_RADIUS * 2) return true;
    return false;
  }

  destroy(): void {
    World.clear(this.engine.world, false);
    Engine.clear(this.engine);
  }
}
