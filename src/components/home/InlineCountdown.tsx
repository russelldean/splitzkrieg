'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getTargetTime, computeCountdown, getDebugTargetTime } from '@/lib/bowling-time';

interface InlineCountdownProps {
  targetDate: string | null;
  weekNumber: number;
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

  const units = [
    ...(days > 0 ? [{ value: String(days).padStart(2, '0'), label: 'DAYS' }] : []),
    { value: String(hours).padStart(2, '0'), label: 'HRS' },
    { value: String(minutes).padStart(2, '0'), label: 'MIN' },
    { value: String(seconds).padStart(2, '0'), label: 'SEC' },
  ];

  return (
    <div suppressHydrationWarning>
      <div className="flex items-start gap-2 sm:gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex gap-[2px]">
            {'WK'.split('').map((ch, i) => (
              <FlipCard key={`wk-${i}`} value={ch} />
            ))}
            <div style={{ width: 3 }} />
            {String(weekNumber).split('').map((ch, i) => (
              <FlipCard key={`wn-${i}`} value={ch} />
            ))}
          </div>
          <span className="flip-label">NEXT</span>
        </div>
        <span className="flip-colon">|</span>
        {units.map((u, i) => (
          <div key={u.label} className="flex items-start gap-1.5 sm:gap-2">
            <FlipUnit value={u.value} label={u.label} />
            {i < units.length - 1 && (
              <span className="flip-colon">:</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
