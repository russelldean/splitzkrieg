import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { cachedQuery } from './db';

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
