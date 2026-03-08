'use client';

import { useState, useEffect, useCallback } from 'react';
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
      {/* Full-screen HOT FUN takeover */}
      {phase === 'takeover' && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-500"
          style={{ opacity: takeoverOpacity }}
        >
          <div className="absolute inset-0 bg-red-600 animate-hot-fun-bg" />
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
            }}
          />
          <div className="relative text-center">
            <div className="animate-hot-fun-text">
              <p className="font-heading text-6xl sm:text-8xl text-cream tracking-wider drop-shadow-lg">
                HOT FUN
              </p>
            </div>
            <div className="animate-hot-fun-sub mt-4">
              <p className="font-body text-lg text-cream/80 tracking-widest uppercase">
                League is in session
              </p>
            </div>
            <div className="mt-6 text-4xl animate-bounce">🎳</div>
          </div>
        </div>
      )}

      {/* In-page card */}
      <div suppressHydrationWarning>
        {debugMode && (
          <p className="text-[10px] text-red-400 font-body text-center mb-1">DEBUG MODE</p>
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
            <p className="text-[10px] text-white/30 font-body tracking-widest uppercase mb-3">
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

        {/* ── Normal countdown: compact card ── */}
        {phase === 'countdown' && (
          <div className="bg-white rounded-xl border border-navy/10 px-4 py-3 flex items-center justify-center gap-2">
            <span className="text-xs text-navy/40 font-body">Next bowling</span>
            <span className="font-body text-sm text-navy/70 tabular-nums font-semibold">
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
            <p className="font-body text-xs text-cream/60 mt-1">League is in session 🎳</p>
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
