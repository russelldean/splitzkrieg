'use client';

import { useState, useEffect } from 'react';

interface CountdownClockProps {
  targetDate: string | null;
}

/**
 * Bowling starts at 7:15 PM EST (Eastern Standard Time) on Monday nights.
 * The target date from the DB is UTC midnight — we convert to 7:15 PM ET.
 * EST = UTC-5, EDT = UTC-4. We target 7:15 PM US/Eastern by computing
 * the UTC equivalent using Intl to detect whether DST is active.
 */
function getTargetTime(dateStr: string): number {
  const d = new Date(dateStr);
  // Set to 7:15 PM UTC as a starting point
  d.setUTCHours(19, 15, 0, 0);

  // Determine the UTC offset for Eastern time on this date.
  // We create a formatter that outputs the offset, then parse it.
  // EST = UTC-5 (19:15 ET = 00:15+1 UTC), EDT = UTC-4 (19:15 ET = 23:15 UTC)
  try {
    const eastern = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    });
    // Get what hour it would be in ET at our target UTC time
    const etHour = parseInt(eastern.format(d), 10);
    // The difference tells us the offset: if UTC 19:15 shows as 14 in ET, offset is -5
    const offsetHours = etHour - 19;
    // We want 19:15 ET, so shift UTC by -offset
    d.setUTCHours(19 - offsetHours, 15, 0, 0);
  } catch {
    // Fallback: assume EST (UTC-5) if Intl not available
    d.setUTCHours(24, 15, 0, 0); // 19:15 + 5 = 00:15 next day UTC
  }

  return d.getTime();
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

  useEffect(() => {
    setMounted(true);
    if (!targetDate) return;

    const targetMs = getTargetTime(targetDate);
    const update = () => setCountdown(computeCountdown(targetMs));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  // Pre-hydration placeholder
  if (!mounted) {
    return (
      <div
        className="bg-white rounded-xl border border-navy/10 p-4 sm:p-6 flex flex-col items-center justify-center min-h-[120px] sm:min-h-[180px]"
        suppressHydrationWarning
      />
    );
  }

  // No scheduled date
  if (!targetDate) {
    return (
      <div className="bg-white rounded-xl border border-navy/10 p-4 sm:p-6 flex flex-col items-center justify-center text-center min-h-[120px] sm:min-h-[180px]">
        <p className="font-body text-navy/60 text-sm max-w-[220px] leading-relaxed">
          Next bowling night? Your guess is as good as ours. Check back once someone figures out the schedule.
        </p>
      </div>
    );
  }

  // It's bowling night!
  if (countdown?.isPast) {
    return (
      <div className="bg-white rounded-xl border border-navy/10 p-4 sm:p-6 flex flex-col items-center justify-center text-center min-h-[120px] sm:min-h-[180px]" suppressHydrationWarning>
        <div className="text-3xl sm:text-4xl mb-2" role="img" aria-label="bowling">🎳</div>
        <p className="font-heading text-xl sm:text-2xl text-navy">It&rsquo;s bowling night!</p>
        <p className="font-body text-sm text-navy/40 mt-1">Lace up those shoes.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-navy/10 p-4 sm:p-6 flex flex-col items-center justify-center min-h-[120px] sm:min-h-[180px]" suppressHydrationWarning>
      <div className="flex items-baseline gap-4 sm:gap-4 sm:p-6">
        <TimeUnit value={countdown?.days ?? 0} label={(countdown?.days ?? 0) === 1 ? 'day' : 'days'} />
        <Separator />
        <TimeUnit value={countdown?.hours ?? 0} label={(countdown?.hours ?? 0) === 1 ? 'hr' : 'hrs'} />
        <Separator />
        <TimeUnit value={countdown?.minutes ?? 0} label="min" />
        <Separator />
        <TimeUnit value={countdown?.seconds ?? 0} label="sec" />
      </div>

      <p className="text-sm text-navy/40 mt-4 font-body">until the next bowling night</p>
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-heading text-3xl sm:text-4xl text-navy leading-none tabular-nums">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-xs font-body text-navy/60 mt-1">{label}</span>
    </div>
  );
}

function Separator() {
  return <span className="font-heading text-2xl sm:text-3xl text-navy/20 leading-none -mt-3">:</span>;
}
