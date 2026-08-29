import { describe, it, expect } from 'vitest';
import { checkPage, checkCacheHealth, cacheState, extractTitle } from './smoke-assertions.mjs';

const ok = (over = {}) => ({
  url: '/week/fall-2026/4',
  status: 200,
  headers: { 'x-vercel-cache': 'HIT' },
  html: '<html><head><title>Week 4 - Season XXXVI | Splitzkrieg</title></head></html>',
  durationMs: 200,
  ...over,
});

describe('extractTitle', () => {
  it('pulls the title out of real markup', () => {
    expect(extractTitle('<head><title>A | B</title></head>')).toBe('A | B');
  });
  it('returns null when there is none', () => {
    expect(extractTitle('<head></head>')).toBeNull();
  });
});

describe('checkPage', () => {
  it('passes a healthy page', () => {
    expect(checkPage(ok())).toHaveLength(0);
  });

  it('catches the doubled site name that shipped for months', () => {
    // The exact string production served before the metadata fix.
    const f = checkPage(ok({
      html: '<title>Week 4 - Season XXXVI | Splitzkrieg | Splitzkrieg</title>',
    }));
    expect(f.map((x) => x.code)).toContain('DOUBLED_TITLE');
  });

  it('catches an em dash in a rendered title', () => {
    const f = checkPage(ok({
      html: '<title>Season XXXVI — Fall 2026 | Splitzkrieg</title>',
    }));
    expect(f.map((x) => x.code)).toContain('EM_DASH_TITLE');
  });

  it('reports a non-200 and stops there', () => {
    const f = checkPage(ok({ status: 500 }));
    expect(f).toHaveLength(1);
    expect(f[0].code).toBe('STATUS');
  });

  it('flags a missing title', () => {
    const f = checkPage(ok({ html: '<html><head></head></html>' }));
    expect(f.map((x) => x.code)).toContain('NO_TITLE');
  });

  it('warns then fails as latency grows', () => {
    expect(checkPage(ok({ durationMs: 3000 })).map((x) => x.level)).toContain('warn');
    // A cold render against Azure SQL, which is what the 15s click was.
    expect(checkPage(ok({ durationMs: 15000 })).map((x) => x.level)).toContain('error');
  });
});

describe('cacheState', () => {
  it('treats HIT and STALE as warm', () => {
    expect(cacheState({ headers: { 'x-vercel-cache': 'HIT' } })).toBe('warm');
    expect(cacheState({ headers: { 'x-vercel-cache': 'STALE' } })).toBe('warm');
  });

  it('treats PRERENDER as warm, not as a regeneration', () => {
    // Served straight from the deployment's static output: the healthiest
    // state there is. The first version of this check called it a
    // regeneration, so a perfectly healthy site right after a deploy, when
    // every page reports PRERENDER, looked like a total cache wipe.
    expect(cacheState({ headers: { 'x-vercel-cache': 'PRERENDER' } })).toBe('warm');
  });
  it('treats MISS and REVALIDATED as regenerated', () => {
    expect(cacheState({ headers: { 'x-vercel-cache': 'MISS' } })).toBe('regenerated');
    expect(cacheState({ headers: { 'x-vercel-cache': 'REVALIDATED' } })).toBe('regenerated');
  });
  it('reads the header case-insensitively', () => {
    expect(cacheState({ headers: { 'X-Vercel-Cache': 'hit' } })).toBe('warm');
  });
});

describe('checkCacheHealth', () => {
  const sample = (state, i) => ({ url: `/p${i}`, headers: { 'x-vercel-cache': state } });

  it('is quiet when the build is intact', () => {
    const all = ['HIT', 'HIT', 'HIT', 'STALE'].map(sample);
    expect(checkCacheHealth(all)).toHaveLength(0);
  });

  it('detects the site-wide purge, which is the whole point', () => {
    // What the site looked like after promoting a blog post: everything
    // prebuilt, everything invalidated, each page re-rendering on first visit.
    const all = ['MISS', 'MISS', 'REVALIDATED', 'HIT'].map(sample);
    const f = checkCacheHealth(all);
    expect(f.map((x) => x.code)).toContain('PURGED');
    expect(f.find((x) => x.code === 'PURGED').level).toBe('error');
  });

  it('only warns when a single page was regenerated', () => {
    const all = ['HIT', 'HIT', 'HIT', 'MISS'].map(sample);
    const f = checkCacheHealth(all);
    expect(f.map((x) => x.code)).toContain('SOME_REGENERATED');
    expect(f.every((x) => x.level === 'warn')).toBe(true);
  });

  it('errors on a prebuilt route that bypassed the cache', () => {
    // What draft mode did: every route opted out of static rendering.
    const f = checkCacheHealth([sample('BYPASS', 1)]);
    expect(f.map((x) => x.code)).toContain('CACHE_BYPASS');
  });

  it('handles an empty sample without throwing', () => {
    expect(checkCacheHealth([])).toHaveLength(0);
  });
});
