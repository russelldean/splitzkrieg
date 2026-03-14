'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getTargetTime, computeCountdown, getDebugTargetTime } from '@/lib/bowling-time';

/** Shows a bold Orbitron countdown clock in the header — only on the homepage */
export function HomeHeaderCountdown({ targetDate }: { targetDate: string | null }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [cd, setCd] = useState<ReturnType<typeof computeCountdown> | null>(null);

  useEffect(() => {
    setMounted(true);
    const debugTarget = getDebugTargetTime();
    const targetMs = debugTarget ?? (targetDate ? getTargetTime(targetDate) : null);
    if (!targetMs) return;

    const update = () => {
      const result = computeCountdown(targetMs);
      setCd(result.isPast ? null : result);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (pathname !== '/' || !mounted || !cd) return null;

  const { days, hours, minutes, seconds } = cd;

  const segments = [
    { value: days, label: 'd' },
    { value: hours, label: 'h' },
    { value: minutes, label: 'm' },
    { value: seconds, label: 's' },
  ];

  return (
    <div className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none" suppressHydrationWarning>
      <div className="flex items-baseline gap-1">
        {segments.map(({ value, label }) => (
          <span key={label} className="flex items-baseline">
            <span className="font-digital text-2xl tracking-wider text-navy tabular-nums">
              {String(value).padStart(2, '0')}
            </span>
            <span className="font-body text-sm text-navy/40 ml-0.5">{label}</span>
          </span>
        ))}
        <span className="font-body text-sm text-navy/50 ml-3">until bowling</span>
      </div>
    </div>
  );
}
