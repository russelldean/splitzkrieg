import { describe, it, expect } from 'vitest';
import { normalizeInlineTags } from './mdx-source';

describe('normalizeInlineTags', () => {
  it('capitalizes a bowler tag so MDX maps it to the component', () => {
    // MDX only treats CAPITALIZED names as components. Lowercase <bowler> is
    // parsed as a raw HTML element and renders as unlinked plain text.
    expect(normalizeInlineTags('<bowler>Geoffrey Berry</bowler>')).toBe(
      '<Bowler>Geoffrey Berry</Bowler>',
    );
  });

  it('capitalizes a team tag', () => {
    expect(normalizeInlineTags('<team>Lucky Strikes</team>')).toBe(
      '<Team>Lucky Strikes</Team>',
    );
  });

  it('handles several tags in one line', () => {
    expect(
      normalizeInlineTags('<team>Lucky Strikes</team> and <team>Thoughts and Spares</team>'),
    ).toBe('<Team>Lucky Strikes</Team> and <Team>Thoughts and Spares</Team>');
  });

  it('leaves already-capitalized tags alone', () => {
    expect(normalizeInlineTags('<Bowler>Alex Rubenstein</Bowler>')).toBe(
      '<Bowler>Alex Rubenstein</Bowler>',
    );
  });

  it('leaves ordinary markdown untouched', () => {
    const md = '- **Bold** and a [link](/week/fall-2026/3)\n\n> quoted';
    expect(normalizeInlineTags(md)).toBe(md);
  });

  it('does not touch a word that merely contains the tag name', () => {
    const md = 'The bowler bowled well, and the team won.';
    expect(normalizeInlineTags(md)).toBe(md);
  });

  it('handles mixed case in the source', () => {
    expect(normalizeInlineTags('<Bowler>A</bowler> <TEAM>B</TEAM>')).toBe(
      '<Bowler>A</Bowler> <Team>B</Team>',
    );
  });

  it('returns an empty string unchanged', () => {
    expect(normalizeInlineTags('')).toBe('');
  });
});
