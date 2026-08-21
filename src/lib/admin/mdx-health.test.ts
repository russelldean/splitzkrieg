import { describe, it, expect } from 'vitest';
import { checkBody } from './mdx-health';

/**
 * checkBody sits behind three surfaces (editor live check, blog list badges,
 * dashboard warning), so these pin the three states they all branch on.
 */
describe('checkBody', () => {
  it('passes a body that only uses registered components', async () => {
    const r = await checkBody('Hi <Bowler>Amy Kostrewa</Bowler>.');
    expect(r).toEqual({ ok: true, error: null, unknownTags: [] });
  });

  it('reports an unknown tag as ok-but-degraded, not as a failure', async () => {
    const r = await checkBody('Before <Standings /> after.');
    // ok stays true: it compiles and renders, just with a marker chip. Only
    // this distinction keeps the editor from blocking Publish on a typo.
    expect(r.ok).toBe(true);
    expect(r.error).toBeNull();
    expect(r.unknownTags).toEqual(['Standings']);
  });

  it('reports a syntax error as a failure with a readable message', async () => {
    const r = await checkBody('Line</br>next');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('closing slash');
    expect(r.error).not.toContain('[next-mdx-remote]');
  });

  it('accepts the lowercase tags Russ actually writes', async () => {
    const r = await checkBody('Hi <bowler>Amy Kostrewa</bowler>.');
    expect(r.ok).toBe(true);
    expect(r.unknownTags).toEqual([]);
  });

  it('treats an empty body as fine', async () => {
    expect(await checkBody('')).toEqual({ ok: true, error: null, unknownTags: [] });
  });
});
