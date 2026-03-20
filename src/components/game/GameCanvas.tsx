'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { GameEngine } from './GameEngine';
import { VectorRenderer } from './renderers/VectorRenderer';
import { createCamera, updateCamera } from './Camera';
import { createInitialState, transitionState, shouldWin, advanceTier } from './GameState';
import { SlingshotInput } from './SlingshotInput';
import { CheatSystem } from './CheatSystem';
import { SoundManager } from './SoundManager';
import { HapticManager } from './HapticManager';
import { ReplaySystem } from './ReplaySystem';
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
  const soundRef = useRef<SoundManager>(new SoundManager());
  const hapticRef = useRef<HapticManager>(new HapticManager());
  const replayRef = useRef<ReplaySystem>(new ReplaySystem());
  const replayFrameIndexRef = useRef<number>(0);
  const replayStartTimeRef = useRef<number>(0);
  const soundInitializedRef = useRef<boolean>(false);
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

    // Initialize sound on first user interaction (iOS audio unlock)
    if (!soundInitializedRef.current) {
      soundRef.current.init();
      soundInitializedRef.current = true;
    }

    const state = stateRef.current;

    // During demo phase, skip to idle on any tap
    if (state.phase === 'demo') {
      sessionStorage.setItem('splitzkrieg-demo-seen', 'true');
      stateRef.current = transitionState(state, 'start');
      setShowDemo(false);
      return;
    }

    // Tap during replay to skip it
    if (state.phase === 'replay') {
      replayRef.current.reset();
      stateRef.current = { ...state, phase: 'result' };
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

      // Sound and haptic on ball release
      soundRef.current.play('release');
      soundRef.current.play('roll');
      hapticRef.current.release();

      // Start recording frames for replay
      replayRef.current.startRecording();
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

        // Capture replay frame every tick during rolling
        replayRef.current.captureFrame({
          ballPos: { ...ballPos },
          ballAngle: engine.getBallAngle(),
          pinPos: { ...pinPos },
          pinAngle: engine.getPinAngle(),
          timestamp: performance.now(),
        });

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

            // Sound and haptic for cheat
            soundRef.current.stop('roll');
            if (cheat.tier === 1) {
              soundRef.current.play('woosh');
            } else {
              soundRef.current.play('cheat');
            }
            hapticRef.current.cheat();

            // Transition to cheat phase
            stateRef.current = transitionState(state, 'cheat');

            // Execute the cheat (physics manipulation + animation)
            cheat.execute(engine, renderer).then(() => {
              // Cheat animation complete -- stop recording and transition to replay
              replayRef.current.stopRecording();
              const currentState = stateRef.current;
              if (currentState.phase !== 'cheat') return;

              const advanced = advanceTier(currentState);
              const nextState = {
                ...advanced,
                phase: 'replay' as const,
                attempt: currentState.attempt + 1,
                cheatsEncountered: [...currentState.cheatsEncountered, cheat.id],
              };
              stateRef.current = nextState;

              // Set up replay playback
              replayStartTimeRef.current = performance.now();
              replayFrameIndexRef.current = 0;
            });
          }
        }

        // Check for pin hit (win path)
        if (engine.isPinHit() && state.phase === 'rolling') {
          soundRef.current.stop('roll');
          soundRef.current.play('impact');
          soundRef.current.play('clatter');
          hapticRef.current.impact();
          if (shouldWin(state.isAdmin) || cheatTriggeredRef.current) {
            soundRef.current.play('fanfare');
            hapticRef.current.win();
            stateRef.current = transitionState(state, 'win');
          }
        } else if (engine.isBallOutOfBounds() && state.phase === 'rolling') {
          // Ball missed without cheat triggering
          soundRef.current.stop('roll');
          stateRef.current = {
            ...state,
            phase: 'result',
            attempt: state.attempt + 1,
          };
          scheduleReset(displayHeight);
        }
      }

      // Capture replay frames during cheat phase too
      if (state.phase === 'cheat') {
        replayRef.current.captureFrame({
          ballPos: { ...engine.getBallPosition() },
          ballAngle: engine.getBallAngle(),
          pinPos: { ...engine.getPinPosition() },
          pinAngle: engine.getPinAngle(),
          timestamp: performance.now(),
          cheatState: activeCheatRef.current?.id,
        });
      }

      // Update cheat animation progress during cheat phase
      if (state.phase === 'cheat' && activeCheatRef.current) {
        const cheatElapsed = timestamp - cheatStartTimeRef.current;
        cheatProgressRef.current = Math.min(cheatElapsed / activeCheatRef.current.duration, 1);
      }

      // Replay playback: advance frame index based on elapsed time at 0.25x speed
      if (state.phase === 'replay') {
        const replayFrames = replayRef.current.getFrames();
        if (replayFrames.length >= 2) {
          const replayElapsed = performance.now() - replayStartTimeRef.current;
          const replayDuration = replayRef.current.getReplayDuration(0.25);
          const progress = Math.min(replayElapsed / replayDuration, 1);
          replayFrameIndexRef.current = Math.min(
            Math.floor(progress * (replayFrames.length - 1)),
            replayFrames.length - 1
          );

          // Replay finished -- transition to result
          if (progress >= 1) {
            replayRef.current.reset();
            activeCheatRef.current = null;
            cheatProgressRef.current = 0;
            scheduleReset(displayHeight);
            stateRef.current = { ...state, phase: 'result' };
          }
        } else {
          // No frames to replay, skip straight to result
          replayRef.current.reset();
          activeCheatRef.current = null;
          cheatProgressRef.current = 0;
          scheduleReset(displayHeight);
          stateRef.current = { ...state, phase: 'result' };
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
      if (stateRef.current.phase === 'replay') {
        // During replay: draw from recorded frames instead of live physics
        const replayFrames = replayRef.current.getFrames();
        const frameIdx = replayFrameIndexRef.current;
        if (replayFrames.length > 0 && frameIdx < replayFrames.length) {
          const frame = replayFrames[frameIdx];
          renderer.drawLane(ctx, cameraRef.current);
          renderer.drawGutters(ctx, cameraRef.current);
          renderer.drawPin(ctx, frame.pinPos, frame.pinAngle, 0);
          renderer.drawBall(ctx, frame.ballPos, frame.ballAngle);
        }
      } else {
        // Normal rendering from live physics
        renderer.drawLane(ctx, cameraRef.current);
        renderer.drawGutters(ctx, cameraRef.current);
        renderer.drawPin(ctx, engine.getPinPosition(), engine.getPinAngle(), 0);
        renderer.drawBall(ctx, engine.getBallPosition(), engine.getBallAngle());
      }

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

      // Draw replay caption overlay (show the cheat caption during slow-mo replay)
      if (stateRef.current.phase === 'replay' && activeCheatRef.current) {
        const replayFrames = replayRef.current.getFrames();
        const replayElapsed = performance.now() - replayStartTimeRef.current;
        const replayDuration = replayRef.current.getReplayDuration(0.25);
        const replayProgress = replayFrames.length >= 2 ? Math.min(replayElapsed / replayDuration, 1) : 0;
        renderer.drawCaption(ctx, activeCheatRef.current.caption, replayProgress);

        // Draw "Tap to skip" hint
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Tap to skip', displayWidth / 2, displayHeight - 20);
        ctx.restore();
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
