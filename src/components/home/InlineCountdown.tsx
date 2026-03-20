'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTargetTime, computeCountdown, getDebugTargetTime } from '@/lib/bowling-time';

interface InlineCountdownProps {
  targetDate: string | null;
  weekNumber: number;
}

/**
 * Compact countdown that sits inside the Week Results CTA card.
 * Shows "Xd Xh Xm Xs until Week N" in white text.
 */
export function InlineCountdown({ targetDate, weekNumber }: InlineCountdownProps) {
  const [mounted, setMounted] = useState(false);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false });

  const getEffectiveTarget = useCallback(() => {
    const debug = getDebugTargetTime();
    if (debug !== null) return debug;
    if (!targetDate) return null;
    return getTargetTime(targetDate);
  }, [targetDate]);

  useEffect(() => {
    setMounted(true);
    const targetMs = getEffectiveTarget();
    if (!targetMs) return;

    const update = () => setCountdown(computeCountdown(targetMs));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate, getEffectiveTarget]);

  if (!mounted || !targetDate || countdown.isPast || weekNumber <= 0) return null;

  const { days, hours, minutes, seconds } = countdown;

  return (
    <div className="mt-2 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-md px-3 py-1.5 border border-white/15" suppressHydrationWarning>
      <span className="font-digital text-lg text-red-300 tabular-nums tracking-wider drop-shadow-[0_0_8px_rgba(252,165,165,0.4)]">
        {days > 0 && <>{days}d </>}
        {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
      <span className="font-body text-xs text-white/60 uppercase tracking-wider">
        until Week {weekNumber}
      </span>
    </div>
  );
}
