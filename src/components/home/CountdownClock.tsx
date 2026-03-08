'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getTargetTime, isLeagueNightNow, isPostBowlingNow, computeCountdown, getDebugTargetTime } from '@/lib/bowling-time';

interface CountdownClockProps {
  targetDate: string | null;
  weekNumber?: number;
}

/**
 * Phases:
 *  countdown     — compact card (> 2 min to go)
 *  final         — big digital readout (≤ 2 min)
 *  takeover      — full-screen HOT FUN overlay (~15 sec)
 *  bowling       — hidden during league night (7:15–10:45 PM)
 *  results       — "Week N results pending" (11 PM+ Monday)
 *  past          — target passed, hide
 *  no-schedule   — no target date
 */
type Phase = 'countdown' | 'final' | 'takeover' | 'bowling' | 'results' | 'past' | 'no-schedule';

const TAKEOVER_DURATION = 10_000;
const FINAL_COUNTDOWN_THRESHOLD = 2 * 60; // 2 minutes in seconds

export function CountdownClock({ targetDate, weekNumber }: CountdownClockProps) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false });
  const [takeoverOpacity, setTakeoverOpacity] = useState(0);
  const [debugMode, setDebugMode] = useState(false);

  // Generate chaotic floating HOT FUN texts (stable across renders)
  const floatingTexts = useMemo(() => {
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      top: `${rand(5, 85)}%`,
      left: `${rand(-10, 80)}%`,
      fontSize: `${rand(1.5, 5)}rem`,
      scale: String(rand(0.8, 1.3).toFixed(2)),
      dur: `${rand(2.5, 5).toFixed(1)}s`,
      x1: `${rand(-40, 40)}px`, y1: `${rand(-30, 30)}px`, r1: `${rand(-15, 15)}deg`,
      x2: `${rand(-60, 60)}px`, y2: `${rand(-50, 50)}px`, r2: `${rand(-20, 20)}deg`,
      x3: `${rand(-40, 40)}px`, y3: `${rand(-30, 30)}px`, r3: `${rand(-15, 15)}deg`,
      x4: `${rand(-60, 60)}px`, y4: `${rand(-50, 50)}px`, r4: `${rand(-20, 20)}deg`,
    }));
  }, []);

  // Emoji rain — bowling pins, fire, strikes cascading down
  const emojiRain = useMemo(() => {
    const emojis = ['🔥', '🔥', '🔥', '🔥', '🔥', '💥', '🎳', '🔥', '⚡', '🔥'];
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      emoji: emojis[i % emojis.length],
      left: `${rand(2, 95)}%`,
      size: `${rand(1.2, 3)}rem`,
      dur: `${rand(1.5, 4)}s`,
      delay: `${rand(0, 6)}s`,
      spin: `${rand(180, 720)}deg`,
    }));
  }, []);

  const getEffectiveTarget = useCallback(() => {
    const debug = getDebugTargetTime();
    if (debug !== null) return debug;
    if (!targetDate) return null;
    return getTargetTime(targetDate);
  }, [targetDate]);

  useEffect(() => {
    setMounted(true);
    const debug = getDebugTargetTime();
    if (debug !== null) setDebugMode(true);

    const targetMs = getEffectiveTarget();
    if (!targetMs) {
      setPhase('no-schedule');
      return;
    }

    let takeoverFired = false;
    let takeoverTimer: ReturnType<typeof setTimeout> | null = null;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;

    const update = () => {
      // Don't update phase during takeover animation
      if (takeoverFired) return;

      if (!debugMode) {
        // Post-bowling: Monday 11 PM+
        if (isPostBowlingNow()) {
          setPhase('results');
          return;
        }
        // During bowling: Monday 7:15–10:45 PM
        if (isLeagueNightNow()) {
          setPhase('bowling');
          return;
        }
      }

      const cd = computeCountdown(targetMs);
      setCountdown(cd);

      if (cd.isPast) {
        // Just crossed zero — launch takeover!
        takeoverFired = true;
        setPhase('takeover');
        setTakeoverOpacity(1);

        takeoverTimer = setTimeout(() => {
          setTakeoverOpacity(0);
          fadeTimer = setTimeout(() => {
            setPhase('bowling');
          }, 500);
        }, TAKEOVER_DURATION);
        return;
      }

      const totalSeconds = cd.days * 86400 + cd.hours * 3600 + cd.minutes * 60 + cd.seconds;
      setPhase(totalSeconds <= FINAL_COUNTDOWN_THRESHOLD ? 'final' : 'countdown');
    };

    update();
    const interval = setInterval(update, 200);
    return () => {
      clearInterval(interval);
      if (takeoverTimer) clearTimeout(takeoverTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [targetDate, getEffectiveTarget, debugMode]);

  if (!mounted) return <CountdownShell />;

  // Hidden during bowling
  if (phase === 'bowling' || phase === 'past') return null;

  if (phase === 'no-schedule') {
    return (
      <div className="bg-white rounded-xl border border-navy/10 p-3 flex flex-col items-center justify-center text-center">
        <p className="font-body text-navy/60 text-xs max-w-[220px] leading-relaxed">
          Next bowling night? Check back once someone figures out the schedule.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Full-screen HOT FUN takeover — CHAOTIC REVELRY */}
      {phase === 'takeover' && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-500 overflow-hidden"
          style={{ opacity: takeoverOpacity }}
        >
          {/* Color-cycling background */}
          <div className="absolute inset-0 animate-hot-fun-bg" />

          {/* Scanlines */}
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
            }}
          />

          {/* Screen shake wrapper */}
          <div className="absolute inset-0 animate-hot-fun-shake">
            {/* Floating HOT FUNs bouncing around */}
            {floatingTexts.map((ft) => (
              <div
                key={ft.id}
                className="absolute font-heading text-cream/30 tracking-wider whitespace-nowrap animate-hot-fun-float pointer-events-none select-none"
                style={{
                  top: ft.top,
                  left: ft.left,
                  fontSize: ft.fontSize,
                  '--float-x1': ft.x1, '--float-y1': ft.y1, '--float-r1': ft.r1,
                  '--float-x2': ft.x2, '--float-y2': ft.y2, '--float-r2': ft.r2,
                  '--float-x3': ft.x3, '--float-y3': ft.y3, '--float-r3': ft.r3,
                  '--float-x4': ft.x4, '--float-y4': ft.y4, '--float-r4': ft.r4,
                  '--float-s': ft.scale,
                  '--float-dur': ft.dur,
                } as React.CSSProperties}
              >
                HOT FUN
              </div>
            ))}

            {/* Emoji rain */}
            {emojiRain.map((em) => (
              <div
                key={em.id}
                className="absolute top-0 animate-emoji-fall pointer-events-none select-none"
                style={{
                  left: em.left,
                  fontSize: em.size,
                  '--fall-dur': em.dur,
                  '--fall-delay': em.delay,
                  '--spin': em.spin,
                } as React.CSSProperties}
              >
                {em.emoji}
              </div>
            ))}

            {/* Center content */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative text-center">
                {/* Zoom-burst behind main text */}
                <div className="absolute inset-0 flex items-center justify-center animate-hot-fun-zoom pointer-events-none">
                  <p className="font-heading text-6xl sm:text-8xl text-cream/20 tracking-wider whitespace-nowrap">
                    HOT FUN
                  </p>
                </div>
                <div className="animate-hot-fun-text">
                  <p className="font-heading text-6xl sm:text-8xl text-cream tracking-wider drop-shadow-lg"
                    style={{ textShadow: '0 0 40px rgba(255,200,0,0.6), 0 0 80px rgba(255,100,0,0.4)' }}
                  >
                    HOT FUN
                  </p>
                </div>
                <div className="flex justify-center gap-3 mt-4 text-4xl">
                  <span className="animate-bounce" style={{ animationDelay: '0s' }}>🔥</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.15s' }}>🔥</span>
                  <span className="animate-bounce text-5xl" style={{ animationDelay: '0.3s' }}>🔥</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.45s' }}>🔥</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.6s' }}>🔥</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-page card */}
      <div suppressHydrationWarning>
        {debugMode && (
          <p className="text-xs text-red-400 font-body text-center mb-1">DEBUG MODE</p>
        )}

        {/* ── Results pending: post-bowling Monday 11 PM+ ── */}
        {phase === 'results' && (
          <div className="bg-white rounded-xl border border-navy/10 px-4 py-3 flex items-center justify-center text-center">
            <p className="font-body text-sm text-navy/60">
              Week {weekNumber || '?'} results pending — check back soon
            </p>
          </div>
        )}

        {/* ── Final countdown: digital clock readout ── */}
        {phase === 'final' && (
          <div className="bg-[#0a0a0a] rounded-xl p-5 flex flex-col items-center justify-center text-center border border-white/5">
            <p className="text-xs text-white/30 font-body tracking-widest uppercase mb-3">
              Bowling starts in
            </p>
            <div className="relative" style={{ fontFamily: 'var(--font-digital)' }}>
              {/* Ghost digits — the unlit segments */}
              <div className="text-6xl font-bold text-white/[0.06] tabular-nums tracking-[0.15em] select-none" aria-hidden>
                88:88
              </div>
              {/* Active digits */}
              <div className="absolute inset-0 text-6xl font-bold text-red-500 tabular-nums tracking-[0.15em] drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">
                {String(countdown.minutes).padStart(2, '0')}
                <span className="animate-pulse">:</span>
                {String(countdown.seconds).padStart(2, '0')}
              </div>
            </div>
          </div>
        )}

        {/* ── Normal countdown: neon card ── */}
        {phase === 'countdown' && (
          <div className="px-4 py-3 flex items-center justify-center gap-2">
            <span className="text-xs text-navy/40 font-body">Next bowling</span>
            <span
              className="font-body text-sm tabular-nums font-semibold animate-neon-pulse"
              style={{
                color: '#1B2A4A',
                textShadow: '0 0 7px #1B2A4A88, 0 0 20px #1B2A4A55, 0 0 40px #1B2A4A33',
              }}
            >
              {countdown.days}d {String(countdown.hours).padStart(2, '0')}h {String(countdown.minutes).padStart(2, '0')}m {String(countdown.seconds).padStart(2, '0')}s
            </span>
          </div>
        )}

        {/* During takeover, show HOT FUN in-page too */}
        {phase === 'takeover' && (
          <div className="bg-red-600 rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <div className="animate-pulse">
              <p className="font-heading text-2xl text-cream tracking-wider">HOT FUN</p>
            </div>
            <p className="font-body text-xs text-cream/60 mt-1">🔥🔥🔥</p>
          </div>
        )}
      </div>
    </>
  );
}

function CountdownShell() {
  return (
    <div
      className="bg-white rounded-xl border border-navy/10 px-4 py-3 flex items-center justify-center"
      suppressHydrationWarning
    />
  );
}
