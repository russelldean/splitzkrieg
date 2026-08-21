import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReminderRecipient } from './lineup-reminders';

// sendReminders is the half of the module the pure test file deliberately
// avoids: it reaches for resend and, through the module's top-level import of
// getDb, for mssql. Both are stubbed so this file stays a unit test.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('resend', () => ({
  // A class, not vi.fn(() => ...): the module calls `new Resend(key)` and an
  // arrow function is not constructible.
  Resend: class {
    emails = { send: sendMock };
  },
}));
vi.mock('@/lib/db', () => ({ getDb: vi.fn() }));

const { sendReminders } = await import('./lineup-reminders');

function team(n: number, email: string | null = `t${n}@example.com`): ReminderRecipient {
  return { teamID: n, teamName: `Team ${n}`, bowlerName: `Captain ${n}`, email };
}

/** A sleep that records what it was asked to wait rather than waiting. */
function fakeSleep() {
  const waits: number[] = [];
  return { waits, sleep: async (ms: number) => void waits.push(ms) };
}

describe('sendReminders', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ id: 'ok' });
    process.env.RESEND_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it('throws when RESEND_API_KEY is not configured', async () => {
    delete process.env.RESEND_API_KEY;
    await expect(sendReminders([team(1)], 'reminder', 4)).rejects.toThrow('RESEND_API_KEY');
  });

  it('mails every recipient that has an address', async () => {
    const { sleep } = fakeSleep();
    const out = await sendReminders([team(1), team(2), team(3)], 'reminder', 4, { sleep });

    expect(out.sent).toBe(3);
    expect(sendMock).toHaveBeenCalledTimes(3);
    expect(sendMock.mock.calls.map((c) => c[0].to)).toEqual([
      't1@example.com',
      't2@example.com',
      't3@example.com',
    ]);
  });

  it('skips a recipient with no address without spending a send', async () => {
    const { sleep } = fakeSleep();
    const out = await sendReminders([team(1), team(2, null), team(3)], 'reminder', 4, { sleep });

    expect(out.sent).toBe(2);
    expect(out.skipped).toBe(1);
    expect(out.noEmail).toEqual(['Team 2']);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('collects a failed send as an error and keeps going', async () => {
    const { sleep } = fakeSleep();
    sendMock.mockRejectedValueOnce(new Error('mailbox full'));
    const out = await sendReminders([team(1), team(2)], 'reminder', 4, { sleep });

    expect(out.sent).toBe(1);
    expect(out.errors).toEqual(['Team 1: mailbox full']);
  });

  it('paces between attempts but not before the first', async () => {
    const { waits, sleep } = fakeSleep();
    await sendReminders([team(1), team(2), team(3)], 'reminder', 4, { sleep });

    expect(waits).toEqual([600, 600]);
  });

  it('paces on attempts, not successes, so a run of failures cannot outrun the cap', async () => {
    const { waits, sleep } = fakeSleep();
    sendMock.mockRejectedValue(new Error('down'));
    await sendReminders([team(1), team(2), team(3)], 'reminder', 4, { sleep });

    expect(waits).toEqual([600, 600]);
  });

  // The reason this callback exists. The cron used to stamp the dedupe key
  // after the loop, so a function killed mid-run left no trace and the retry
  // mailed everyone a second time.
  describe('onFirstSend', () => {
    it('fires once, before the second recipient is mailed', async () => {
      const { sleep } = fakeSleep();
      const order: string[] = [];
      sendMock.mockImplementation(async (m: { to: string }) => {
        order.push(`send:${m.to}`);
        return { id: 'ok' };
      });

      await sendReminders([team(1), team(2), team(3)], 'reminder', 4, {
        sleep,
        onFirstSend: async () => void order.push('claim'),
      });

      expect(order).toEqual([
        'send:t1@example.com',
        'claim',
        'send:t2@example.com',
        'send:t3@example.com',
      ]);
    });

    it('does not fire when every send fails, so the retry is still allowed', async () => {
      const { sleep } = fakeSleep();
      const onFirstSend = vi.fn();
      sendMock.mockRejectedValue(new Error('down'));

      const out = await sendReminders([team(1), team(2)], 'reminder', 4, { sleep, onFirstSend });

      expect(out.sent).toBe(0);
      expect(onFirstSend).not.toHaveBeenCalled();
    });

    it('fires on the first success even when earlier recipients failed', async () => {
      const { sleep } = fakeSleep();
      const onFirstSend = vi.fn();
      sendMock.mockRejectedValueOnce(new Error('down'));

      await sendReminders([team(1), team(2), team(3)], 'reminder', 4, { sleep, onFirstSend });

      expect(onFirstSend).toHaveBeenCalledTimes(1);
    });

    it('does not abort the run when recording throws', async () => {
      const { sleep } = fakeSleep();
      const out = await sendReminders([team(1), team(2)], 'reminder', 4, {
        sleep,
        onFirstSend: async () => {
          throw new Error('leagueSettings unreachable');
        },
      });

      expect(out.sent).toBe(2);
    });
  });

  // Second half of the timeout fix: stop on our own terms and say what is
  // left, rather than being killed with the outcome unreported.
  describe('deadline', () => {
    /** A clock that advances 600ms per read, mimicking the pacing delay. */
    function tickingClock(startAt = 0, step = 600) {
      let t = startAt;
      return () => (t += step);
    }

    it('stops before the deadline and reports what is left', async () => {
      const { sleep } = fakeSleep();
      const recipients = [1, 2, 3, 4, 5, 6].map((n) => team(n));

      const out = await sendReminders(recipients, 'reminder', 4, {
        sleep,
        now: tickingClock(),
        budgetMs: 2000,
      });

      expect(out.stoppedEarly).toBe(true);
      expect(out.sent).toBeLessThan(6);
      expect(out.sent + out.remaining).toBe(6);
      // Names, not just a count: the admin route can re-send to exactly these.
      expect(out.unreached).toHaveLength(out.remaining);
      expect(out.unreached.at(-1)).toBe('Team 6');
    });

    it('does not stop early when the budget is ample', async () => {
      const { sleep } = fakeSleep();
      const recipients = [1, 2, 3, 4, 5, 6].map((n) => team(n));

      const out = await sendReminders(recipients, 'reminder', 4, {
        sleep,
        now: tickingClock(),
        budgetMs: 600_000,
      });

      expect(out.stoppedEarly).toBe(false);
      expect(out.remaining).toBe(0);
      expect(out.unreached).toEqual([]);
      expect(out.sent).toBe(6);
    });

    it('is unbounded when no budget is given', async () => {
      const { sleep } = fakeSleep();
      const recipients = [1, 2, 3, 4, 5, 6].map((n) => team(n));

      const out = await sendReminders(recipients, 'reminder', 4, { sleep, now: tickingClock() });

      expect(out.stoppedEarly).toBe(false);
      expect(out.sent).toBe(6);
    });
  });
});
