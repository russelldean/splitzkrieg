import { describe, it, expect } from 'vitest';
import { findEmDashes, shouldScanFile } from './em-dash.mjs';

/**
 * These exist because the em dash guard silently passed while the rule it
 * guards was being violated. pre-push-check scanned for the em dash CHARACTER
 * only, so metadata written with a — escape rendered em dashes in live
 * page titles and meta descriptions while the check reported green.
 *
 * The first test below is that exact regression. A guard nobody has watched
 * fail is not a guard.
 */
describe('findEmDashes', () => {
  it('catches the escape form that shipped to production', () => {
    // Verbatim shape of src/app/season/[slug]/page.tsx before the fix.
    const src = 'const title = `Season ${n} \\u2014 ${p} ${y} | Splitzkrieg`;';
    const hits = findEmDashes(src);
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe('escape');
    expect(hits[0].severity).toBe('error');
  });

  it('catches a literal em dash character in prose', () => {
    const hits = findEmDashes('const t = `Season X — Fall 2026`;');
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe('char');
    expect(hits[0].severity).toBe('error');
  });

  it('catches html entity spellings', () => {
    expect(findEmDashes('<p>a &mdash; b</p>')[0].severity).toBe('error');
    expect(findEmDashes('<p>a &#8212; b</p>')[0].severity).toBe('error');
    expect(findEmDashes('<p>a &#x2014; b</p>')[0].severity).toBe('error');
  });

  it('demotes a standalone placeholder literal to a warning', () => {
    // The bowler/team/season tables use this as the missing-value placeholder.
    // Treating it as an error would block every push.
    const escaped = findEmDashes("{row.highGame ?? '\\u2014'}");
    expect(escaped).toHaveLength(1);
    expect(escaped[0].severity).toBe('warn');

    const literal = findEmDashes("{row.highGame ?? '—'}");
    expect(literal[0].severity).toBe('warn');
  });

  it('skips comment lines, which do not render on the site', () => {
    expect(findEmDashes('// a note — for developers')).toHaveLength(0);
    expect(findEmDashes(' * a note — for developers')).toHaveLength(0);
    expect(findEmDashes('{/* a note — for developers */}')).toHaveLength(0);
  });

  it('still flags an em dash that appears before an inline comment', () => {
    const hits = findEmDashes('const t = `A — B`; // trailing note');
    expect(hits).toHaveLength(1);
    expect(hits[0].severity).toBe('error');
  });

  it('reports the correct 1-indexed line number', () => {
    const hits = findEmDashes(['clean', 'clean', 'const t = `A — B`;'].join('\n'));
    expect(hits[0].line).toBe(3);
  });

  it('passes clean source', () => {
    expect(findEmDashes('const title = `Week 4 - Season XXXVI`;')).toHaveLength(0);
  });
});

describe('shouldScanFile', () => {
  it('scans files that can render on the site', () => {
    expect(shouldScanFile('Header.tsx')).toBe(true);
    expect(shouldScanFile('page.ts')).toBe(true);
    expect(shouldScanFile('globals.css')).toBe(true);
  });

  it('skips test files, which do not ship', () => {
    // src/lib/recap-naming.test.ts matches /\u2014/ on purpose, to assert a
    // recap title contains no em dash. Scanning it flagged the assertion
    // itself and failed the check.
    expect(shouldScanFile('recap-naming.test.ts')).toBe(false);
    expect(shouldScanFile('em-dash.test.mjs')).toBe(false);
    expect(shouldScanFile('thing.spec.tsx')).toBe(false);
  });

  it('skips file types that never render', () => {
    expect(shouldScanFile('README.md')).toBe(false);
    expect(shouldScanFile('data.json')).toBe(false);
  });
});
