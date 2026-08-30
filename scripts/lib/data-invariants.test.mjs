import { describe, it, expect } from 'vitest';
import { INVARIANTS, evaluate, evaluateAll } from './data-invariants.mjs';

describe('INVARIANTS', () => {
  it('every invariant has a name, a reason and a query', () => {
    for (const inv of INVARIANTS) {
      expect(inv.name, JSON.stringify(inv)).toBeTruthy();
      expect(inv.why, inv.name).toBeTruthy();
      expect(inv.sql, inv.name).toContain('SELECT COUNT(*) n');
    }
  });

  it('has unique names, so a failure points at exactly one check', () => {
    const names = INVARIANTS.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('evaluate', () => {
  const zeroRule = { name: 'duplicate-bowler-slug', why: 'because', sql: 'SELECT COUNT(*) n' };

  it('passes when a zero-expecting invariant sees zero', () => {
    expect(evaluate(zeroRule, 0)).toBeNull();
  });

  it('fails, and says how many, when rows turn up', () => {
    const f = evaluate(zeroRule, 3);
    expect(f).not.toBeNull();
    expect(f.actual).toBe(3);
    expect(f.expected).toBe(0);
    expect(f.message).toContain('3 row(s)');
    // The reason travels with the finding: a bare count in CI tells you
    // nothing about why it matters at 2am.
    expect(f.message).toContain('because');
  });

  it('handles an invariant expecting exactly one', () => {
    const one = { name: 'exactly-one-current-season', why: 'w', sql: 'SELECT COUNT(*) n', expect: 1 };
    expect(evaluate(one, 1)).toBeNull();
    // Both directions are bugs: no current season breaks the homepage just as
    // surely as two do.
    expect(evaluate(one, 0).message).toContain('expected 1, found 0');
    expect(evaluate(one, 2).message).toContain('expected 1, found 2');
  });
});

describe('evaluateAll', () => {
  const a = { name: 'a', why: 'w', sql: 'SELECT COUNT(*) n' };
  const b = { name: 'b', why: 'w', sql: 'SELECT COUNT(*) n' };

  it('is empty when everything holds', () => {
    expect(evaluateAll([{ invariant: a, count: 0 }, { invariant: b, count: 0 }])).toEqual([]);
  });

  it('returns only the invariants that failed', () => {
    const f = evaluateAll([{ invariant: a, count: 0 }, { invariant: b, count: 5 }]);
    expect(f).toHaveLength(1);
    expect(f[0].name).toBe('b');
  });
});
