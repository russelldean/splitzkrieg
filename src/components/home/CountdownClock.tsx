'use client';

import { useState, useEffect } from 'react';

interface CountdownClockProps {
  targetDate: string | null;
}

function computeCountdown(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, isPast: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { days, hours, isPast: false };
}

export function CountdownClock({ targetDate }: CountdownClockProps) {
  const [mounted, setMounted] = useState(false);
  const [countdown, setCountdown] = useState<{ days: number; hours: number; isPast: boolean } | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!targetDate) return;

    const update = () => setCountdown(computeCountdown(targetDate));
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [targetDate]);

  // Pre-hydration: render nothing to avoid hydration mismatch
  if (!mounted) {
    return (
      <div
        className="bg-white rounded-xl border border-navy/10 p-6 flex flex-col items-center justify-center min-h-[180px]"
        suppressHydrationWarning
      />
    );
  }

  // No scheduled date
  if (!targetDate) {
    return (
      <div className="bg-white rounded-xl border border-navy/10 p-6 flex flex-col items-center justify-center text-center min-h-[180px]">
        {/* Bowling pin SVG */}
        <svg className="w-8 h-8 text-navy/20 mb-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C10.9 2 10 2.9 10 4C10 4.7 10.4 5.4 10.9 5.7C10.3 7.2 9 9.4 9 11C9 12.1 9.2 13 9.6 13.7C8.6 15.1 8 17 8 19C8 20.7 8.6 22 12 22C15.4 22 16 20.7 16 19C16 17 15.4 15.1 14.4 13.7C14.8 13 15 12.1 15 11C15 9.4 13.7 7.2 13.1 5.7C13.6 5.4 14 4.7 14 4C14 2.9 13.1 2 12 2Z" />
        </svg>
        <p className="font-body text-navy/60 text-sm max-w-[220px] leading-relaxed">
          Next bowling night? Your guess is as good as ours. Check back once someone figures out the schedule.
        </p>
      </div>
    );
  }

  // Bowling is happening!
  if (countdown?.isPast) {
    return (
      <div className="bg-white rounded-xl border border-navy/10 p-6 flex flex-col items-center justify-center text-center min-h-[180px]" suppressHydrationWarning>
        <div className="text-3xl sm:text-4xl mb-2" role="img" aria-label="bowling">🎳</div>
        <p className="font-heading text-xl sm:text-2xl text-navy">It&rsquo;s bowling night!</p>
        <p className="font-body text-sm text-navy/40 mt-1">Lace up those shoes.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-navy/10 p-6 flex flex-col items-center justify-center min-h-[180px]" suppressHydrationWarning>
      {/* Bowling pin icon */}
      <svg className="w-6 h-6 text-navy/20 mb-3" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C10.9 2 10 2.9 10 4C10 4.7 10.4 5.4 10.9 5.7C10.3 7.2 9 9.4 9 11C9 12.1 9.2 13 9.6 13.7C8.6 15.1 8 17 8 19C8 20.7 8.6 22 12 22C15.4 22 16 20.7 16 19C16 17 15.4 15.1 14.4 13.7C14.8 13 15 12.1 15 11C15 9.4 13.7 7.2 13.1 5.7C13.6 5.4 14 4.7 14 4C14 2.9 13.1 2 12 2Z" />
      </svg>

      <div className="flex items-baseline gap-6 sm:gap-8">
        <div className="flex flex-col items-center">
          <span className="font-heading text-4xl sm:text-5xl text-navy leading-none">
            {countdown?.days ?? 0}
          </span>
          <span className="text-sm font-body text-navy/60 mt-1">
            {countdown?.days === 1 ? 'day' : 'days'}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-heading text-4xl sm:text-5xl text-navy leading-none">
            {countdown?.hours ?? 0}
          </span>
          <span className="text-sm font-body text-navy/60 mt-1">
            {countdown?.hours === 1 ? 'hour' : 'hours'}
          </span>
        </div>
      </div>

      <p className="text-sm text-navy/40 mt-3 font-body">until the next bowling night</p>
    </div>
  );
}
