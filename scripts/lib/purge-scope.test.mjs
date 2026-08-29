import { describe, it, expect } from 'vitest';
import { findBroadPurges } from './purge-scope.mjs';

/**
 * Both cases below are real code that shipped and ran in production for
 * months. Nothing in the repo looked at the blast radius of a purge, so a call
 * that discarded all ~1179 prebuilt pages read the same as one that refreshed
 * a single route.
 */
describe('findBroadPurges', () => {
  it("flags the root purge that threw away the whole build", () => {
    // Verbatim from src/app/api/evillair/new-blog-badge/route.ts.
    const hits = findBroadPurges("  revalidatePath('/', 'layout');");
    expect(hits).toHaveLength(1);
    expect(hits[0].target).toBe("'/'");
  });

  it('flags a layout purge on any path, not just root', () => {
    expect(findBroadPurges("revalidatePath('/blog', 'layout');")).toHaveLength(1);
    expect(findBroadPurges('revalidatePath(`/season/${slug}`, "layout");')).toHaveLength(1);
  });

  it('allows page-scoped purges, which is what most callers want', () => {
    expect(findBroadPurges("revalidatePath('/');")).toHaveLength(0);
    expect(findBroadPurges("revalidatePath('/blog', 'page');")).toHaveLength(0);
    expect(findBroadPurges('revalidatePath(`/bowler/${slug}`);')).toHaveLength(0);
  });

  it('allows a layout purge that opts in explicitly', () => {
    const src = [
      '// purge-scope-ok: the nav itself changed, every page renders it',
      "revalidatePath('/', 'layout');",
    ].join('\n');
    expect(findBroadPurges(src)).toHaveLength(0);
  });

  it('accepts the opt-in a few lines above the call', () => {
    const src = [
      '// purge-scope-ok: deliberate',
      '//',
      '// more explanation here',
      "revalidatePath('/', 'layout');",
    ].join('\n');
    expect(findBroadPurges(src)).toHaveLength(0);
  });

  it('does not count a purge that only appears in a comment', () => {
    const src = "// this used to call revalidatePath('/', 'layout') and should not";
    expect(findBroadPurges(src)).toHaveLength(0);
  });

  it('reports the correct 1-indexed line number', () => {
    const src = ['a', 'b', "revalidatePath('/', 'layout');"].join('\n');
    expect(findBroadPurges(src)[0].line).toBe(3);
  });
});
