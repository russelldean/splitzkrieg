import { describe, it, expect } from 'vitest';
import { reminderPlan, isDuplicate, daysUntil, DEDUPE_HOURS } from './reminder-window';

describe('daysUntil', () => {
  it('counts whole calendar days forward', () => {
    expect(daysUntil('2026-08-21', '2026-08-24')).toBe(3);
  });

  it('is zero on the match day itself', () => {
    expect(daysUntil('2026-08-24', '2026-08-24')).toBe(0);
  });

  it('is negative after the match', () => {
    expect(daysUntil('2026-08-25', '2026-08-24')).toBe(-1);
  });

  it('does not drift across a DST boundary', () => {
    // UTC-anchored arithmetic means ET's DST transition cannot affect the
    // count. DST ends 2026-11-01 and Nov 2 is week 9.
    expect(daysUntil('2026-10-30', '2026-11-02')).toBe(3);
  });
});

describe('reminderPlan', () => {
  const base = { nowET: '2026-08-21', matchDate: '2026-08-24', enabled: true };

  it('sends the first ask on the Friday before', () => {
    const p = reminderPlan(base);
    expect(p.eligible).toBe(true);
    expect(p.pass).toBe('reminder');
  });

  it('sends the last call on match day', () => {
    // Regression: the old guard computed a negative float here and skipped,
    // so a Monday cron reported success and mailed nobody.
    const p = reminderPlan({ ...base, nowET: '2026-08-24' });
    expect(p.eligible).toBe(true);
    expect(p.pass).toBe('lastcall');
  });

  it('skips once the match is in the past', () => {
    const p = reminderPlan({ ...base, nowET: '2026-08-25' });
    expect(p.eligible).toBe(false);
    expect(p.reason).toMatch(/past/i);
  });

  it('skips when the match is too far out', () => {
    const p = reminderPlan({ ...base, nowET: '2026-08-18' });
    expect(p.eligible).toBe(false);
    expect(p.reason).toMatch(/early/i);
  });

  it('is still eligible exactly at the far edge of the window (4 days out)', () => {
    const p = reminderPlan({ ...base, nowET: '2026-08-20', matchDate: '2026-08-24' });
    expect(p.eligible).toBe(true);
    expect(p.pass).toBe('reminder');
  });

  it('is not eligible one day past the far edge (5 days out)', () => {
    const p = reminderPlan({ ...base, nowET: '2026-08-19', matchDate: '2026-08-24' });
    expect(p.eligible).toBe(false);
    expect(p.reason).toMatch(/early/i);
  });

  it('skips when the week has no scheduled match', () => {
    const p = reminderPlan({ ...base, matchDate: null });
    expect(p.eligible).toBe(false);
    expect(p.reason).toMatch(/no match/i);
  });

  it('skips when automation is switched off', () => {
    const p = reminderPlan({ ...base, enabled: false });
    expect(p.eligible).toBe(false);
    expect(p.reason).toMatch(/off/i);
  });

  it('still reports the correct pass when it is not eligible', () => {
    // The caller labels the skip reason with the pass, so it must be right
    // even when nothing is sent.
    expect(reminderPlan({ ...base, nowET: '2026-08-24', enabled: false }).pass).toBe('lastcall');
  });
});

describe('isDuplicate', () => {
  const now = '2026-08-21T14:00:00.000Z';

  it('is false when nothing was ever sent', () => {
    expect(isDuplicate(null, now)).toBe(false);
  });

  it('is true for a send an hour ago', () => {
    expect(isDuplicate('2026-08-21T13:00:00.000Z', now)).toBe(true);
  });

  it(`is false for a send older than ${DEDUPE_HOURS} hours`, () => {
    expect(isDuplicate('2026-08-20T01:00:00.000Z', now)).toBe(false);
  });

  it('is true exactly inside the boundary and false exactly outside', () => {
    const inside = new Date(Date.parse(now) - (DEDUPE_HOURS - 1) * 3600_000).toISOString();
    const outside = new Date(Date.parse(now) - (DEDUPE_HOURS + 1) * 3600_000).toISOString();
    expect(isDuplicate(inside, now)).toBe(true);
    expect(isDuplicate(outside, now)).toBe(false);
  });

  it('is false at the exact boundary, since the comparison is strict less-than', () => {
    const exact = new Date(Date.parse(now) - DEDUPE_HOURS * 3600_000).toISOString();
    expect(isDuplicate(exact, now)).toBe(false);
  });

  // These two bad-input cases resolve to opposite polarities on purpose.
  it('is false for an unparseable lastSentAt, failing OPEN toward a resend (same bias as the bug this module fixes: better a duplicate than silently mailing nobody)', () => {
    expect(isDuplicate('not-a-date', now)).toBe(false);
  });

  it('is true for a lastSentAt in the future (clock skew), failing CLOSED to suppress the send', () => {
    const future = new Date(Date.parse(now) + 3600_000).toISOString();
    expect(isDuplicate(future, now)).toBe(true);
  });
});
