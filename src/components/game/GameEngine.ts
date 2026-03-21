import * as Matter from 'matter-js';
import { Vec2, GAME_CONSTANTS } from './types';

const { Engine, World, Bodies, Body, Events } = Matter;

export class GameEngine {
  private engine: Matter.Engine;
  private ball: Matter.Body;
  private pin: Matter.Body;
  private leftGutterWall: Matter.Body;
  private rightGutterWall: Matter.Body;
  private pinStartPosition: Vec2;
  private collisionDetected = false;
  private inGutter = false;

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
        friction: 0,
        frictionAir: 0,
        density: 0.01,
        label: 'ball',
      }
    );

    // 10-pin: back row, far right corner of the pin triangle
    const tenPinX = GAME_CONSTANTS.LANE_WIDTH - GAME_CONSTANTS.PIN_RADIUS - 5;
    this.pin = Bodies.circle(
      tenPinX,
      -2,
      GAME_CONSTANTS.PIN_RADIUS,
      {
        restitution: 0.5,
        friction: 0.1,
        frictionAir: 0.1,
        density: 0.002,
        label: 'pin',
      }
    );

    this.pinStartPosition = { x: tenPinX, y: -2 };

    // Outer gutter walls -- ball can leave the lane surface into the gutter
    // channel, but hits the outer wall and rolls forward
    const gutterWidth = GAME_CONSTANTS.GUTTER_WIDTH;
    const wallHeight = GAME_CONSTANTS.LANE_LENGTH;
    const wallThickness = 10;

    this.leftGutterWall = Bodies.rectangle(
      -gutterWidth - wallThickness / 2,
      wallHeight / 2,
      wallThickness,
      wallHeight,
      { isStatic: true, restitution: 0.1, label: 'gutterWall' }
    );

    this.rightGutterWall = Bodies.rectangle(
      GAME_CONSTANTS.LANE_WIDTH + gutterWidth + wallThickness / 2,
      wallHeight / 2,
      wallThickness,
      wallHeight,
      { isStatic: true, restitution: 0.1, label: 'gutterWall' }
    );

    World.add(this.engine.world, [this.ball, this.pin, this.leftGutterWall, this.rightGutterWall]);

    // Collision detection for ball-pin contact
    Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        if (labels.includes('ball') && labels.includes('pin')) {
          this.collisionDetected = true;
        }
      }
    });
  }

  update(delta: number): void {
    // Gutter channel: when ball leaves the lane, guide it to the center
    // of the gutter and kill sideways velocity -- like a real bowling alley
    const ballX = this.ball.position.x;
    const gutterCenter = GAME_CONSTANTS.GUTTER_WIDTH / 2;
    if (ballX < 0) {
      this.inGutter = true;
      const targetX = -gutterCenter;
      const vel = this.ball.velocity;
      Body.setPosition(this.ball, {
        x: this.ball.position.x + (targetX - this.ball.position.x) * 0.3,
        y: this.ball.position.y,
      });
      Body.setVelocity(this.ball, { x: vel.x * 0.3, y: vel.y });
    } else if (ballX > GAME_CONSTANTS.LANE_WIDTH) {
      this.inGutter = true;
      const targetX = GAME_CONSTANTS.LANE_WIDTH + gutterCenter;
      const vel = this.ball.velocity;
      Body.setPosition(this.ball, {
        x: this.ball.position.x + (targetX - this.ball.position.x) * 0.3,
        y: this.ball.position.y,
      });
      Body.setVelocity(this.ball, { x: vel.x * 0.3, y: vel.y });
    }

    // Back of the lane: ball hits the cushion and drops into the pit
    // Absorb most energy, then drift sideways like it's being swept away
    const ballY = this.ball.position.y;
    if (ballY < 1) {
      const vel = this.ball.velocity;
      // Cushioned stop at back wall, drift to ball return
      Body.setVelocity(this.ball, {
        x: vel.x * 0.9 + 0.3,
        y: Math.max(vel.y * 0.1, 0),
      });
      // Clamp position so ball doesn't go past the wall
      Body.setPosition(this.ball, { x: this.ball.position.x, y: 5 });
    }

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

    // Reset pin
    Body.setPosition(this.pin, { x: this.pinStartPosition.x, y: this.pinStartPosition.y });
    Body.setVelocity(this.pin, { x: 0, y: 0 });
    Body.setAngle(this.pin, 0);
    Body.setAngularVelocity(this.pin, 0);
    this.collisionDetected = false;
    this.inGutter = false;
  }

  makePinDynamic(): void {
    // No-op, pin is always dynamic now
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
    if (this.collisionDetected) return true;
    const dx = this.pin.position.x - this.pinStartPosition.x;
    const dy = this.pin.position.y - this.pinStartPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance > GAME_CONSTANTS.PIN_RADIUS;
  }

  applyCheatForce(x: number, y: number): void {
    Body.applyForce(this.ball, this.ball.position, { x: x * 0.0001, y: y * 0.0001 });
  }

  isInGutter(): boolean {
    return this.inGutter;
  }

  isBallStalled(): boolean {
    const vel = this.ball.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    // Only stalled if slow AND in gutter or past the pin area
    if (speed >= 0.3) return false;
    return this.inGutter || this.ball.position.y < this.pinStartPosition.y;
  }

  isBallOutOfBounds(): boolean {
    const ballPos = this.ball.position;
    // Ball passed the pin (went past top of lane)
    if (ballPos.y < -GAME_CONSTANTS.BALL_RADIUS * 2) return true;
    // Ball went past bottom of lane
    if (ballPos.y > GAME_CONSTANTS.LANE_LENGTH + GAME_CONSTANTS.BALL_RADIUS * 2) return true;
    return false;
  }

  destroy(): void {
    Events.off(this.engine, 'collisionStart');
    World.clear(this.engine.world, false);
    Engine.clear(this.engine);
  }
}
