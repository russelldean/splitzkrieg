import { describe, it, expect, vi } from 'vitest';

// Mock next/cache so unstable_cache just invokes the fn (no real Data Cache in unit tests).
const cacheCalls: { keyParts: string[]; options: unknown }[] = [];
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => unknown, keyParts: string[], options: unknown) => {
    cacheCalls.push({ keyParts, options });
    return fn;
  },
}));

import { taggedQuery } from './db';

describe('taggedQuery', () => {
  it('returns the query result and forwards key + tags', async () => {
    const result = await taggedQuery('snapshot-36', async () => ({ ok: true }), { ok: false }, {
      tags: ['scores-36'],
      revalidate: 120,
    });
    expect(result).toEqual({ ok: true });
    const call = cacheCalls.at(-1)!;
    expect(call.keyParts).toEqual(['snapshot-36']);
    expect((call.options as { tags: string[] }).tags).toEqual(['scores-36']);
  });

  it('returns the fallback when the query throws', async () => {
    const result = await taggedQuery('snapshot-36', async () => { throw new Error('db down'); }, { ok: false }, {
      tags: ['scores-36'],
    });
    expect(result).toEqual({ ok: false });
  });
});
