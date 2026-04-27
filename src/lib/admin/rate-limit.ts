/**
 * In-memory rate limiter + brute-force tripwire for the admin login route.
 *
 * Layers:
 *   1. Per-IP throttle: 5 failed attempts / 15 min → 429
 *   2. Per-IP tripwire: 10 failed attempts / 15 min → DB row + email alert
 *   3. Global tripwire: 50 failed attempts across all IPs / 60 min → DB row + email alert
 *   4. Dedup: each tripwire suppresses repeat alerts from the same IP for 60 min
 *
 * State lives in module-level Maps — per-instance, cleared on function recycle.
 * Lazy cleanup on access; no timer. Good enough for a league site; upgrade to
 * Upstash KV if/when the DB securityEvents table ever shows a sustained attack.
 */

import { NextRequest } from 'next/server';
import { Resend } from 'resend';
import { getDb } from '@/lib/db';

const WINDOW_MS = 15 * 60 * 1000;           // per-IP counter window
const GLOBAL_WINDOW_MS = 60 * 60 * 1000;    // global counter window
const DEDUP_MS = 60 * 60 * 1000;            // minimum gap between alerts per IP

const IP_LIMIT = 5;      // block at this many failed attempts
const IP_ALERT = 10;     // email + DB write at this many failed attempts
const GLOBAL_ALERT = 50; // email + DB write when total across all IPs hits this

type IpEntry = {
  count: number;
  firstTry: number;
  lastAlertAt: number | null;
};

const ipAttempts = new Map<string, IpEntry>();
const globalAttempts: number[] = []; // rolling list of recent failure timestamps
let globalLastAlertAt: number | null = null;

export function extractIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export type RateCheck =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };

/**
 * Call BEFORE checking the password. Returns whether the request may proceed.
 * If blocked, caller should return 429 without doing any auth work.
 */
export function checkRateLimit(ip: string): RateCheck {
  const now = Date.now();
  const entry = ipAttempts.get(ip);

  if (entry && now - entry.firstTry > WINDOW_MS) {
    ipAttempts.delete(ip);
    return { allowed: true };
  }

  if (entry && entry.count >= IP_LIMIT) {
    const retryAfterSec = Math.ceil((entry.firstTry + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSec: Math.max(retryAfterSec, 1) };
  }

  return { allowed: true };
}

/**
 * Call AFTER a failed password check. Records the failure, emits structured
 * log line, and fires alerts if thresholds trip.
 */
export async function recordFailedLogin(
  request: NextRequest,
  ip: string,
): Promise<void> {
  const now = Date.now();
  const ua = request.headers.get('user-agent') ?? 'unknown';

  // --- Per-IP counter ---
  let entry = ipAttempts.get(ip);
  if (!entry || now - entry.firstTry > WINDOW_MS) {
    entry = { count: 0, firstTry: now, lastAlertAt: null };
  }
  entry.count += 1;
  ipAttempts.set(ip, entry);

  // --- Global rolling counter ---
  globalAttempts.push(now);
  while (globalAttempts.length && now - globalAttempts[0] > GLOBAL_WINDOW_MS) {
    globalAttempts.shift();
  }

  // Structured log line for every failure (goes to Vercel logs, ephemeral)
  console.warn(JSON.stringify({
    event: 'admin_login_fail',
    ip,
    ua,
    ipAttemptCount: entry.count,
    globalAttemptCount: globalAttempts.length,
    at: new Date(now).toISOString(),
  }));

  // --- Per-IP tripwire ---
  const ipDedupExpired =
    entry.lastAlertAt === null || now - entry.lastAlertAt > DEDUP_MS;
  if (entry.count >= IP_ALERT && ipDedupExpired) {
    entry.lastAlertAt = now;
    ipAttempts.set(ip, entry);
    await fireAlert({
      eventType: 'brute_force_ip',
      ip,
      userAgent: ua,
      details: {
        attemptCount: entry.count,
        windowMinutes: WINDOW_MS / 60000,
        firstTryAt: new Date(entry.firstTry).toISOString(),
      },
    });
  }

  // --- Global tripwire ---
  const globalDedupExpired =
    globalLastAlertAt === null || now - globalLastAlertAt > DEDUP_MS;
  if (globalAttempts.length >= GLOBAL_ALERT && globalDedupExpired) {
    globalLastAlertAt = now;
    await fireAlert({
      eventType: 'brute_force_global',
      ip: null,
      userAgent: null,
      details: {
        attemptCount: globalAttempts.length,
        windowMinutes: GLOBAL_WINDOW_MS / 60000,
      },
    });
  }
}

/** Call on successful login — clears the attacker-like state for this IP. */
export function recordSuccessfulLogin(ip: string): void {
  ipAttempts.delete(ip);
}

type AlertPayload = {
  eventType: 'brute_force_ip' | 'brute_force_global';
  ip: string | null;
  userAgent: string | null;
  details: Record<string, unknown>;
};

async function fireAlert(payload: AlertPayload): Promise<void> {
  // DB write (durable record). Wrapped so alert email still fires if DB hiccups.
  try {
    const db = await getDb();
    await db
      .request()
      .input('eventType', payload.eventType)
      .input('ip', payload.ip)
      .input('userAgent', payload.userAgent)
      .input('details', JSON.stringify(payload.details))
      .query(`
        INSERT INTO securityEvents (eventType, ip, userAgent, details)
        VALUES (@eventType, @ip, @userAgent, @details)
      `);
  } catch (err) {
    console.error('securityEvents insert failed:', err);
  }

  // Email alert via Resend
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    const resend = new Resend(apiKey);
    const fromAddress =
      process.env.RECAP_FROM_ADDRESS || 'Splitzkrieg <noreply@splitzkrieg.com>';

    const subject =
      payload.eventType === 'brute_force_ip'
        ? `Splitzkrieg security: brute-force attempt from ${payload.ip}`
        : `Splitzkrieg security: distributed brute-force activity`;

    const body = [
      `Event type: ${payload.eventType}`,
      payload.ip ? `IP: ${payload.ip}` : null,
      payload.userAgent ? `User-Agent: ${payload.userAgent}` : null,
      '',
      'Details:',
      JSON.stringify(payload.details, null, 2),
      '',
      'A durable record has been written to the securityEvents table.',
      'Further alerts from this source are suppressed for 60 minutes.',
    ]
      .filter((line) => line !== null)
      .join('\n');

    await resend.emails.send({
      from: fromAddress,
      to: 'charlesrusselldean@gmail.com',
      subject,
      text: body,
    });
  } catch (err) {
    console.error('Security alert email failed:', err);
  }
}
