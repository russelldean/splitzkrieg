'use client';

import { useState, useEffect } from 'react';
import { getTargetTime, computeCountdown, getDebugTargetTime } from '@/lib/bowling-time';
import { HeaderCountdown } from './HeaderCountdown';

/** Renders the neon countdown pill in the ticker — hides entirely when no active countdown. */
export function TickerCountdownPill({ targetDate }: { targetDate: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const debugTarget = getDebugTargetTime();
    const targetMs = debugTarget ?? getTargetTime(targetDate);
    if (!targetMs) return;

    const check = () => {
      const { isPast } = computeCountdown(targetMs);
      setVisible(!isPast);
    };
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!visible) return null;

  return (
    <div className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none">
      <div className="relative flex items-center">
        <div className="absolute -left-10 w-10 h-full bg-gradient-to-r from-transparent to-cream" />
        <div className="absolute -right-10 w-10 h-full bg-gradient-to-l from-transparent to-cream" />
        <div className="relative pointer-events-auto">
          {/* Animated gradient border glow */}
          <div className="absolute -inset-[2px] rounded-full bg-gradient-to-r from-navy via-red-500 to-orange-400 animate-border-glow opacity-80" />
          <div className="relative bg-[#0a0a0a] px-5 py-2.5 rounded-full">
            <HeaderCountdown targetDate={targetDate} variant="neon" />
          </div>
        </div>
      </div>
    </div>
  );
}
