import { describe, it, expect } from 'vitest';
import { referencedTags, unknownTags } from './mdx-validate';

const KNOWN = ['Bowler', 'Team', 'Callout'];

describe('referencedTags', () => {
  it('finds capitalized tags, opening and closing alike', () => {
    expect(referencedTags('Hi <Bowler>Amy</Bowler> and <Standings />').sort()).toEqual([
      'Bowler',
      'Standings',
    ]);
  });

  it('ignores lowercase HTML, which MDX never resolves as a component', () => {
    expect(referencedTags('a <br /> b <div>c</div>')).toEqual([]);
  });

  it('ignores tags inside fenced and inline code, which are examples not components', () => {
    const src = 'Use it like:\n\n```\n<Standings />\n```\n\nor inline `<Leaderboard />`.';
    expect(referencedTags(src)).toEqual([]);
  });
});

describe('unknownTags', () => {
  it('returns only the names nothing has registered', () => {
    expect(unknownTags('<Bowler>Amy</Bowler> <Standings />', KNOWN)).toEqual(['Standings']);
  });

  it('is empty for a body that only uses registered components', () => {
    expect(unknownTags('<Bowler>Amy</Bowler> <Callout headline="x" />', KNOWN)).toEqual([]);
  });

  it('catches the typo case, which is the one that fails at render not compile', () => {
    expect(unknownTags('<Bolwer>Amy</Bolwer>', KNOWN)).toEqual(['Bolwer']);
  });

  it('reports each unknown name once however many times it appears', () => {
    expect(unknownTags('<X /> <X /> <X>y</X>', KNOWN)).toEqual(['X']);
  });
});
