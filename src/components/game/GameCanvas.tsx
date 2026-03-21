'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { GameEngine } from './GameEngine';
import { VectorRenderer } from './renderers/VectorRenderer';
import { PixelRenderer } from './renderers/PixelRenderer';
import { HandDrawnRenderer } from './renderers/HandDrawnRenderer';
import { createCamera, updateCamera } from './Camera';
import { createInitialState, transitionState, shouldWin, advanceTier } from './GameState';
import { SlingshotInput } from './SlingshotInput';
import { CheatSystem } from './CheatSystem';
import { SoundManager } from './SoundManager';
import { HapticManager } from './HapticManager';
import { ReplaySystem } from './ReplaySystem';
import { getAimFeedback } from './AimPredictor';
import { DemoAnimation } from './DemoAnimation';
import { ScoreCard } from './ScoreCard';
import { WinCelebration } from './WinCelebration';
import { HallOfFame } from './HallOfFame';
import { isAdminMode } from './AdminMode';
import type { Camera, GameState, GameRenderer, Vec2, CheatDefinition } from './types';
import { GAME_CONSTANTS } from './types';

const RENDERERS = {
  vector: () => new VectorRenderer(),
  pixel: () => new PixelRenderer(),
  handdrawn: () => new HandDrawnRenderer(),
} as const;

type SkinType = 'vector' | 'pixel' | 'handdrawn';

const SKIN_STORAGE_KEY = 'splitzkrieg-game-skin';

function getCanvasPos(e: React.PointerEvent, canvas: HTMLCanvasElement): Vec2 {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
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
  const rollStartTimeRef = useRef<number>(0);
  const gutterSoundPlayedRef = useRef<boolean>(false);
  const cheatTriggeredRef = useRef<boolean>(false);
  const soundRef = useRef<SoundManager>(new SoundManager());
  const hapticRef = useRef<HapticManager>(new HapticManager());
  const replayRef = useRef<ReplaySystem>(new ReplaySystem());
  const replayFrameIndexRef = useRef<number>(0);
  const replayStartTimeRef = useRef<number>(0);
  const soundInitializedRef = useRef<boolean>(false);
  const [showDemo, setShowDemo] = useState(true);
  const [showHallOfFame, setShowHallOfFame] = useState(false);
  const [gamePhase, setGamePhase] = useState<string>('demo');
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeSkin, setActiveSkin] = useState<SkinType>('vector');

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

  // Initialize admin mode, skin preference, and check if demo should be skipped
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const admin = isAdminMode();
      setIsAdmin(admin);
      stateRef.current = createInitialState(admin);

      // Load saved skin preference
      const savedSkin = localStorage.getItem(SKIN_STORAGE_KEY) as SkinType | null;
      if (savedSkin && savedSkin in RENDERERS) {
        setActiveSkin(savedSkin);
        stateRef.current = { ...stateRef.current, activeSkin: savedSkin };
        rendererRef.current = RENDERERS[savedSkin]();
      }

      const seen = sessionStorage.getItem('splitzkrieg-demo-seen');
      if (seen === 'true') {
        setShowDemo(false);
        stateRef.current = { ...stateRef.current, phase: 'idle' };
        setGamePhase('idle');
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
      soundRef.current.startAmbient();
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

    // Tap during result to immediately reset for next attempt
    if (state.phase === 'result') {
      if (resultTimerRef.current !== null) {
        clearTimeout(resultTimerRef.current);
        resultTimerRef.current = null;
      }
      if (state.attempt >= state.maxAttempts) {
        stateRef.current = { ...state, phase: 'scorecard' };
        setGamePhase('scorecard');
      } else {
        engineRef.current?.resetBall();
        cameraRef.current = createCamera();
        cheatTriggeredRef.current = false;
        gutterSoundPlayedRef.current = false;
        stateRef.current = { ...state, phase: 'idle' };
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

      // Sound and haptic on ball release
      soundRef.current.play('release');
      soundRef.current.play('roll');
      hapticRef.current.release();

      // Start recording frames for replay
      replayRef.current.startRecording();
      rollStartTimeRef.current = performance.now();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = setupCanvas(canvas);
    if (!ctx) return;

    // Create engine and renderer (use existing renderer if skin was loaded from localStorage)
    const engine = new GameEngine();
    const renderer = rendererRef.current || new VectorRenderer();
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

      // Fixed timestep physics at 16ms - run multiple steps if needed
      const clamped = Math.min(elapsed, 48);
      const steps = Math.ceil(clamped / 16);
      for (let i = 0; i < steps; i++) {
        engine.update(16);
      }

      const state = stateRef.current;
      // Track camera to ball once it's rolling
      const ballScreenY = engine.getBallPosition().y;
      if (state.phase === 'rolling' || state.phase === 'cheat' || state.phase === 'replay') {
        updateCamera(cameraRef.current, ballScreenY, displayHeight);
      } else if (state.phase === 'result') {
        // Snap back toward the ball for reset
        updateCamera(cameraRef.current, ballScreenY, displayHeight);
      }

      // Game state logic during rolling phase
      if (state.phase === 'rolling') {
        const ballPos = engine.getBallPosition();
        const pinPos = engine.getPinPosition();

        // Capture replay frame every tick during rolling
        replayRef.current.captureFrame({
          ballPos: { ...ballPos },
          ballAngle: engine.getBallAngle(),
          pinPos: { ...pinPos },
          pinAngle: engine.getPinAngle(),
          timestamp: performance.now(),
        });

        // Gutter sound on first entry
        if (engine.isInGutter() && !gutterSoundPlayedRef.current) {
          gutterSoundPlayedRef.current = true;
          soundRef.current.play('gutter');
          soundRef.current.play('woosh');
        }

        // Calculate distance from ball to pin (as fraction of lane length)
        const ballStartY = GAME_CONSTANTS.LANE_LENGTH - 50;
        const totalDistance = ballStartY - pinPos.y;
        const currentDistance = ballPos.y - pinPos.y;
        const travelProgress = 1 - (currentDistance / totalDistance);

        // Trigger cheat when ball is ~95% of the way to the pin
        // TODO: re-enable cheats after core mechanics are solid
        if (false && travelProgress >= 0.95 && !cheatTriggeredRef.current) {
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
            setGamePhase('win');
          }
        } else if (engine.isBallOutOfBounds() && state.phase === 'rolling') {
          // Ball missed, went out of bounds, or stalled (weak throw)
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

      // Apply camera offset, centering the lane vertically on screen
      const laneScreenHeight = 500; // matches LANE_LENGTH after perspective
      const verticalPadding = Math.max(0, (displayHeight - laneScreenHeight) / 2);
      ctx.save();
      ctx.translate(0, verticalPadding - cameraRef.current.y);

      // Use current renderer from ref (supports live skin switching)
      const activeRenderer = rendererRef.current || renderer;

      // Draw game world
      if (stateRef.current.phase === 'replay') {
        // During replay: draw from recorded frames instead of live physics
        const replayFrames = replayRef.current.getFrames();
        const frameIdx = replayFrameIndexRef.current;
        if (replayFrames.length > 0 && frameIdx < replayFrames.length) {
          const frame = replayFrames[frameIdx];
          activeRenderer.drawLane(ctx, cameraRef.current);
          activeRenderer.drawGutters(ctx, cameraRef.current);
          activeRenderer.drawPin(ctx, frame.pinPos, frame.pinAngle, 0);
          activeRenderer.drawBall(ctx, frame.ballPos, frame.ballAngle);
        }
      } else {
        // Normal rendering from live physics
        activeRenderer.drawLane(ctx, cameraRef.current);
        activeRenderer.drawGutters(ctx, cameraRef.current);
        activeRenderer.drawPin(ctx, engine.getPinPosition(), engine.getPinAngle(), 0);
        activeRenderer.drawBall(ctx, engine.getBallPosition(), engine.getBallAngle());
      }

      // Draw aim arrow and rubberband during aiming phase
      if (stateRef.current.phase === 'aiming') {
        const aimVec = slingshotRef.current.getAimVector();
        if (aimVec) {
          activeRenderer.drawAimArrow(ctx, engine.getBallPosition(), aimVec);
        }
      }

      // Draw cheat effects (in camera space for world-positioned effects)
      if (stateRef.current.phase === 'cheat' && activeCheatRef.current) {
        activeRenderer.drawCheatEffect(ctx, activeCheatRef.current.id, cheatProgressRef.current);
      }

      ctx.restore(); // camera offset

      // Draw HUD elements (not affected by camera)
      if (stateRef.current.phase === 'aiming' && predictorTextRef.current) {
        activeRenderer.drawPredictorText(ctx, predictorTextRef.current);
      }

      // Draw caption during cheat phase (screen space, not camera space)
      if (stateRef.current.phase === 'cheat' && activeCheatRef.current) {
        activeRenderer.drawCaption(ctx, activeCheatRef.current.caption, cheatProgressRef.current);
      }

      // Draw replay caption overlay (show the cheat caption during slow-mo replay)
      if (stateRef.current.phase === 'replay' && activeCheatRef.current) {
        const replayFrames = replayRef.current.getFrames();
        const replayElapsed = performance.now() - replayStartTimeRef.current;
        const replayDuration = replayRef.current.getReplayDuration(0.25);
        const replayProgress = replayFrames.length >= 2 ? Math.min(replayElapsed / replayDuration, 1) : 0;
        activeRenderer.drawCaption(ctx, activeCheatRef.current.caption, replayProgress);

        // Draw "Tap to skip" hint
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Tap to skip', displayWidth / 2, displayHeight - 20);
        ctx.restore();
      }

      // Draw "Tap to try again" prompt during result phase
      if (stateRef.current.phase === 'result') {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Tap to try again', displayWidth / 2, displayHeight / 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = '13px sans-serif';
        ctx.fillText(`Attempt ${stateRef.current.attempt} of ${stateRef.current.maxAttempts}`, displayWidth / 2, displayHeight / 2 + 28);
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
          setGamePhase('scorecard');
        } else {
          engine.resetBall();
          cameraRef.current = createCamera();
          cheatTriggeredRef.current = false;
        gutterSoundPlayedRef.current = false;
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

  const handlePlayAgain = useCallback(() => {
    const admin = stateRef.current.isAdmin;
    stateRef.current = createInitialState(admin);
    stateRef.current = { ...stateRef.current, phase: 'idle' };
    setGamePhase('idle');
    setShowHallOfFame(false);
    engineRef.current?.resetBall();
    cameraRef.current = createCamera();
    cheatTriggeredRef.current = false;
    sessionStorage.setItem('splitzkrieg-demo-seen', 'true');
  }, []);

  const handleViewHallOfFame = useCallback(() => {
    setShowHallOfFame(true);
  }, []);

  const handleNameSubmit = useCallback(async (name: string) => {
    const state = stateRef.current;
    // Only persist non-admin wins
    if (!state.isAdmin) {
      try {
        await fetch('/api/game/hall-of-fame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, attemptCount: state.attempt + 1 }),
        });
      } catch {
        // Silently fail -- don't block the celebration
      }
    }
    setShowHallOfFame(true);
    setGamePhase('hallOfFame');
  }, []);

  const handleWinSkip = useCallback(() => {
    setShowHallOfFame(false);
    handlePlayAgain();
  }, [handlePlayAgain]);

  const handleHallOfFameBack = useCallback(() => {
    setShowHallOfFame(false);
    handlePlayAgain();
  }, [handlePlayAgain]);

  const handleSkinChange = useCallback((skin: SkinType) => {
    setActiveSkin(skin);
    stateRef.current = { ...stateRef.current, activeSkin: skin };
    rendererRef.current = RENDERERS[skin]();
    localStorage.setItem(SKIN_STORAGE_KEY, skin);
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
      {/* Skin Toggle */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
        <button
          onClick={() => handleSkinChange('vector')}
          className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${activeSkin === 'vector' ? 'bg-white/30 ring-1 ring-white/60' : 'bg-white/10 hover:bg-white/20'}`}
          aria-label="Vector skin"
          title="Vector"
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="white" strokeWidth="2">
            <circle cx="10" cy="10" r="7" />
          </svg>
        </button>
        <button
          onClick={() => handleSkinChange('pixel')}
          className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${activeSkin === 'pixel' ? 'bg-white/30 ring-1 ring-white/60' : 'bg-white/10 hover:bg-white/20'}`}
          aria-label="Pixel art skin"
          title="Pixel"
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="white">
            <rect x="3" y="3" width="6" height="6" />
            <rect x="11" y="3" width="6" height="6" />
            <rect x="3" y="11" width="6" height="6" />
            <rect x="11" y="11" width="6" height="6" />
          </svg>
        </button>
        <button
          onClick={() => handleSkinChange('handdrawn')}
          className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${activeSkin === 'handdrawn' ? 'bg-white/30 ring-1 ring-white/60' : 'bg-white/10 hover:bg-white/20'}`}
          aria-label="Hand-drawn skin"
          title="Hand-drawn"
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
            <path d="M4 16L8 4l4 8 4-12" />
          </svg>
        </button>
      </div>
      {isAdmin && (
        <div className="absolute top-3 right-3 z-10 rounded bg-amber-500/80 px-2 py-0.5 text-[10px] font-bold tracking-wider text-black uppercase">
          COMMISSIONER MODE
        </div>
      )}
      {gamePhase === 'scorecard' && (
        <ScoreCard
          attemptCount={stateRef.current.attempt}
          cheatsEncountered={stateRef.current.cheatsEncountered}
          onPlayAgain={handlePlayAgain}
          onViewHallOfFame={handleViewHallOfFame}
        />
      )}
      {gamePhase === 'win' && !showHallOfFame && (
        <WinCelebration
          attemptCount={stateRef.current.attempt + 1}
          onNameSubmit={handleNameSubmit}
          onSkip={handleWinSkip}
        />
      )}
      {showHallOfFame && (
        <HallOfFame onBack={handleHallOfFameBack} />
      )}
    </div>
  );
}
