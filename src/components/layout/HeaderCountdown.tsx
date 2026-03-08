'use client';

import { useState, useEffect } from 'react';
import { getTargetTime, isLeagueNightNow, computeCountdown, getDebugTargetTime } from '@/lib/bowling-time';

interface Props {
  targetDate: string | null;
  variant?: 'light' | 'dark' | 'neon';
}

export function HeaderCountdown({ targetDate, variant = 'light' }: Props) {
  const [mounted, setMounted] = useState(false);
  const [cd, setCd] = useState<ReturnType<typeof computeCountdown> | null>(null);
  const [hotFun, setHotFun] = useState(false);

  useEffect(() => {
    setMounted(true);
    const debugTarget = getDebugTargetTime();
    const targetMs = debugTarget ?? (targetDate ? getTargetTime(targetDate) : null);
    if (!targetMs) return;

    const update = () => {
      const result = computeCountdown(targetMs);
      setCd(result.isPast ? null : result);
      setHotFun(debugTarget !== null ? result.isPast : isLeagueNightNow());
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!mounted) return null;

  if (hotFun) {
    const hotFunClass = variant === 'neon'
      ? 'text-red-400 animate-neon-flicker'
      : variant === 'dark' ? 'text-red-400' : 'text-red-600';
    return (
      <span className={`font-heading text-sm tracking-wider uppercase animate-pulse ${hotFunClass}`} suppressHydrationWarning>
        HOT FUN - League in session
      </span>
    );
  }

  if (!cd) return null;

  const { days, hours, minutes, seconds } = cd;
  const nums = `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

  if (variant === 'neon') {
    return (
      <span className="font-body text-sm tabular-nums tracking-wide" suppressHydrationWarning>
        <span
          className="font-semibold animate-neon-pulse"
          style={{
            color: '#ff4444',
            textShadow: '0 0 7px #ff4444, 0 0 20px #ff444480, 0 0 40px #ff444440',
          }}
        >{nums}</span>
        <span className="text-white/50 ml-1">until bowling</span>
      </span>
    );
  }

  if (variant === 'dark') {
    return (
      <span className="font-body text-sm text-white/70 tabular-nums tracking-wide" suppressHydrationWarning>
        <span className="font-semibold text-white">{nums}</span> until bowling
      </span>
    );
  }

  return (
    <span className="font-body text-sm text-navy/60 tabular-nums tracking-wide" suppressHydrationWarning>
      <span className="font-semibold text-navy/70">{nums}</span> until bowling
    </span>
  );
}
