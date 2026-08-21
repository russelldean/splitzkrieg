import { describe, it, expect } from 'vitest';
import { compileMDX } from 'next-mdx-remote/rsc';
import { readableMdxError } from './mdx-validate';

async function messageFor(src: string): Promise<string> {
  try {
    await compileMDX({ source: src, components: {} });
    return '';
  } catch (e) {
    return readableMdxError(e);
  }
}

describe('readableMdxError on the real historical bugs', () => {
  it('the 2026-04-07 </br> bug explains the problem in plain words', async () => {
    const msg = await messageFor('Some prose\n\nLine one</br>Line two');
    // "Unexpected closing slash `/` in tag, expected an open tag first".
    // MDX gives no position for this one, which is fine here: the check runs
    // 700ms after each keystroke, so the author is looking at the line already.
    expect(msg).toContain('closing slash');
    expect(msg).not.toContain('[next-mdx-remote]');
    expect(msg).not.toContain('error compiling MDX');
    expect(msg).not.toMatch(/\bat \S+:\d+/);
  });

  it('the 2026-07-22 unclosed <bowler> bug names the tag and its position', async () => {
    const msg = await messageFor('<Bowler>Denis McPhillips<Bowler>');
    expect(msg).toContain('Bowler');
    expect(msg).toContain('closing tag');
    expect(msg).toMatch(/\d+:\d+/);
    expect(msg).not.toContain('[next-mdx-remote]');
  });

  it('is bounded so a huge message cannot flood the editor', () => {
    expect(readableMdxError(new Error('x'.repeat(5000))).length).toBeLessThanOrEqual(400);
  });

  it('handles a non-Error throw without crashing', () => {
    expect(readableMdxError('plain string')).toBe('plain string');
  });
});
