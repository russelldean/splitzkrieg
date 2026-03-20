'use client';

import { useEffect, useRef, useCallback } from 'react';

interface DemoAnimationProps {
  onComplete: () => void;
}

const DEMO_DURATION = 3000; // 3 seconds total

/**
 * First-load tutorial animation (D-09).
 * Shows a hand performing the slingshot gesture overlay on the game canvas.
 * Skippable by tap. Only plays once per session (sessionStorage).
 */
export function DemoAnimation({ onComplete }: DemoAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const finish = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    sessionStorage.setItem('splitzkrieg-demo-seen', 'true');
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Hand starting position (near ball area, bottom center)
    const ballX = w / 2;
    const ballY = h * 0.75;

    // Pull-back target (down and slightly right)
    const pullX = w / 2 + 20;
    const pullY = h * 0.88;

    function drawHand(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, alpha: number) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.scale(scale, scale);

      // Simple pointing hand icon
      ctx.fillStyle = '#ffd5a0';
      ctx.strokeStyle = '#c49060';
      ctx.lineWidth = 1.5;

      // Palm
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Finger (pointing up)
      ctx.beginPath();
      ctx.roundRect(-5, -30, 10, 20, 5);
      ctx.fill();
      ctx.stroke();

      // Touch indicator ring
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -10, 22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    function drawArrowTrail(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, alpha: number) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead
      const angle = Math.atan2(toY - fromY, toX - fromX);
      const headLen = 10;
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headLen * Math.cos(angle - 0.4), toY - headLen * Math.sin(angle - 0.4));
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headLen * Math.cos(angle + 0.4), toY - headLen * Math.sin(angle + 0.4));
      ctx.stroke();

      ctx.restore();
    }

    const animate = (timestamp: number) => {
      if (startTimeRef.current === 0) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / DEMO_DURATION, 1);

      // Clear overlay
      ctx.clearRect(0, 0, w, h);

      // Semi-transparent backdrop
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, w, h);

      if (progress < 0.17) {
        // Phase 1 (0-0.5s): Hand appears near ball, pulsing
        const phaseProgress = progress / 0.17;
        const pulse = 0.9 + 0.1 * Math.sin(phaseProgress * Math.PI * 4);
        const alpha = Math.min(phaseProgress * 2, 1);
        drawHand(ctx, ballX, ballY, pulse, alpha);

        // Pulsing ring around ball area
        ctx.save();
        ctx.globalAlpha = alpha * 0.5;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        const ringRadius = 25 + 5 * Math.sin(phaseProgress * Math.PI * 4);
        ctx.beginPath();
        ctx.arc(ballX, ballY, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

      } else if (progress < 0.5) {
        // Phase 2 (0.5-1.5s): Hand drags downward
        const phaseProgress = (progress - 0.17) / 0.33;
        const eased = phaseProgress * phaseProgress * (3 - 2 * phaseProgress); // smoothstep
        const handX = ballX + (pullX - ballX) * eased;
        const handY = ballY + (pullY - ballY) * eased;

        // Rubberband line from ball to hand
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = 'rgba(255, 200, 100, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ballX, ballY);
        ctx.lineTo(handX, handY);
        ctx.stroke();
        ctx.restore();

        // Aim arrow (opposite direction of pull)
        const aimX = ballX - (handX - ballX);
        const aimY = ballY - (handY - ballY);
        drawArrowTrail(ctx, ballX, ballY, aimX, aimY, 0.7 * eased);

        drawHand(ctx, handX, handY, 1, 1);

      } else if (progress < 0.67) {
        // Phase 3 (1.5-2s): Release -- hand disappears, ball launches with trail
        const phaseProgress = (progress - 0.5) / 0.17;
        const handAlpha = Math.max(1 - phaseProgress * 3, 0);

        if (handAlpha > 0) {
          drawHand(ctx, pullX, pullY, 1, handAlpha);
        }

        // Ball trail going toward pin
        const trailY = ballY - phaseProgress * (ballY - h * 0.2);
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        for (let i = 0; i < 5; i++) {
          const t = i / 5;
          const ty = ballY - t * phaseProgress * (ballY - h * 0.2);
          const r = 6 * (1 - t * 0.5);
          ctx.beginPath();
          ctx.arc(ballX, ty, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Moving ball indicator
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#4a4a8e';
        ctx.beginPath();
        ctx.arc(ballX, trailY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

      } else if (progress < 0.83) {
        // Phase 4 (2-2.5s): Instruction text fades in
        const phaseProgress = (progress - 0.67) / 0.16;
        const alpha = Math.min(phaseProgress * 2, 1);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 18px Inter, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        ctx.fillText('Drag to aim, release to throw', w / 2, h * 0.5);
        ctx.restore();

      } else {
        // Phase 5 (2.5-3s): Everything fades out
        const phaseProgress = (progress - 0.83) / 0.17;
        const alpha = Math.max(1 - phaseProgress, 0);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 18px Inter, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        ctx.fillText('Drag to aim, release to throw', w / 2, h * 0.5);
        ctx.restore();
      }

      // "Tap to skip" text always visible
      if (progress < 0.9) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.font = '12px Inter, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('Tap to skip', w / 2, h - 20);
        ctx.restore();
      }

      if (progress >= 1) {
        finish();
        return;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [finish]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ touchAction: 'none', zIndex: 10 }}
      onClick={finish}
      onTouchStart={finish}
    />
  );
}
