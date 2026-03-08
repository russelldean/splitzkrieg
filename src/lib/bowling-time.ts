/**
 * Shared time utilities for countdown and league-night detection.
 * Bowling starts at 7:15 PM ET on Monday nights.
 */

/** Convert a date string to the target timestamp (7:15 PM ET that day). */
export function getTargetTime(dateStr: string): number {
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

/** Check if it's currently league night (Monday 7:15–10:45 PM ET). */
export function isLeagueNightNow(): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
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

/** Compute countdown components from a target timestamp. */
export function computeCountdown(targetMs: number) {
  const diff = targetMs - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    isPast: false,
  };
}

/** Check if it's Monday after bowling (11:00 PM – midnight ET). */
export function isPostBowlingNow(): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const weekday = parts.find(p => p.type === 'weekday')?.value;
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
    if (weekday !== 'Monday') return false;
    return hour >= 23; // 11 PM+
  } catch {
    return false;
  }
}

/**
 * Format a match date string safely, avoiding timezone shift.
 * DB dates come as UTC midnight (e.g. 2026-03-09T00:00:00.000Z),
 * which shifts to the previous day in US timezones. Using timeZone: 'UTC'
 * ensures we display the date as stored.
 */
export function formatMatchDate(
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
}

/**
 * Check for ?countdown_debug=SECONDS in the URL.
 * Returns a fake target time N seconds from now, or null if not set.
 */
export function getDebugTargetTime(): number | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const debug = params.get('countdown_debug');
  if (debug === null) return null;
  const seconds = parseInt(debug, 10);
  if (isNaN(seconds)) return null;
  return Date.now() + seconds * 1000;
}
