/**
 * Blast-radius check for on-demand cache purges.
 *
 * check-cache-invariants understands cachedQuery options in detail, but it had
 * no concept of how wide a revalidatePath call reaches. That gap hid two
 * site-wide purges for a long time:
 *
 *   - saving Instagram pins purged every route to update three photos on the
 *     homepage
 *   - promoting a blog post purged every route because the "New" pill renders
 *     in the header
 *
 * revalidatePath(path, 'layout') invalidates that layout AND every route
 * nested under it. At the root that is the entire site. With BUILD_ALL=1 this
 * site prebuilds ~1179 pages, so one such call discards the whole build, and
 * each page then re-renders live against Azure SQL Basic on its next visit.
 * The usual sequence made it worse: deploy, then promote the post, so the
 * purge landed minutes after the build that produced those pages.
 *
 * A layout-scoped purge is occasionally the right call. It just should never
 * be reached for casually, so it needs an explicit opt-in comment saying why.
 */

const LAYOUT_PURGE_RE = /revalidatePath\(\s*([^,()]+?)\s*,\s*['"`]layout['"`]\s*\)/g;

/** Opt-in marker, on the call line or any of the 3 lines above it. */
const OPT_IN = 'purge-scope-ok';
const OPT_IN_LOOKBACK = 3;

function hasOptIn(lines, idx) {
  const from = Math.max(0, idx - OPT_IN_LOOKBACK);
  return lines.slice(from, idx + 1).some((l) => l.includes(OPT_IN));
}

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

/**
 * Find layout-scoped purges lacking an opt-in.
 * Returns [{ line, target, snippet }], line numbers 1-indexed.
 */
export function findBroadPurges(content) {
  const hits = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line)) continue;

    LAYOUT_PURGE_RE.lastIndex = 0;
    let m;
    while ((m = LAYOUT_PURGE_RE.exec(line)) !== null) {
      if (hasOptIn(lines, i)) continue;
      hits.push({
        line: i + 1,
        target: m[1].trim(),
        snippet: line.trim().slice(0, 120),
      });
    }
  }

  return hits;
}

export const OPT_IN_MARKER = OPT_IN;
