/**
 * The weekly recap draft: data in, markdown out. No DB access here, so every
 * wording rule is unit tested. See
 * docs/superpowers/specs/2026-10-07-weekly-writeup-draft-design.md.
 */

export interface RankInfo {
  rank: number;
  tied: boolean;
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/**
 * Standard competition rank of `value` within `all` (which should include the
 * value itself). 'desc' = higher is better, 'asc' = lower is better.
 */
export function rankAmong(value: number, all: number[], direction: 'desc' | 'asc' = 'desc'): RankInfo {
  const better = all.filter((v) => (direction === 'desc' ? v > value : v < value)).length;
  const equal = all.filter((v) => v === value).length;
  return { rank: better + 1, tied: equal > 1 };
}
