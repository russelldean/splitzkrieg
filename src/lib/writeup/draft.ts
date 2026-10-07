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
  if (r.rank === 1) return `${tie}best series of the season so far`;
  return `${tie}${ordinal(r.rank)} best series of the season`;
}

export function clubPhrase(r: RankInfo, category: MilestoneCategory, threshold: number): string {
  return `${r.tied ? 'tied for ' : ''}#${r.rank} in the ${milestoneLabel(category, threshold)} club`;
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

export interface DraftBowlerOfWeek {
  bowlerName: string;
  teamName: string;
  handSeries: number;
  seasonRank: RankInfo;
}

export interface DraftTeamOfWeek {
  teamName: string;
  hcpSeries: number;
  seasonRank: RankInfo;
}

export interface DraftMilestone {
  bowlerName: string;
  category: MilestoneCategory;
  threshold: number;
  club: RankInfo;
  /** null for games milestones: everyone takes the same number of games. */
  fastest: RankInfo | null;
}

export interface DraftInput {
  bowlersOfWeek: DraftBowlerOfWeek[];
  teamOfWeek: DraftTeamOfWeek | null;
  personalBests: { highGames: number; highSeries: number };
  milestones: DraftMilestone[];
}

const num = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function withRank(text: string, rank: RankInfo): string {
  const phrase = seasonRankPhrase(rank);
  return phrase ? `${text} (${phrase})` : text;
}

/** The recap post body. Each section is a paragraph; empty sections are left out. */
export function buildWeekDraft(input: DraftInput): string {
  const blocks: string[] = [];

  const botw = input.bowlersOfWeek;
  if (botw.length > 0) {
    const heading = botw.length > 1 ? 'Bowlers of the Week' : 'Bowler of the Week';
    const names = botw.map((b) => `<bowler>${b.bowlerName}</bowler> (${b.teamName})`).join(' and ');
    blocks.push(withRank(`**${heading}**: ${names} - ${num(botw[0].handSeries)} handicap series`, botw[0].seasonRank));
  }

  const totw = input.teamOfWeek;
  if (totw) {
    blocks.push(withRank(`**Team of the Week**: <team>${totw.teamName}</team> - ${num(totw.hcpSeries)} handicap series`, totw.seasonRank));
  }

  const { highGames, highSeries } = input.personalBests;
  const pbParts = [
    highGames > 0 ? plural(highGames, 'all-time high game', 'all-time high games') : null,
    highSeries > 0 ? `${highSeries} all-time high series` : null,
  ].filter(Boolean);
  if (pbParts.length > 0) {
    blocks.push(`**Personal Bests**: ${pbParts.join(', ')}, see below`);
  }

  if (input.milestones.length > 0) {
    const lines = input.milestones.map((m) => {
      const facts = [clubPhrase(m.club, m.category, m.threshold)];
      if (m.fastest) facts.push(fastestPhrase(m.fastest));
      return `   - <bowler>${m.bowlerName}</bowler> - ${facts.join(', ')}`;
    });
    blocks.push(`**Career Milestones**\n\n${lines.join('\n')}`);
  }

  return blocks.length > 0 ? `${blocks.join('\n\n')}\n` : '';
}
