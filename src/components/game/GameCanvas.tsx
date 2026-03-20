'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { GameEngine } from './GameEngine';
import { VectorRenderer } from './renderers/VectorRenderer';
import { createCamera, updateCamera } from './Camera';
import { createInitialState, transitionState, shouldWin, advanceTier } from './GameState';
import { SlingshotInput } from './SlingshotInput';
import { CheatSystem } from './CheatSystem';
import { getAimFeedback } from './AimPredictor';
import { DemoAnimation } from './DemoAnimation';
import type { Camera, GameState, Vec2, CheatDefinition } from './types';
import { GAME_CONSTANTS } from './types';

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
  const cheatSystemRef = useRef<CheatSystem>(new CheatSystem());
  const activeCheatRef = useRef<CheatDefinition | null>(null);
  const cheatProgressRef = useRef<number>(0);
  const cheatStartTimeRef = useRef<number>(0);
  const cheatTriggeredRef = useRef<boolean>(false);
  const [showDemo, setShowDemo] = useState(true);

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
        setShowDemo(false);
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
      setShowDemo(false);
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
        const pinPos = engine.getPinPosition();
        updateCamera(cameraRef.current, ballPos.y, displayHeight);

        // Calculate distance from ball to pin (as fraction of lane length)
        const totalDistance = GAME_CONSTANTS.LANE_LENGTH - 50 - 60; // ball start Y - pin Y
        const currentDistance = ballPos.y - pinPos.y;
        const travelProgress = 1 - (currentDistance / totalDistance);

        // Trigger cheat when ball is ~80% of the way to the pin
        if (travelProgress >= 0.8 && !cheatTriggeredRef.current) {
          cheatTriggeredRef.current = true;

          if (shouldWin(state.isAdmin)) {
            // Let physics play out naturally -- win!
            // Will be caught by isPinHit check below
          } else {
            // Select and start a cheat
            const cheat = cheatSystemRef.current.selectCheat(state.tier);
            activeCheatRef.current = cheat;
            cheatProgressRef.current = 0;
            cheatStartTimeRef.current = timestamp;

            // Transition to cheat phase
            stateRef.current = transitionState(state, 'cheat');

            // Execute the cheat (physics manipulation + animation)
            cheat.execute(engine, renderer).then(() => {
              // Cheat animation complete -- transition to result
              const currentState = stateRef.current;
              if (currentState.phase !== 'cheat') return;

              const advanced = advanceTier(currentState);
              stateRef.current = {
                ...advanced,
                phase: 'result',
                attempt: currentState.attempt + 1,
                cheatsEncountered: [...currentState.cheatsEncountered, cheat.id],
              };
              activeCheatRef.current = null;
              cheatProgressRef.current = 0;
              scheduleReset(displayHeight);
            });
          }
        }

        // Check for pin hit (win path)
        if (engine.isPinHit() && state.phase === 'rolling') {
          if (shouldWin(state.isAdmin) || cheatTriggeredRef.current) {
            stateRef.current = transitionState(state, 'win');
          }
        } else if (engine.isBallOutOfBounds() && state.phase === 'rolling') {
          // Ball missed without cheat triggering
          stateRef.current = {
            ...state,
            phase: 'result',
            attempt: state.attempt + 1,
          };
          scheduleReset(displayHeight);
        }
      }

      // Update cheat animation progress during cheat phase
      if (state.phase === 'cheat' && activeCheatRef.current) {
        const cheatElapsed = timestamp - cheatStartTimeRef.current;
        cheatProgressRef.current = Math.min(cheatElapsed / activeCheatRef.current.duration, 1);
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

      // Draw cheat effects (in camera space for world-positioned effects)
      if (stateRef.current.phase === 'cheat' && activeCheatRef.current) {
        renderer.drawCheatEffect(ctx, activeCheatRef.current.id, cheatProgressRef.current);
      }

      ctx.restore(); // camera offset

      // Draw HUD elements (not affected by camera)
      if (stateRef.current.phase === 'aiming' && predictorTextRef.current) {
        renderer.drawPredictorText(ctx, predictorTextRef.current);
      }

      // Draw caption during cheat phase (screen space, not camera space)
      if (stateRef.current.phase === 'cheat' && activeCheatRef.current) {
        renderer.drawCaption(ctx, activeCheatRef.current.caption, cheatProgressRef.current);
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
          cheatTriggeredRef.current = false;
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

  const handleDemoComplete = useCallback(() => {
    sessionStorage.setItem('splitzkrieg-demo-seen', 'true');
    stateRef.current = { ...stateRef.current, phase: 'idle' };
    setShowDemo(false);
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <canvas
        ref={canvasRef}
        className="block max-w-[500px] w-full h-full"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      {showDemo && stateRef.current.phase === 'demo' && (
        <DemoAnimation onComplete={handleDemoComplete} />
      )}
    </div>
  );
}
