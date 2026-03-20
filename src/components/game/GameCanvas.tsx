'use client';

import { useRef, useEffect, useCallback } from 'react';
import { GameEngine } from './GameEngine';
import { VectorRenderer } from './renderers/VectorRenderer';
import { createCamera, updateCamera } from './Camera';
import { createInitialState } from './GameState';
import type { Camera, GameState } from './types';

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<VectorRenderer | null>(null);
  const cameraRef = useRef<Camera>(createCamera());
  const stateRef = useRef<GameState>(createInitialState());
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const pausedRef = useRef<boolean>(false);

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

      // Update camera during rolling phase
      const state = stateRef.current;
      if (state.phase === 'rolling') {
        const ballPos = engine.getBallPosition();
        updateCamera(cameraRef.current, ballPos.y, displayHeight);
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

      ctx.restore(); // camera offset

      ctx.restore(); // transform reset

      rafRef.current = requestAnimationFrame(loop);
    };

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
      />
    </div>
  );
}
