import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SafeMDX } from './SafeMDX';

/**
 * These cover the whole point of SafeMDX: a bad post body must not throw,
 * because a throw here happens during prerender and fails the deploy for the
 * week page, not just one blog post.
 *
 * Both bad-body cases below were verified to throw when rendered through
 * MDXRemote directly, which is what these call sites used to do.
 */
async function render(source: string) {
  return renderToStaticMarkup(await SafeMDX({ source, label: 'unit' }));
}

describe('SafeMDX', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('renders a good body normally', async () => {
    const html = await render('Hello <Bowler>Amy Kostrewa</Bowler> bowled well.');
    expect(html).toContain('Amy Kostrewa');
    expect(html).toContain('/bowler/amy-kostrewa');
    expect(html).not.toContain('unrendered tag');
  });

  it('survives an unknown component, which throws at RENDER so a try/catch cannot help', async () => {
    const html = await render('Before <Standings /> after.');
    expect(html).toContain('unrendered tag');
    expect(html).toContain('Standings');
    // The surrounding prose still renders: only the bad tag is neutralized.
    expect(html).toContain('Before');
    expect(html).toContain('after.');
  });

  it('keeps children of an unknown wrapping tag rather than dropping the prose', async () => {
    const html = await render('<Bolwer>Amy Kostrewa</Bolwer>');
    expect(html).toContain('Amy Kostrewa');
  });

  it('survives a syntax error, which throws at COMPILE', async () => {
    const html = await render('Line</br>next');
    expect(html).toContain('could not be displayed');
  });

  it('survives an unclosed custom tag, the 2026-07-22 bug', async () => {
    const html = await render('<Bowler>Denis McPhillips<Bowler>');
    expect(html).toContain('could not be displayed');
  });

  it('still applies the lowercase tag normalisation', async () => {
    const html = await render('Hi <bowler>Amy Kostrewa</bowler>.');
    expect(html).toContain('/bowler/amy-kostrewa');
  });

  it('logs a greppable line for each failure class', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await render('<Standings />');
    await render('Line</br>next');
    const logged = spy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('[MDX_UNKNOWN_TAG]');
    expect(logged).toContain('[MDX_FAIL]');
  });
});
