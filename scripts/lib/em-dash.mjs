/**
 * Em dash detection for pre-push-check.
 *
 * Extracted so it can be tested. The original version lived inline in
 * pre-push-check.mjs and scanned only for the em dash CHARACTER, which meant
 * source written as a — escape sailed past it. Four of those sat in the
 * season and bowler page metadata, rendering in live page titles and meta
 * descriptions, while the check reported green for months.
 *
 * Two severities, because not every em dash in the tree is the same thing:
 *
 *   error  - an em dash inside prose: a title, a description, a sentence.
 *            This is what the no-em-dash rule is actually about.
 *   warn   - a standalone '—' string literal, which the bowler, team and
 *            season tables use as the placeholder for a missing value. That is
 *            a deliberate UI convention, so flagging it as an error would just
 *            block every push. Surfaced, not enforced.
 *
 * Comment lines are skipped, matching the original behaviour: the rule is
 * about what renders on the site, not what a developer reads.
 */

const CHAR = '—';

/** Each entry: how the em dash is spelled in source. */
const PATTERNS = [
  { kind: 'char', find: CHAR },
  { kind: 'entity', find: '&mdash;' },
  { kind: 'entity', find: '&#8212;' },
  { kind: 'entity', find: '&#x2014;' },
  { kind: 'escape', find: '\\u2014' },
];

/**
 * True when the em dash is the entire contents of a string literal, e.g.
 * '—' or "—" or {'—'}. That is the missing-value placeholder,
 * not prose.
 */
function isStandalonePlaceholder(line, find) {
  const quoted = ["'", '"', '`'].map((q) => q + find + q);
  return quoted.some((lit) => line.includes(lit));
}

function isCommentLine(line, find) {
  const trimmed = line.trim();
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('{/*')
  ) {
    return true;
  }
  // Inline comment: the em dash appears only after the //
  const commentIdx = line.indexOf('//');
  const dashIdx = line.indexOf(find);
  return commentIdx !== -1 && dashIdx > commentIdx;
}

/**
 * Scan one file's contents.
 * Returns [{ line, kind, severity, snippet }], line numbers 1-indexed.
 */
export function findEmDashes(content, { skipComments = true } = {}) {
  const hits = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { kind, find } of PATTERNS) {
      if (!line.includes(find)) continue;
      if (skipComments && isCommentLine(line, find)) continue;

      const placeholder = isStandalonePlaceholder(line, find);
      hits.push({
        line: i + 1,
        kind,
        severity: placeholder ? 'warn' : 'error',
        snippet: line.trim().slice(0, 120),
      });
    }
  }

  return hits;
}

/**
 * Which files the rule applies to.
 *
 * Only files that can render on the site. Test files are excluded because they
 * do not ship, and because asserting ABOUT em dashes legitimately requires
 * writing one: src/lib/recap-naming.test.ts matches /\\u2014/ precisely to prove
 * a recap title contains none.
 */
const SCANNED_EXTENSIONS = ['.ts', '.tsx', '.css', '.js', '.jsx'];

export function shouldScanFile(filename) {
  if (!SCANNED_EXTENSIONS.some((ext) => filename.endsWith(ext))) return false;
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(filename)) return false;
  return true;
}

export const EM_DASH_CHAR = CHAR;
