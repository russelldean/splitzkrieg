'use client';

import { useState, useEffect } from 'react';

interface CountdownClockProps {
  targetDate: string | null;
}

/**
 * Bowling starts at 7:15 PM EST on Monday nights.
 * EST = UTC-5, EDT = UTC-4.
 */
function getTargetTime(dateStr: string): number {
  const d = new Date(dateStr);
  d.setUTCHours(19, 15, 0, 0);

  try {
    const eastern = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    });
    const etHour = parseInt(eastern.format(d), 10);
    const offsetHours = etHour - 19;
    d.setUTCHours(19 - offsetHours, 15, 0, 0);
  } catch {
    d.setUTCHours(24, 15, 0, 0);
  }

  return d.getTime();
}

/**
 * Check if it's currently league night (Monday 7:15 PM - 10:45 PM Eastern).
 */
function isLeagueNightNow(): boolean {
  try {
    const now = new Date();
    const eastern = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = eastern.formatToParts(now);
    const weekday = parts.find(p => p.type === 'weekday')?.value;
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);

    if (weekday !== 'Monday') return false;
    const timeInMinutes = hour * 60 + minute;
    // 7:15 PM = 19:15 = 1155min, 10:45 PM = 22:45 = 1365min
    return timeInMinutes >= 1155 && timeInMinutes <= 1365;
  } catch {
    return false;
  }
}

function computeCountdown(targetMs: number) {
  const diff = targetMs - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds, isPast: false };
}

export function CountdownClock({ targetDate }: CountdownClockProps) {
  const [mounted, setMounted] = useState(false);
  const [countdown, setCountdown] = useState<ReturnType<typeof computeCountdown> | null>(null);
  const [hotFun, setHotFun] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!targetDate) return;

    const targetMs = getTargetTime(targetDate);
    const update = () => {
      setCountdown(computeCountdown(targetMs));
      setHotFun(isLeagueNightNow());
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!mounted) {
    return (
      <div
        className="bg-white rounded-xl border border-navy/10 p-4 sm:p-6 flex flex-col items-center justify-center min-h-[80px]"
        suppressHydrationWarning
      />
    );
  }

  if (!targetDate) {
    return (
      <div className="bg-white rounded-xl border border-navy/10 p-4 sm:p-6 flex flex-col items-center justify-center text-center min-h-[80px]">
        <p className="font-body text-navy/60 text-sm max-w-[220px] leading-relaxed">
          Next bowling night? Your guess is as good as ours. Check back once someone figures out the schedule.
        </p>
      </div>
    );
  }

  // HOT FUN mode: Monday 7:15-10:45 PM Eastern
  if (hotFun) {
    return (
      <div className="bg-red-600 rounded-xl p-4 sm:p-6 flex flex-col items-center justify-center text-center min-h-[80px]" suppressHydrationWarning>
        <div className="animate-pulse">
          <p className="font-heading text-3xl sm:text-5xl text-cream tracking-wider">
            HOT FUN
          </p>
        </div>
        <p className="font-body text-sm text-cream/60 mt-2">League is in session</p>
      </div>
    );
  }

  // Past target but not HOT FUN time
  if (countdown?.isPast) {
    return (
      <div className="bg-white rounded-xl border border-navy/10 p-4 sm:p-6 flex flex-col items-center justify-center text-center min-h-[80px]" suppressHydrationWarning>
        <div className="text-3xl sm:text-4xl mb-2" role="img" aria-label="bowling">🎳</div>
        <p className="font-heading text-xl sm:text-2xl text-navy">It&rsquo;s bowling night!</p>
        <p className="font-body text-sm text-navy/50 mt-1">Lace up those shoes.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-navy/10 p-4 sm:p-6 flex flex-col items-center justify-center min-h-[80px]" suppressHydrationWarning>
      <p className="text-xs text-navy/50 font-body mb-2">Next bowling night</p>
      <div className="flex items-baseline gap-2 sm:gap-3">
        <TimeUnit value={countdown?.days ?? 0} label={(countdown?.days ?? 0) === 1 ? 'day' : 'days'} />
        <Separator />
        <TimeUnit value={countdown?.hours ?? 0} label={(countdown?.hours ?? 0) === 1 ? 'hr' : 'hrs'} />
        <Separator />
        <TimeUnit value={countdown?.minutes ?? 0} label="min" />
        <Separator />
        <TimeUnit value={countdown?.seconds ?? 0} label="sec" />
      </div>
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-heading text-2xl sm:text-3xl text-navy leading-none tabular-nums">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] font-body text-navy/60 mt-0.5">{label}</span>
    </div>
  );
}

function Separator() {
  return <span className="font-heading text-2xl sm:text-3xl text-navy/20 leading-none -mt-3">:</span>;
}
