import { describe, it, expect } from 'vitest';
import { deriveWeekStatus, type WeekCounts } from './week-status';

const counts = (over: Partial<WeekCounts> = {}): WeekCounts => ({
  scores: 80,
  turkeys: 6,
  matchResults: 10,
  patches: 12,
  milestones: 5,
  facts: 40,
  heroImage: null,
  writeupChars: 0,
  commitsAhead: null,
  deployedBehindBy: null,
  deployedSha: null,
  emailSentAt: null,
  ...over,
});

const step = (s: ReturnType<typeof deriveWeekStatus>, key: string) =>
  s.find((x) => x.key === key)!;

describe('deriveWeekStatus', () => {
  it('marks scores done once any are present', () => {
    expect(step(deriveWeekStatus(counts()), 'scores').state).toBe('done');
  });

  it('marks scores pending when the week has none yet', () => {
    expect(step(deriveWeekStatus(counts({ scores: 0 })), 'scores').state).toBe('pending');
  });

  it('marks the cascade done when every downstream table was written', () => {
    expect(step(deriveWeekStatus(counts()), 'cascade').state).toBe('done');
  });

  it('FLAGS a half-finished cascade rather than calling it pending', () => {
    // The 2026-08-04 failure: scores landed, facts never populated. A "pending"
    // label reads as "not started yet" and invites re-running; this needs to
    // shout that something ran and did not finish.
    const s = deriveWeekStatus(counts({ facts: 0 }));
    expect(step(s, 'cascade').state).toBe('attention');
    expect(step(s, 'cascade').detail).toMatch(/facts/i);
  });

  it('names every missing piece of a half-finished cascade', () => {
    // Milestones are deliberately not in the required set, so this uses two
    // tables that always produce rows when the pipeline completes.
    const s = deriveWeekStatus(counts({ patches: 0, facts: 0 }));
    expect(step(s, 'cascade').detail).toMatch(/patches/i);
    expect(step(s, 'cascade').detail).toMatch(/facts/i);
  });

  it('leaves the cascade pending, not flagged, when no scores exist yet', () => {
    // Nothing downstream can exist before scores do, so this is not a failure.
    const s = deriveWeekStatus(counts({ scores: 0, matchResults: 0, patches: 0, milestones: 0, facts: 0 }));
    expect(step(s, 'cascade').state).toBe('pending');
  });

  it('treats zero milestones as legitimate when everything else ran', () => {
    // A quiet week genuinely produces no career milestones.
    expect(step(deriveWeekStatus(counts({ milestones: 0 })), 'cascade').state).toBe('done');
  });

  it('treats photo and writeup as optional, never as blocking', () => {
    const s = deriveWeekStatus(counts({ heroImage: null, writeupChars: 0 }));
    expect(step(s, 'photo').state).toBe('optional');
    expect(step(s, 'writeup').state).toBe('optional');
  });

  it('marks photo and writeup done once present', () => {
    const s = deriveWeekStatus(counts({ heroImage: '/berry.jpg', writeupChars: 400 }));
    expect(step(s, 'photo').state).toBe('done');
    expect(step(s, 'writeup').state).toBe('done');
  });

  it('flags unpushed commits as the thing standing between you and live', () => {
    const s = deriveWeekStatus(counts({ commitsAhead: 3 }));
    expect(step(s, 'deploy').state).toBe('attention');
    expect(step(s, 'deploy').detail).toMatch(/3/);
  });

  it('marks deploy done when nothing is unpushed', () => {
    expect(step(deriveWeekStatus(counts({ commitsAhead: 0 })), 'deploy').state).toBe('done');
  });

  it('marks the email pending when it has not been sent', () => {
    expect(step(deriveWeekStatus(counts()), 'email').state).toBe('pending');
  });

  it('marks the email done once a send was recorded', () => {
    const s = deriveWeekStatus(counts({ emailSentAt: '2026-08-19T21:30:00.000Z' }));
    expect(step(s, 'email').state).toBe('done');
    expect(step(s, 'email').detail).toMatch(/2026/);
  });

  it('says the live build is current when it matches main', () => {
    // On Vercel there is no working tree, so the question becomes "is what is
    // deployed actually current", which the build SHA can answer.
    const s = deriveWeekStatus(counts({ commitsAhead: null, deployedBehindBy: 0, deployedSha: '812995f' }));
    expect(step(s, 'deploy').state).toBe('done');
    expect(step(s, 'deploy').detail).toMatch(/812995f/);
  });

  it('flags a live build that is behind main', () => {
    const s = deriveWeekStatus(counts({ commitsAhead: null, deployedBehindBy: 4, deployedSha: 'abc1234' }));
    expect(step(s, 'deploy').state).toBe('attention');
    expect(step(s, 'deploy').detail).toMatch(/4/);
  });

  it('prefers local git state over the deployed comparison when both exist', () => {
    // On a laptop the unpushed count is the more actionable number.
    const s = deriveWeekStatus(counts({ commitsAhead: 2, deployedBehindBy: 0, deployedSha: 'abc1234' }));
    expect(step(s, 'deploy').state).toBe('attention');
    expect(step(s, 'deploy').detail).toMatch(/2 commits not pushed/);
  });

  it('marks deploy unknown only when neither source could answer', () => {
    expect(
      step(deriveWeekStatus(counts({ commitsAhead: null, deployedBehindBy: null })), 'deploy').state,
    ).toBe('unknown');
  });
});
