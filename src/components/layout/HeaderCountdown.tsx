'use client';

import { useState, useEffect } from 'react';

interface Props {
  targetDate: string | null;
}

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

function isLeagueNightNow(): boolean {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(now);
    const weekday = parts.find(p => p.type === 'weekday')?.value;
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
    if (weekday !== 'Monday') return false;
    const t = hour * 60 + minute;
    return t >= 1155 && t <= 1365;
  } catch {
    return false;
  }
}

function computeCountdown(targetMs: number) {
  const diff = targetMs - Date.now();
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s };
}

export function HeaderCountdown({ targetDate }: Props) {
  const [mounted, setMounted] = useState(false);
  const [cd, setCd] = useState<ReturnType<typeof computeCountdown>>(null);
  const [hotFun, setHotFun] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!targetDate) return;
    const targetMs = getTargetTime(targetDate);
    const update = () => {
      setCd(computeCountdown(targetMs));
      setHotFun(isLeagueNightNow());
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!mounted) return null;

  if (hotFun) {
    return (
      <span className="font-heading text-[10px] text-red-600 tracking-wider uppercase animate-pulse" suppressHydrationWarning>
        HOT FUN - League in session
      </span>
    );
  }

  if (!cd) return null;

  return (
    <span className="font-body text-[11px] text-navy/60 tabular-nums tracking-wide" suppressHydrationWarning>
      <span className="font-semibold text-navy/70">{cd.d}d {String(cd.h).padStart(2, '0')}h {String(cd.m).padStart(2, '0')}m {String(cd.s).padStart(2, '0')}s</span>
      {' '}until bowling
    </span>
  );
}
