import { describe, it, expect } from 'vitest';
import { derivePreNightStatus, type PreNightCounts } from './pre-night-status';

const counts = (over: Partial<PreNightCounts> = {}): PreNightCounts => ({
  lineupsIn: 12,
  teamsScheduled: 20,
  captainsWithoutEmail: 0,
  remindSentAt: null,
  lastCallSentAt: null,
  lpPushedAt: null,
  scoresheetsAt: null,
  matchDate: '2026-08-24',
  nowET: '2026-08-21',
  automationEnabled: true,
  ...over,
});

const row = (c: PreNightCounts, key: string) => {
  const found = derivePreNightStatus(c).find((s) => s.key === key);
  if (!found) throw new Error(`no row ${key}`);
  return found;
};

describe('lineups row', () => {
  it('is done when every scheduled team has submitted', () => {
    expect(row(counts({ lineupsIn: 20 }), 'lineups').state).toBe('done');
  });

  it('is pending when some are missing and the match is days away', () => {
    expect(row(counts(), 'lineups').state).toBe('pending');
  });

  it('escalates to attention on match day', () => {
    expect(row(counts({ nowET: '2026-08-24' }), 'lineups').state).toBe('attention');
  });

  it('reports the count', () => {
    expect(row(counts(), 'lineups').detail).toContain('12/20');
  });

  it('mentions captains with no email address', () => {
    expect(row(counts({ captainsWithoutEmail: 2 }), 'lineups').detail).toContain('2');
  });
});

describe('reminder row', () => {
  it('is done once a send is recorded', () => {
    expect(row(counts({ remindSentAt: '2026-08-21T14:00:00.000Z' }), 'reminder').state).toBe('done');
  });

  it('says so when automation is off rather than looking merely pending', () => {
    const r = row(counts({ automationEnabled: false }), 'reminder');
    expect(r.state).toBe('attention');
    expect(r.detail).toMatch(/off/i);
  });

  it('is optional once every lineup is in', () => {
    expect(row(counts({ lineupsIn: 20 }), 'reminder').state).toBe('optional');
  });
});

describe('last call row', () => {
  it('is pending before match day', () => {
    expect(row(counts(), 'lastcall').state).toBe('pending');
  });

  it('needs attention on match day with lineups still missing', () => {
    expect(row(counts({ nowET: '2026-08-24' }), 'lastcall').state).toBe('attention');
  });

  it('is done once recorded', () => {
    const c = counts({ nowET: '2026-08-24', lastCallSentAt: '2026-08-24T14:00:00.000Z' });
    expect(row(c, 'lastcall').state).toBe('done');
  });

  it('is optional when nothing is missing', () => {
    expect(row(counts({ nowET: '2026-08-24', lineupsIn: 20 }), 'lastcall').state).toBe('optional');
  });
});

describe('lp push and scoresheets rows', () => {
  it('are pending when not recorded and the match is days away', () => {
    expect(row(counts(), 'lppush').state).toBe('pending');
    expect(row(counts(), 'scoresheets').state).toBe('pending');
  });

  it('need attention on match day when still not recorded', () => {
    const c = counts({ nowET: '2026-08-24' });
    expect(row(c, 'lppush').state).toBe('attention');
    expect(row(c, 'scoresheets').state).toBe('attention');
  });

  it('are done once recorded', () => {
    const c = counts({ lpPushedAt: '2026-08-23T18:00:00.000Z', scoresheetsAt: '2026-08-24T19:00:00.000Z' });
    expect(row(c, 'lppush').state).toBe('done');
    expect(row(c, 'scoresheets').state).toBe('done');
  });
});

describe('no scheduled match', () => {
  it('reports every row as unknown rather than inventing urgency', () => {
    const rows = derivePreNightStatus(counts({ matchDate: null }));
    expect(rows.every((r) => r.state === 'unknown')).toBe(true);
  });
});

describe('match already in the past', () => {
  const past = (over: Partial<PreNightCounts> = {}) => counts({ nowET: '2026-08-27', ...over });

  it('flags missing lineups as attention and says the match has passed', () => {
    const r = row(past(), 'lineups');
    expect(r.state).toBe('attention');
    expect(r.detail).toMatch(/match was 3 day\(s\) ago/);
  });

  it('flags a never-sent reminder as attention, not pending', () => {
    expect(row(past(), 'reminder').state).toBe('attention');
  });

  it('flags a never-sent last call as attention, and drops the "not yet needed" copy', () => {
    const r = row(past(), 'lastcall');
    expect(r.state).toBe('attention');
    expect(r.detail).not.toContain('not yet needed');
  });

  it('flags an unrecorded LP push and scoresheets as attention', () => {
    expect(row(past(), 'lppush').state).toBe('attention');
    expect(row(past(), 'scoresheets').state).toBe('attention');
  });

  it('stays calm for a finished week that was fully handled', () => {
    const c = past({
      lineupsIn: 20,
      remindSentAt: '2026-08-21T14:00:00.000Z',
      lastCallSentAt: '2026-08-24T14:00:00.000Z',
      lpPushedAt: '2026-08-23T18:00:00.000Z',
      scoresheetsAt: '2026-08-24T19:00:00.000Z',
    });
    const rows = derivePreNightStatus(c);
    expect(rows.some((r) => r.state === 'attention')).toBe(false);
  });
});
