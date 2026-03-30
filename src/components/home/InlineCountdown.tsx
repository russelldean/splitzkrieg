'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getTargetTime, computeCountdown, getDebugTargetTime, isLeagueNightNow } from '@/lib/bowling-time';

interface InlineCountdownProps {
  targetDate: string | null;
  followingDate?: string | null;
  weekNumber: number;
}

const TAKEOVER_DURATION = 15_000;

/** Stick figure that runs across the screen holding an item */
function RunningFigure({ item, delay, y, dur, reverse, turnaround, itemScale }: { item: React.ReactNode; delay: string; y: string; dur: string; reverse?: boolean; turnaround?: boolean; itemScale?: number }) {
  return (
    <div
      className={`absolute pointer-events-none select-none ${turnaround ? 'animate-hot-fun-runner-turn' : reverse ? 'animate-hot-fun-runner-rev' : 'animate-hot-fun-runner'}`}
      style={{ top: y, '--runner-delay': delay, '--runner-dur': dur } as React.CSSProperties}
    >
      <div className="relative" style={reverse ? { transform: 'scaleX(-1)' } : undefined}>
        {/* Item held above head */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-3xl sm:text-4xl"
          style={itemScale ? { transform: `translateX(-50%) scale(${itemScale})`, transformOrigin: 'center bottom' } : undefined}>
          {item}
        </div>
        {/* Stick figure SVG */}
        <svg width="60" height="80" viewBox="-15 8 30 58">
          <circle cx="0" cy="14" r="7" fill="white" />
          <line x1="0" y1="21" x2="0" y2="44" stroke="white" strokeWidth="3" strokeLinecap="round" />
          {/* Arms up holding item */}
          <line x1="0" y1="28" x2="-9" y2="18" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="0" y1="28" x2="9" y2="18" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          {/* Legs - animated walking pose via CSS */}
          <line x1="0" y1="44" x2="-10" y2="62" stroke="white" strokeWidth="2.5" strokeLinecap="round"
            className="origin-[0px_44px] animate-hot-fun-leg-l" />
          <line x1="0" y1="44" x2="10" y2="62" stroke="white" strokeWidth="2.5" strokeLinecap="round"
            className="origin-[0px_44px] animate-hot-fun-leg-r" />
        </svg>
      </div>
    </div>
  );
}

function FlipCard({ value }: { value: string }) {
  const [current, setCurrent] = useState(value);
  const [previous, setPrevious] = useState(value);
  const [animating, setAnimating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value !== current) {
      setPrevious(current);
      setCurrent(value);
      setAnimating(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setAnimating(false), 600);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="flip-card">
      {/* Static top: always shows NEW value (revealed when top flap folds away) */}
      <div className="flip-card-top"><span>{current}</span></div>
      {/* Static bottom: shows OLD value while animating, NEW when done */}
      <div className="flip-card-bottom"><span>{animating ? previous : current}</span></div>

      {/* Top flap: shows OLD value, folds down to reveal new value behind it */}
      <div
        className={`flip-card-flap-top ${animating ? 'flip-active' : ''}`}
        aria-hidden
      >
        <span>{animating ? previous : current}</span>
      </div>

      {/* Bottom flap: shows NEW value, unfolds down into place over old bottom */}
      <div
        className={`flip-card-flap-bot ${animating ? 'flip-active' : ''}`}
        aria-hidden
      >
        <span>{current}</span>
      </div>
    </div>
  );
}

function FlipUnit({ value, label }: { value: string; label: string }) {
  const digits = value.split('');
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex gap-[2px]">
        {digits.map((d, i) => (
          <FlipCard key={i} value={d} />
        ))}
      </div>
      <span className="flip-label">{label}</span>
    </div>
  );
}

export function InlineCountdown({ targetDate, followingDate, weekNumber }: InlineCountdownProps) {
  const [mounted, setMounted] = useState(false);
  const [activeDate, setActiveDate] = useState(targetDate);
  const [activeWeek, setActiveWeek] = useState(weekNumber);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false });
  const [showTakeover, setShowTakeover] = useState(false);
  const [takeoverOpacity, setTakeoverOpacity] = useState(0);
  const takeoverFiredRef = useRef(false);
  const switchedToFollowingRef = useRef(false);

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

  // Emoji rain
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

  const [showRunners, setShowRunners] = useState(false);
  const [bowlingInProgress, setBowlingInProgress] = useState(false);

  const fireTakeover = useCallback(() => {
    if (takeoverFiredRef.current) return;
    takeoverFiredRef.current = true;
    setShowTakeover(true);
    // Fade in
    requestAnimationFrame(() => setTakeoverOpacity(1));
    // Stick figures run across at 5 seconds
    setTimeout(() => setShowRunners(true), 5000);
    // Fade out and hide after duration, then show bowling in progress
    setTimeout(() => {
      setTakeoverOpacity(0);
      setTimeout(() => {
        setShowTakeover(false);
        setShowRunners(false);
        setBowlingInProgress(true);
      }, 500);
    }, TAKEOVER_DURATION);
  }, []);

  const getEffectiveTarget = useCallback(() => {
    const debug = getDebugTargetTime();
    if (debug !== null) return debug;
    if (!activeDate) return null;
    return getTargetTime(activeDate);
  }, [activeDate]);

  // Listen for ?hotfun=1 (instant) or ?hotfun=5 (delay in seconds)
  // Also ?bowling=1 to test "Bowling in Progress" state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('bowling') === '1') {
      takeoverFiredRef.current = true;
      setBowlingInProgress(true);
      return;
    }
    const hotfun = params.get('hotfun');
    if (hotfun === null) return;
    const delaySec = parseInt(hotfun, 10);
    if (delaySec > 1) {
      const t = setTimeout(() => fireTakeover(), delaySec * 1000);
      return () => clearTimeout(t);
    }
    fireTakeover();
  }, [fireTakeover]);

  useEffect(() => {
    setMounted(true);
    const targetMs = getEffectiveTarget();
    if (!targetMs) return;

    const update = () => {
      const cd = computeCountdown(targetMs);
      setCountdown(cd);
      // Fire takeover when countdown reaches zero
      if (cd.isPast && !takeoverFiredRef.current) {
        fireTakeover();
      }
      // Check if bowling is still in progress (clears after 10:45 PM ET)
      if (cd.isPast && takeoverFiredRef.current && !switchedToFollowingRef.current) {
        const stillBowling = isLeagueNightNow();
        setBowlingInProgress(stillBowling);
        // Bowling ended - switch to counting down to the following date
        if (!stillBowling && followingDate) {
          switchedToFollowingRef.current = true;
          takeoverFiredRef.current = false;
          setBowlingInProgress(false);
          setActiveDate(followingDate);
          setActiveWeek(weekNumber + 1);
        }
      }
    };
    // Detect if page loads mid-bowling BEFORE first update,
    // so the takeover doesn't fire on every Monday night page load
    if (isLeagueNightNow()) {
      takeoverFiredRef.current = true;
      setBowlingInProgress(true);
    }
    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [activeDate, getEffectiveTarget, fireTakeover, followingDate, weekNumber]);

  if (!mounted) return null;

  const showClock = activeDate && !countdown.isPast && activeWeek > 0 && !showTakeover && !bowlingInProgress;

  const { days, hours, minutes, seconds } = countdown;

  const units = [
    { value: String(days).padStart(2, '0'), label: 'DAYS' },
    { value: String(hours).padStart(2, '0'), label: 'HRS' },
    { value: String(minutes).padStart(2, '0'), label: 'MIN' },
    { value: String(seconds).padStart(2, '0'), label: 'SEC' },
  ];

  return (
    <>
      {/* Full-screen HOT FUN takeover */}
      {showTakeover && (
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

            {/* Stick figure runners - appear 5s in */}
            {showRunners && (
              <>
                <RunningFigure item="🎳" delay="0s"   y="30%" dur="4.5s" />
                <RunningFigure item="🏆" delay="1s"   y="55%" dur="5.5s" />
                <RunningFigure item="🍕" delay="0.4s" y="75%" dur="8.5s" turnaround itemScale={1.5} />
                <RunningFigure item="🍺" delay="0.7s" y="42%" dur="6s" reverse />
                <RunningFigure item="🎉" delay="1.5s" y="68%" dur="4s" reverse />
              </>
            )}

            {/* Center content */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative text-center">
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

      {/* Bowling in progress */}
      {bowlingInProgress && !showTakeover && (
        <div className="flex items-center gap-4 px-4 py-4">
          <span className="text-4xl sm:text-5xl">🎳</span>
          <span className="animate-bowling-colors font-heading text-4xl sm:text-5xl tracking-wider">
            Bowling in Progress
          </span>
        </div>
      )}

      {/* Flip clock countdown */}
      {showClock && (
        <div suppressHydrationWarning>
          <div className="flex items-start gap-1 sm:gap-3">
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex gap-[2px]">
                {'WK'.split('').map((ch, i) => (
                  <FlipCard key={`wk-${i}`} value={ch} />
                ))}
                <div style={{ width: 3 }} />
                {String(activeWeek).split('').map((ch, i) => (
                  <FlipCard key={`wn-${i}`} value={ch} />
                ))}
              </div>
              <span className="flip-label">NEXT</span>
            </div>
            <div className="w-px h-[34px] sm:h-[46px] bg-white/50 self-start" />
            {units.map((u, i) => (
              <div key={u.label} className="flex items-start gap-1 sm:gap-2">
                <FlipUnit value={u.value} label={u.label} />
                {i < units.length - 1 && (
                  <span className="flip-colon">:</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
