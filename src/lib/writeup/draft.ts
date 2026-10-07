/**
 * The weekly recap draft: data in, markdown out. No DB access here, so every
 * wording rule is unit tested. See
 * docs/superpowers/specs/2026-10-07-weekly-writeup-draft-design.md.
 */

import type { MilestoneCategory } from '@/lib/milestone-config';

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

const SEASON_RANK_CUTOFF = 10;

/** Season rank clause for a series, or null when it is not worth mentioning. */
export function seasonRankPhrase(r: RankInfo): string | null {
  if (r.rank > SEASON_RANK_CUTOFF) return null;
  const tie = r.tied ? 'tied for ' : '';
  if (r.rank === 1) return `${tie}best of the season so far`;
  return `${tie}${ordinal(r.rank)} best of the season`;
}

export function clubPhrase(r: RankInfo): string {
  return `${r.tied ? 'tied for ' : ''}#${r.rank} in the club`;
}

export function fastestPhrase(r: RankInfo): string {
  const tie = r.tied ? 'tied for ' : '';
  if (r.rank === 1) return `${tie}fastest ever`;
  return `${tie}${ordinal(r.rank)} fastest`;
}

// Russ's own wording from past recaps ("25 200 games", "100 Career turkeys").
const MILESTONE_NOUN: Record<MilestoneCategory, string> = {
  totalGames: 'career games',
  totalPins: 'career pins',
  totalTurkeys: 'career turkeys',
  games200Plus: '200 games',
  series600Plus: '600 series',
};

export function milestoneLabel(category: MilestoneCategory, threshold: number): string {
  return `${threshold.toLocaleString('en-US')} ${MILESTONE_NOUN[category]}`;
}
