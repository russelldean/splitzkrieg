/**
 * Pure data computation for WeekStats.
 * Extracts all statistical calculations from the component.
 */
import type { WeeklyMatchScore, WeeklyMatchupResult } from '@/lib/queries';
import { topWithTies, type TopResult } from './WeekStatsCards';

// ── XP Rankings ──────────────────────────────────────────────

interface RankedTeam {
  id: number;
  teamName: string;
  teamSlug: string;
  hcpSeries: number;
  scratchSeries: number;
}

export interface XPTier {
  label: string;
  teams: RankedTeam[];
}

export function computeXPRankings(weekScores: WeeklyMatchScore[]): {
  rankedTeams: RankedTeam[];
  xpTiers: XPTier[];
} {
  const teamTotals = new Map<number, { teamName: string; teamSlug: string; hcpSeries: number; scratchSeries: number }>();
  for (const s of weekScores) {
    const cur = teamTotals.get(s.teamID) ?? { teamName: s.teamName, teamSlug: s.teamSlug, hcpSeries: 0, scratchSeries: 0 };
    cur.hcpSeries += s.handSeries ?? 0;
    cur.scratchSeries += s.scratchSeries ?? 0;
    teamTotals.set(s.teamID, cur);
  }
  const rankedTeams = Array.from(teamTotals.entries())
    .map(([id, t]) => ({ id, ...t }))
    .sort((a, b) => b.hcpSeries - a.hcpSeries);

  const xpTiers: XPTier[] = [
    { label: 'Three Points', teams: rankedTeams.slice(0, 5) },
    { label: 'Two Points', teams: rankedTeams.slice(5, 10) },
    { label: 'One Point', teams: rankedTeams.slice(10, 15) },
    { label: 'Better Luck Next Time', teams: rankedTeams.slice(15, 20) },
  ].filter(tier => tier.teams.length > 0);

  return { rankedTeams, xpTiers };
}

// ── Individual Leaders ──────────────────────────────────────

export function computeIndividualLeaders(weekScores: WeeklyMatchScore[], compact: boolean) {
  const bowlers = weekScores.filter(s => s.scratchSeries != null && !s.isPenalty);
  const leaderN = compact ? 1 : 5;

  // High Handicap Series
  const sortedHcpSeries = [...bowlers].sort((a, b) => (b.handSeries ?? 0) - (a.handSeries ?? 0));
  const topHcpSeries = topWithTies(sortedHcpSeries, leaderN, b => b.handSeries ?? 0);

  // High Scratch Game
  const allGames: { bowlerName: string; bowlerSlug: string; teamName: string; score: number }[] = [];
  for (const b of bowlers) {
    if (b.game1 != null) allGames.push({ bowlerName: b.bowlerName, bowlerSlug: b.bowlerSlug, teamName: b.teamName, score: b.game1 });
    if (b.game2 != null) allGames.push({ bowlerName: b.bowlerName, bowlerSlug: b.bowlerSlug, teamName: b.teamName, score: b.game2 });
    if (b.game3 != null) allGames.push({ bowlerName: b.bowlerName, bowlerSlug: b.bowlerSlug, teamName: b.teamName, score: b.game3 });
  }
  allGames.sort((a, b) => b.score - a.score);
  const topScratchGame = topWithTies(allGames, leaderN, g => g.score);

  // High Men's/Women's Scratch Series
  const sortedMenScratch = [...bowlers].filter(b => b.gender === 'M').sort((a, b) => (b.scratchSeries ?? 0) - (a.scratchSeries ?? 0));
  const topMenScratch = topWithTies(sortedMenScratch, leaderN, b => b.scratchSeries ?? 0);

  const sortedWomenScratch = [...bowlers].filter(b => b.gender === 'F').sort((a, b) => (b.scratchSeries ?? 0) - (a.scratchSeries ?? 0));
  const topWomenScratch = topWithTies(sortedWomenScratch, leaderN, b => b.scratchSeries ?? 0);

  return { bowlers, topHcpSeries, topScratchGame, topMenScratch, topWomenScratch };
}

// ── Weekly Awards ──────────────────────────────────────────

export function computeWeeklyAwards(weekScores: WeeklyMatchScore[], bowlers: WeeklyMatchScore[]) {
  // Turkeys
  const turkeyList = bowlers.filter(b => b.turkeys > 0).sort((a, b) => b.turkeys - a.turkeys);

  // Above Average Every Game
  const aboveAvgEveryGame = bowlers.filter(b => {
    if (b.incomingAvg == null || b.incomingAvg === 0) return false;
    return (
      b.game1 != null && b.game1 > b.incomingAvg &&
      b.game2 != null && b.game2 > b.incomingAvg &&
      b.game3 != null && b.game3 > b.incomingAvg
    );
  });

  // Debuts
  const debuts = weekScores.filter(s => s.isFirstNight && !s.isPenalty);

  // All-Time High Game
  const allTimeHighGames: { bowlerName: string; bowlerSlug: string; teamName: string; score: number }[] = [];
  for (const b of bowlers) {
    if (b.isFirstNight || b.priorBestGame == null) continue;
    const bestThisWeek = Math.max(b.game1 ?? 0, b.game2 ?? 0, b.game3 ?? 0);
    if (bestThisWeek > b.priorBestGame) {
      allTimeHighGames.push({ bowlerName: b.bowlerName, bowlerSlug: b.bowlerSlug, teamName: b.teamName, score: bestThisWeek });
    }
  }
  allTimeHighGames.sort((a, b) => b.score - a.score);

  // All-Time High Series
  const allTimeHighSeries: { bowlerName: string; bowlerSlug: string; teamName: string; score: number }[] = [];
  for (const b of bowlers) {
    if (b.isFirstNight || b.priorBestSeries == null || b.scratchSeries == null) continue;
    if (b.scratchSeries > b.priorBestSeries) {
      allTimeHighSeries.push({ bowlerName: b.bowlerName, bowlerSlug: b.bowlerSlug, teamName: b.teamName, score: b.scratchSeries });
    }
  }
  allTimeHighSeries.sort((a, b) => b.score - a.score);

  // Bowler of the Week
  const debutBowlerIDs = new Set(debuts.map(s => s.bowlerID));
  const bowlerOfWeek = bowlers.reduce<{ name: string; slug: string; pinsOver: number; series: number } | null>((best, b) => {
    if (b.scratchSeries == null || b.incomingAvg == null || b.incomingAvg === 0) return best;
    if (debutBowlerIDs.has(b.bowlerID)) return best;
    const pinsOver = b.scratchSeries - 3 * b.incomingAvg;
    const cur = { name: b.bowlerName, slug: b.bowlerSlug, pinsOver, series: b.scratchSeries };
    return !best || cur.pinsOver > best.pinsOver ? cur : best;
  }, null);

  // Team of the Week
  const teamHcpData = new Map<number, { teamName: string; teamSlug: string; hcpSeries: number; expectedHcpSeries: number }>();
  for (const s of weekScores) {
    const cur = teamHcpData.get(s.teamID) ?? { teamName: s.teamName, teamSlug: s.teamSlug, hcpSeries: 0, expectedHcpSeries: 0 };
    cur.hcpSeries += s.handSeries ?? 0;
    if (s.incomingAvg != null && s.incomingHcp != null) {
      cur.expectedHcpSeries += 3 * (s.incomingAvg + s.incomingHcp);
    }
    teamHcpData.set(s.teamID, cur);
  }
  const teamOfWeek = Array.from(teamHcpData.entries())
    .map(([id, t]) => ({ id, ...t, pinsOver: t.hcpSeries - t.expectedHcpSeries }))
    .sort((a, b) => b.hcpSeries - a.hcpSeries)[0] ?? null;

  return { turkeyList, aboveAvgEveryGame, debuts, allTimeHighGames, allTimeHighSeries, bowlerOfWeek, teamOfWeek };
}

// ── League Heat Check ──────────────────────────────────────────

export function computeLeagueHeat(weekScores: WeeklyMatchScore[]): {
  pinsOverPerGame: number;
  leagueAvg: number;
  expectedAvg: number;
} | null {
  const real = weekScores.filter(s => s.scratchSeries != null && !s.isPenalty);
  if (real.length === 0) return null;

  const totalPins = real.reduce((sum, s) => sum + (s.scratchSeries ?? 0), 0);
  const leagueAvg = totalPins / (real.length * 3);

  const withAvg = real.filter(s => s.incomingAvg != null && s.incomingAvg > 0);
  if (withAvg.length === 0) return null;

  const expectedAvg = withAvg.reduce((sum, s) => sum + s.incomingAvg!, 0) / withAvg.length;
  const pinsOverPerGame = Math.round((leagueAvg - expectedAvg) * 10) / 10;

  return { pinsOverPerGame, leagueAvg: Math.round(leagueAvg * 10) / 10, expectedAvg: Math.round(expectedAvg * 10) / 10 };
}

// ── PIN Calculation ──────────────────────────────────────────

const PENALTY_HCP_GAME = 199;

export function computePIN(
  bowlers: WeeklyMatchScore[],
  matchResults: WeeklyMatchupResult[],
  compact: boolean,
): TopResult<{ name: string; slug: string; team: string; pin: number }> {
  const pinScores: { name: string; slug: string; team: string; pin: number }[] = [];
  if (matchResults.length === 0) return { items: [], tiedCount: 0, tiedValue: 0 };

  const teamGameTotals = new Map<number, { g1: number; g2: number; g3: number; series: number }>();
  for (const mr of matchResults) {
    if (mr.team1Game1 != null) {
      teamGameTotals.set(mr.homeTeamID, {
        g1: mr.team1Game1, g2: mr.team1Game2 ?? 0, g3: mr.team1Game3 ?? 0, series: mr.team1Series ?? 0,
      });
    }
    if (mr.team2Game1 != null) {
      teamGameTotals.set(mr.awayTeamID, {
        g1: mr.team2Game1, g2: mr.team2Game2 ?? 0, g3: mr.team2Game3 ?? 0, series: mr.team2Series ?? 0,
      });
    }
  }

  const opponentMap = new Map<number, number>();
  for (const mr of matchResults) {
    opponentMap.set(mr.homeTeamID, mr.awayTeamID);
    opponentMap.set(mr.awayTeamID, mr.homeTeamID);
  }

  function calcGamePts(t1: { g1: number; g2: number; g3: number }, t2: { g1: number; g2: number; g3: number }) {
    let p1 = 0, p2 = 0;
    for (const [a, b] of [[t1.g1, t2.g1], [t1.g2, t2.g2], [t1.g3, t2.g3]] as [number, number][]) {
      if (a > b) p1 += 2;
      else if (b > a) p2 += 2;
      else { p1 += 1; p2 += 1; }
    }
    return { p1, p2 };
  }

  function getXP(rank: number) { return rank < 5 ? 3 : rank < 10 ? 2 : rank < 15 ? 1 : 0; }

  const actualSeriesRanked = [...teamGameTotals.entries()].sort((a, b) => b[1].series - a[1].series);
  const actualXP = new Map<number, number>();
  actualSeriesRanked.forEach(([id], i) => actualXP.set(id, getXP(i)));

  const actualPoints = new Map<number, number>();
  for (const [tid] of teamGameTotals) actualPoints.set(tid, actualXP.get(tid) ?? 0);
  for (const mr of matchResults) {
    const t1 = teamGameTotals.get(mr.homeTeamID);
    const t2 = teamGameTotals.get(mr.awayTeamID);
    if (!t1 || !t2) continue;
    const pts = calcGamePts(t1, t2);
    actualPoints.set(mr.homeTeamID, (actualPoints.get(mr.homeTeamID) ?? 0) + pts.p1);
    actualPoints.set(mr.awayTeamID, (actualPoints.get(mr.awayTeamID) ?? 0) + pts.p2);
  }

  for (const b of bowlers) {
    if (b.incomingHcp == null || b.game1 == null || b.game2 == null || b.game3 == null) continue;
    const teamGames = teamGameTotals.get(b.teamID);
    const oppID = opponentMap.get(b.teamID);
    if (!teamGames || oppID == null) continue;
    const oppGames = teamGameTotals.get(oppID);
    if (!oppGames) continue;

    const bHcp1 = b.game1 + b.incomingHcp;
    const bHcp2 = b.game2 + b.incomingHcp;
    const bHcp3 = b.game3 + b.incomingHcp;

    const hypTeam = {
      g1: teamGames.g1 - bHcp1 + PENALTY_HCP_GAME,
      g2: teamGames.g2 - bHcp2 + PENALTY_HCP_GAME,
      g3: teamGames.g3 - bHcp3 + PENALTY_HCP_GAME,
      series: 0,
    };
    hypTeam.series = hypTeam.g1 + hypTeam.g2 + hypTeam.g3;

    const hypSeriesMap = new Map(actualSeriesRanked.map(([id, t]) => [id, t.series]));
    hypSeriesMap.set(b.teamID, hypTeam.series);
    const hypRanked = [...hypSeriesMap.entries()].sort((a, b) => b[1] - a[1]);
    const hypXP = new Map<number, number>();
    hypRanked.forEach(([id], i) => hypXP.set(id, getXP(i)));

    const hypPoints = new Map<number, number>();
    for (const [tid] of teamGameTotals) hypPoints.set(tid, hypXP.get(tid) ?? 0);
    for (const mr of matchResults) {
      const t1g = mr.homeTeamID === b.teamID ? hypTeam : teamGameTotals.get(mr.homeTeamID)!;
      const t2g = mr.awayTeamID === b.teamID ? hypTeam : teamGameTotals.get(mr.awayTeamID)!;
      const pts = calcGamePts(t1g, t2g);
      hypPoints.set(mr.homeTeamID, (hypPoints.get(mr.homeTeamID) ?? 0) + pts.p1);
      hypPoints.set(mr.awayTeamID, (hypPoints.get(mr.awayTeamID) ?? 0) + pts.p2);
    }

    const pin = (actualPoints.get(b.teamID) ?? 0) - (hypPoints.get(b.teamID) ?? 0);
    pinScores.push({ name: b.bowlerName, slug: b.bowlerSlug, team: b.teamName, pin });
  }
  pinScores.sort((a, b) => b.pin - a.pin);

  const positivePIN = pinScores.filter(p => p.pin > 0);
  return topWithTies(positivePIN, compact ? 1 : 5, p => p.pin);
}
