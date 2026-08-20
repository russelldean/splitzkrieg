import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { cachedQuery, seasonDataVersionTag } from './db';

// A query that fails with a non-timeout error so withRetry rethrows immediately
// (no backoff delay), simulating a DB failure after retries are exhausted.
const failing = () => Promise.reject(new Error('synthetic DB failure'));

describe('cachedQuery failure handling', () => {
  let prev: string | undefined;
  beforeAll(() => {
    prev = process.env.AZURE_SQL_SERVER;
    // Force the DB code path (otherwise cachedQuery short-circuits to fallback).
    process.env.AZURE_SQL_SERVER = 'test-host';
  });
  afterAll(() => {
    process.env.AZURE_SQL_SERVER = prev;
  });

  it('returns the fallback on failure by default (graceful degradation)', async () => {
    const r = await cachedQuery('unit-default-fail', failing, 'FALLBACK', {
      sql: 'unit-default-fail-sql',
      stable: true,
    });
    expect(r).toBe('FALLBACK');
  });

  it('rethrows on failure when throwOnError is set, so gating lookups 500 (retryable) instead of caching a 404', async () => {
    await expect(
      cachedQuery('unit-throw-fail', failing, 'FALLBACK', {
        sql: 'unit-throw-fail-sql',
        stable: true,
        throwOnError: true,
      }),
    ).rejects.toThrow('synthetic DB failure');
  });

  it('emits a structured [QUERY_FAIL] telemetry line on failure', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await cachedQuery('unit-telemetry-fail', failing, 'FALLBACK', {
      sql: 'unit-telemetry-sql',
      stable: true,
    });
    const logged = spy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('[QUERY_FAIL]');
    expect(logged).toContain('unit-telemetry-fail');
    spy.mockRestore();
  });
});

describe('seasonDataVersionTag', () => {
  // Shaped like .data-versions.json: three season-keyed channels plus `bowlers`,
  // which is keyed by bowlerID. Bowler 24 collides with season 24.
  const versions = {
    scores: { '24': 2, '36': 4 },
    schedule: { '24': 2, '36': 6 },
    bowlers: { '24': 6, '640': 3 },
    playoffScores: { '35': 30 },
  };

  it('ignores the bowler-keyed channel, so bumping bowler #24 cannot invalidate season 24', () => {
    const before = seasonDataVersionTag(24, versions);
    const after = seasonDataVersionTag(24, {
      ...versions,
      bowlers: { ...versions.bowlers, '24': 7 },
    });
    expect(after).toBe(before);
  });

  it('still tracks every season-keyed channel', () => {
    const bumped = seasonDataVersionTag(36, {
      ...versions,
      scores: { ...versions.scores, '36': 5 },
    });
    expect(bumped).not.toBe(seasonDataVersionTag(36, versions));
  });

  it('pins rather than drops the segment, so seasons with no colliding bowlerID keep their existing tag', () => {
    // The pre-fix expression for a season with no matching bowlerID: `?? 1`
    // already produced `bowlers1`, so those tags must be byte-identical or the
    // fix rehashes every season-scoped query on the site instead of just the
    // seasons that were already wrong.
    const legacy = Object.entries(versions)
      .map(([ch, v]) => `${ch}${(v as Record<string, number>)['36'] ?? 1}`)
      .join('-');
    expect(seasonDataVersionTag(36, versions)).toBe(legacy);
  });
});
