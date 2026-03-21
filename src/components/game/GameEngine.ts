import * as Matter from 'matter-js';
import { Vec2, GAME_CONSTANTS } from './types';

const { Engine, World, Bodies, Body, Events } = Matter;

export class GameEngine {
  private engine: Matter.Engine;
  private ball: Matter.Body;
  private pin: Matter.Body;
  private pinStartPosition: Vec2;
  private collisionDetected = false;
  private inGutter = false;
  private inPit = false;

  constructor() {
    this.engine = Engine.create({
      gravity: { x: 0, y: 0, scale: 0 },
    });

    const laneCenter = GAME_CONSTANTS.LANE_WIDTH / 2;

    // Ball at the bottom of the lane
    // Ball and pin use collision filtering so the ball passes through
    // the pin physically but we still detect the hit
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
        collisionFilter: { group: -1 },
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
        friction: 0,
        frictionAir: 0,
        density: 0.002,
        label: 'pin',
        isStatic: true,
        collisionFilter: { group: -1 },
      }
    );

    this.pinStartPosition = { x: tenPinX, y: -2 };

    // Outer gutter walls -- ball can leave the lane surface into the gutter
    // channel, but hits the outer wall and rolls forward
    World.add(this.engine.world, [this.ball, this.pin]);

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

    // Ball drops into the pit behind the pins
    // Once in the pit, the ball rolls behind/under the pin deck
    const ballY = this.ball.position.y;
    if (ballY < 0.2 && !this.inPit) {
      this.inPit = true;
    }
    if (this.inPit) {
      const vel = this.ball.velocity;
      // Slow way down as it drops into the pit
      Body.setVelocity(this.ball, {
        x: vel.x * 0.96 + 0.15,
        y: vel.y * 0.85,
      });
      // Clamp so ball doesn't fly past the back wall forever
      if (ballY < -20) {
        Body.setPosition(this.ball, { x: this.ball.position.x, y: -20 });
        Body.setVelocity(this.ball, { x: vel.x * 0.96 + 0.15, y: 0 });
      }
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
    this.inPit = false;
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
    // Ball in the pit rolls behind the pins - no hit possible
    if (this.inPit) return false;
    // Proximity-based hit detection since ball passes through pin
    const dx = this.ball.position.x - this.pinStartPosition.x;
    const dy = this.ball.position.y - this.pinStartPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hitRadius = GAME_CONSTANTS.BALL_RADIUS + GAME_CONSTANTS.PIN_RADIUS;
    if (dist < hitRadius) {
      this.collisionDetected = true;
      // Make pin dynamic and fling it
      Body.setStatic(this.pin, false);
      const nx = dx === 0 ? 0 : -dx / dist;
      const ny = dy === 0 ? -1 : -dy / dist;
      Body.setVelocity(this.pin, { x: nx * 12, y: ny * 12 });
      Body.setAngularVelocity(this.pin, (Math.random() - 0.5) * 0.5);
      return true;
    }
    return false;
  }

  applyCheatForce(x: number, y: number): void {
    Body.applyForce(this.ball, this.ball.position, { x: x * 0.0001, y: y * 0.0001 });
  }

  isInGutter(): boolean {
    return this.inGutter;
  }

  debugInfo() {
    return {
      ballPos: this.getBallPosition(),
      pinPos: this.getPinPosition(),
      vel: { x: this.ball.velocity.x, y: this.ball.velocity.y },
      speed: Math.sqrt(this.ball.velocity.x ** 2 + this.ball.velocity.y ** 2),
    };
  }

  isBallStalled(): boolean {
    const vel = this.ball.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    // Only stalled if very slow AND in gutter or past the pin area
    if (speed >= 0.1) return false;
    return this.inGutter || this.inPit || this.ball.position.y < this.pinStartPosition.y;
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
