/**
 * Shared playoff-cutoff maths for leaderboards.
 *
 * Individual playoffs take the top 8 of a board, and anyone tied at the 8th
 * value rides along. Both /stats and the week page snapshot draw that line, so
 * the rule lives here once instead of being reimplemented on each page.
 *
 * Every function assumes entries are already sorted best-first (descending).
 */

/** The minimal shape the cutoff maths needs. */
export interface CutoffEntry {
  bowlerID: number;
  value: number;
}

/**
 * Index one past the last qualifying entry: `size`, extended through any
 * entries tied at the size-th value. Never exceeds the list length.
 */
export function cutoffIndex(values: number[], size: number): number {
  if (values.length <= size) return values.length;
  const cutoffValue = values[size - 1];
  let idx = size;
  while (idx < values.length && values[idx] === cutoffValue) idx++;
  return idx;
}

/** IDs of the top `size` entries plus anyone tied at the size-th value. */
export function playoffQualifiers<T extends CutoffEntry>(entries: T[], size = 8): Set<number> {
  const idx = cutoffIndex(entries.map(e => e.value), size);
  return new Set(entries.slice(0, idx).map(e => e.bowlerID));
}
