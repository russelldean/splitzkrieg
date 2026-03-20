'use client';

import { useRef, useEffect, useCallback } from 'react';
import { GameEngine } from './GameEngine';
import { VectorRenderer } from './renderers/VectorRenderer';
import { createCamera, updateCamera } from './Camera';
import { createInitialState, transitionState, shouldWin } from './GameState';
import { SlingshotInput } from './SlingshotInput';
import { getAimFeedback } from './AimPredictor';
import type { Camera, GameState, Vec2 } from './types';

function getCanvasPos(e: React.PointerEvent, canvas: HTMLCanvasElement): Vec2 {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<VectorRenderer | null>(null);
  const cameraRef = useRef<Camera>(createCamera());
  const stateRef = useRef<GameState>(createInitialState());
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const pausedRef = useRef<boolean>(false);
  const slingshotRef = useRef<SlingshotInput>(new SlingshotInput());
  const predictorTextRef = useRef<string>('');
  const resultTimerRef = useRef<number | null>(null);
  const showDemoRef = useRef<boolean>(true);
  const demoCallbackRef = useRef<(() => void) | null>(null);

  const setupCanvas = useCallback((canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    return ctx;
  }, []);

  // Check if demo should be skipped (already seen this session)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const seen = sessionStorage.getItem('splitzkrieg-demo-seen');
      if (seen === 'true') {
        showDemoRef.current = false;
        stateRef.current = { ...stateRef.current, phase: 'idle' };
      }
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = stateRef.current;

    // During demo phase, skip to idle on any tap
    if (state.phase === 'demo') {
      sessionStorage.setItem('splitzkrieg-demo-seen', 'true');
      stateRef.current = transitionState(state, 'start');
      showDemoRef.current = false;
      if (demoCallbackRef.current) {
        demoCallbackRef.current();
        demoCallbackRef.current = null;
      }
      return;
    }

    if (state.phase === 'idle') {
      const pos = getCanvasPos(e, canvas);
      slingshotRef.current.onPointerDown(pos);
      stateRef.current = transitionState(state, 'pointerdown');
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = stateRef.current;
    if (state.phase === 'aiming') {
      const pos = getCanvasPos(e, canvas);
      slingshotRef.current.onPointerMove(pos);

      // Update lying aim predictor text
      const engine = engineRef.current;
      const aimVec = slingshotRef.current.getAimVector();
      if (engine && aimVec) {
        predictorTextRef.current = getAimFeedback(
          aimVec,
          engine.getBallPosition(),
          engine.getPinPosition()
        );
      }
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const state = stateRef.current;
    if (state.phase !== 'aiming') return;

    const velocity = slingshotRef.current.onPointerUp();
    if (velocity) {
      stateRef.current = transitionState(state, 'release');
      engineRef.current?.launchBall(velocity);
      predictorTextRef.current = '';
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = setupCanvas(canvas);
    if (!ctx) return;

    // Create engine and renderer
    const engine = new GameEngine();
    const renderer = new VectorRenderer();
    engineRef.current = engine;
    rendererRef.current = renderer;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.width / dpr;
    const displayHeight = canvas.height / dpr;

    // Game loop
    const loop = (timestamp: number) => {
      if (pausedRef.current) {
        lastTimeRef.current = timestamp;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // Delta time clamping per Pitfall 5 -- cap at 32ms (~30fps minimum)
      const delta = Math.min(elapsed, 32);

      // Update physics
      engine.update(delta);

      // Game state logic during rolling phase
      const state = stateRef.current;
      if (state.phase === 'rolling') {
        const ballPos = engine.getBallPosition();
        updateCamera(cameraRef.current, ballPos.y, displayHeight);

        // Check for pin hit
        if (engine.isPinHit()) {
          if (shouldWin(state.isAdmin)) {
            stateRef.current = transitionState(state, 'win');
          } else {
            // Pin was hit but no win -- transition to result
            stateRef.current = {
              ...transitionState({ ...state, phase: 'rolling' }, 'cheat'),
              phase: 'result',
              attempt: state.attempt + 1,
            };
            scheduleReset(displayHeight);
          }
        } else if (engine.isBallOutOfBounds()) {
          // Ball missed -- transition to result, increment attempt
          stateRef.current = {
            ...state,
            phase: 'result',
            attempt: state.attempt + 1,
          };
          scheduleReset(displayHeight);
        }
      }

      // Clear canvas
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      // Apply camera offset
      ctx.save();
      ctx.translate(0, -cameraRef.current.y);

      // Draw game world
      renderer.drawLane(ctx, cameraRef.current);
      renderer.drawGutters(ctx, cameraRef.current);
      renderer.drawPin(ctx, engine.getPinPosition(), engine.getPinAngle(), 0);
      renderer.drawBall(ctx, engine.getBallPosition(), engine.getBallAngle());

      // Draw aim arrow and rubberband during aiming phase
      if (stateRef.current.phase === 'aiming') {
        const aimVec = slingshotRef.current.getAimVector();
        if (aimVec) {
          renderer.drawAimArrow(ctx, engine.getBallPosition(), aimVec);
        }
      }

      ctx.restore(); // camera offset

      // Draw HUD elements (not affected by camera)
      if (stateRef.current.phase === 'aiming' && predictorTextRef.current) {
        renderer.drawPredictorText(ctx, predictorTextRef.current);
      }

      ctx.restore(); // transform reset

      rafRef.current = requestAnimationFrame(loop);
    };

    function scheduleReset(canvasHeight: number) {
      if (resultTimerRef.current !== null) return;
      resultTimerRef.current = window.setTimeout(() => {
        resultTimerRef.current = null;
        const currentState = stateRef.current;
        if (currentState.phase !== 'result') return;

        if (currentState.attempt >= currentState.maxAttempts) {
          stateRef.current = { ...currentState, phase: 'scorecard' };
        } else {
          engine.resetBall();
          cameraRef.current = createCamera();
          stateRef.current = { ...currentState, phase: 'idle' };
        }
      }, 1000);
    }

    rafRef.current = requestAnimationFrame(loop);

    // Handle window resize
    const handleResize = () => {
      setupCanvas(canvas);
    };
    window.addEventListener('resize', handleResize);

    // Pause when tab is hidden per Pitfall 5
    const handleVisibility = () => {
      pausedRef.current = document.visibilityState === 'hidden';
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (resultTimerRef.current !== null) {
        clearTimeout(resultTimerRef.current);
      }
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      engine.destroy();
    };
  }, [setupCanvas]);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="block max-w-[500px] w-full h-full"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
}
