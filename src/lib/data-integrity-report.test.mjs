import { describe, it, expect } from 'vitest';
import { shouldAlert, subjectFor, bodyFor } from './data-integrity-report.mjs';

describe('shouldAlert', () => {
  it('stays quiet on a clean run', () => {
    // A job that mails daily is a job whose mail stops being read.
    expect(shouldAlert({ findings: [] })).toBe(false);
  });

  it('alerts on any violation', () => {
    expect(shouldAlert({ findings: [{ message: 'x' }] })).toBe(true);
  });

  it('alerts when the check could not run at all', () => {
    // The dangerous case: a failure to connect must never read as clean data.
    expect(shouldAlert({ findings: [], error: 'login failed' })).toBe(true);
  });
});

describe('subjectFor', () => {
  it('distinguishes a failure to run from a violation', () => {
    expect(subjectFor({ error: 'timeout' })).toContain('could not run');
    expect(subjectFor({ findings: [{ message: 'a' }] })).toContain('1 violation');
  });

  it('pluralises', () => {
    expect(subjectFor({ findings: [{ message: 'a' }, { message: 'b' }] })).toContain('2 violations');
  });
});

describe('bodyFor', () => {
  it('lists every finding', () => {
    const body = bodyFor({
      findings: [{ message: 'duplicate-bowler-slug: 2 row(s)' }],
      checked: 17,
      ranAt: '2026-08-30T13:00:00Z',
    });
    expect(body).toContain('1 of 17');
    expect(body).toContain('duplicate-bowler-slug: 2 row(s)');
    expect(body).toContain('2026-08-30T13:00:00Z');
  });

  it('says plainly that a failed run is not a pass', () => {
    const body = bodyFor({ error: 'ECONNREFUSED', checked: 17 });
    expect(body).toContain('ECONNREFUSED');
    expect(body).toContain('NOT a clean result');
  });
});
