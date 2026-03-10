'use client';
import Link from 'next/link';
import type { WeeklyMatchScore, WeeklyMatchupResult } from '@/lib/queries';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface Props {
  weekScores: WeeklyMatchScore[];
  matchResults: WeeklyMatchupResult[];
}

interface TopResult<T> {
  items: T[];
  tiedCount: number;
  tiedValue: number;
}

/**
 * Return top N items from a pre-sorted array, expanding ties at the cutoff.
 * If expanding would exceed maxShow, truncate and return tied count instead.
 */
function topWithTies<T>(sorted: T[], n: number, getValue: (item: T) => number, maxShow = 7): TopResult<T> {
  if (sorted.length <= n) return { items: sorted, tiedCount: 0, tiedValue: 0 };
  const cutoffValue = getValue(sorted[n - 1]);
  let end = n;
  while (end < sorted.length && getValue(sorted[end]) === cutoffValue) end++;
  if (end <= maxShow) {
    return { items: sorted.slice(0, end), tiedCount: 0, tiedValue: 0 };
  }
  // Too many ties — show items above the tie value, then "X tied with Y"
  let aboveTie = 0;
  while (aboveTie < sorted.length && getValue(sorted[aboveTie]) > cutoffValue) aboveTie++;
  const tiedCount = end - aboveTie;
  return { items: sorted.slice(0, aboveTie), tiedCount, tiedValue: cutoffValue };
}

/** Compute all the weekly report stats shown at the bottom of the PDF report. */
export function WeekStats({ weekScores, matchResults }: Props) {
  if (weekScores.length === 0) return null;

  // --- XP Rankings (teams ranked by hcp series, grouped into XP tiers) ---
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

  // XP tiers: top 5 = 3pts, next 5 = 2pts, next 5 = 1pt, bottom 5 = 0pts
  const xpTiers = [
    { label: 'Three Points', teams: rankedTeams.slice(0, 5) },
    { label: 'Two Points', teams: rankedTeams.slice(5, 10) },
    { label: 'One Point', teams: rankedTeams.slice(10, 15) },
    { label: 'Better Luck Next Time', teams: rankedTeams.slice(15, 20) },
  ].filter(tier => tier.teams.length > 0);

  // --- High Team Scratch Series ---
  const topTeamScratch = [...rankedTeams]
    .sort((a, b) => b.scratchSeries - a.scratchSeries)
    .slice(0, 5);

  // --- Individual stats (exclude penalties) ---
  const bowlers = weekScores.filter(s => s.scratchSeries != null && !s.isPenalty);

  // High Handicap Series (top 5, expanding ties)
  const sortedHcpSeries = [...bowlers].sort((a, b) => (b.handSeries ?? 0) - (a.handSeries ?? 0));
  const topHcpSeries = topWithTies(sortedHcpSeries, 5, b => b.handSeries ?? 0);

  // High Scratch Game (top 5 individual games, expanding ties)
  const allGames: { bowlerName: string; bowlerSlug: string; teamName: string; score: number }[] = [];
  for (const b of bowlers) {
    if (b.game1 != null) allGames.push({ bowlerName: b.bowlerName, bowlerSlug: b.bowlerSlug, teamName: b.teamName, score: b.game1 });
    if (b.game2 != null) allGames.push({ bowlerName: b.bowlerName, bowlerSlug: b.bowlerSlug, teamName: b.teamName, score: b.game2 });
    if (b.game3 != null) allGames.push({ bowlerName: b.bowlerName, bowlerSlug: b.bowlerSlug, teamName: b.teamName, score: b.game3 });
  }
  allGames.sort((a, b) => b.score - a.score);
  const topScratchGame = topWithTies(allGames, 5, g => g.score);

  // High Men's Scratch Series (top 5, expanding ties)
  const sortedMenScratch = [...bowlers]
    .filter(b => b.gender === 'M')
    .sort((a, b) => (b.scratchSeries ?? 0) - (a.scratchSeries ?? 0));
  const topMenScratch = topWithTies(sortedMenScratch, 5, b => b.scratchSeries ?? 0);

  // High Women's Scratch Series (top 5, expanding ties)
  const sortedWomenScratch = [...bowlers]
    .filter(b => b.gender === 'F')
    .sort((a, b) => (b.scratchSeries ?? 0) - (a.scratchSeries ?? 0));
  const topWomenScratch = topWithTies(sortedWomenScratch, 5, b => b.scratchSeries ?? 0);

  // --- Turkeys ---
  const turkeyList = bowlers
    .filter(b => b.turkeys > 0)
    .sort((a, b) => b.turkeys - a.turkeys);

  // --- Bowlers Above Average Every Game ---
  const aboveAvgEveryGame = bowlers.filter(b => {
    if (b.incomingAvg == null || b.incomingAvg === 0) return false;
    return (
      b.game1 != null && b.game1 > b.incomingAvg &&
      b.game2 != null && b.game2 > b.incomingAvg &&
      b.game3 != null && b.game3 > b.incomingAvg
    );
  });

  // --- Splitzkrieg Debuts ---
  const debuts = weekScores.filter(s => s.isFirstNight);

  // --- All-Time High Game (exclude debuts) ---
  const allTimeHighGames: { bowlerName: string; bowlerSlug: string; teamName: string; score: number }[] = [];
  for (const b of bowlers) {
    if (b.isFirstNight || b.priorBestGame == null) continue;
    const bestThisWeek = Math.max(b.game1 ?? 0, b.game2 ?? 0, b.game3 ?? 0);
    if (bestThisWeek > b.priorBestGame) {
      allTimeHighGames.push({ bowlerName: b.bowlerName, bowlerSlug: b.bowlerSlug, teamName: b.teamName, score: bestThisWeek });
    }
  }
  allTimeHighGames.sort((a, b) => b.score - a.score);

  // --- All-Time High Series (exclude debuts) ---
  const allTimeHighSeries: { bowlerName: string; bowlerSlug: string; teamName: string; score: number }[] = [];
  for (const b of bowlers) {
    if (b.isFirstNight || b.priorBestSeries == null || b.scratchSeries == null) continue;
    if (b.scratchSeries > b.priorBestSeries) {
      allTimeHighSeries.push({ bowlerName: b.bowlerName, bowlerSlug: b.bowlerSlug, teamName: b.teamName, score: b.scratchSeries });
    }
  }
  allTimeHighSeries.sort((a, b) => b.score - a.score);

  // --- Bowler of the Week (most pins over average: series - 3×incomingAvg) ---
  // Exclude debuts (first night in Splitzkrieg) — they are not eligible
  const debutBowlerIDs = new Set(debuts.map(s => s.bowlerID));
  const bowlerOfWeek = bowlers.reduce<{ name: string; slug: string; pinsOver: number; series: number } | null>((best, b) => {
    if (b.scratchSeries == null || b.incomingAvg == null || b.incomingAvg === 0) return best;
    if (debutBowlerIDs.has(b.bowlerID)) return best;
    const pinsOver = b.scratchSeries - 3 * b.incomingAvg;
    const cur = { name: b.bowlerName, slug: b.bowlerSlug, pinsOver, series: b.scratchSeries };
    return !best || cur.pinsOver > best.pinsOver ? cur : best;
  }, null);

  // --- Team of the Week (highest hcp series, pins over expected = hcpSeries - sum of 3×(avg+hcp) per bowler) ---
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

  // --- PIN: Personal Impact Number ---
  // For each bowler, replace their hcp games with penalty (199), recalculate
  // head-to-head game results and XP tiers, measure point delta for their team.
  const PENALTY_HCP_GAME = 199;
  const pinScores: { name: string; slug: string; team: string; pin: number }[] = [];
  if (matchResults.length > 0) {
    // Build team hcp game totals from matchResults
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

    // Find opponent for each team
    const opponentMap = new Map<number, number>();
    for (const mr of matchResults) {
      opponentMap.set(mr.homeTeamID, mr.awayTeamID);
      opponentMap.set(mr.awayTeamID, mr.homeTeamID);
    }

    // Game points helper (2 per win, 1 per tie)
    function calcGamePts(t1: { g1: number; g2: number; g3: number }, t2: { g1: number; g2: number; g3: number }) {
      let p1 = 0, p2 = 0;
      for (const [a, b] of [[t1.g1, t2.g1], [t1.g2, t2.g2], [t1.g3, t2.g3]] as [number, number][]) {
        if (a > b) p1 += 2;
        else if (b > a) p2 += 2;
        else { p1 += 1; p2 += 1; }
      }
      return { p1, p2 };
    }

    // XP from rank
    function getXP(rank: number) { return rank < 5 ? 3 : rank < 10 ? 2 : rank < 15 ? 1 : 0; }

    // Actual XP for each team
    const actualSeriesRanked = [...teamGameTotals.entries()].sort((a, b) => b[1].series - a[1].series);
    const actualXP = new Map<number, number>();
    actualSeriesRanked.forEach(([id], i) => actualXP.set(id, getXP(i)));

    // Actual total points per team
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

    // For each bowler with hcp data, compute PIN
    for (const b of bowlers) {
      if (b.incomingHcp == null || b.game1 == null || b.game2 == null || b.game3 == null) continue;
      const teamGames = teamGameTotals.get(b.teamID);
      const oppID = opponentMap.get(b.teamID);
      if (!teamGames || oppID == null) continue;
      const oppGames = teamGameTotals.get(oppID);
      if (!oppGames) continue;

      // Bowler's hcp game contributions
      const bHcp1 = b.game1 + b.incomingHcp;
      const bHcp2 = b.game2 + b.incomingHcp;
      const bHcp3 = b.game3 + b.incomingHcp;

      // Hypothetical team games with penalty replacement
      const hypTeam = {
        g1: teamGames.g1 - bHcp1 + PENALTY_HCP_GAME,
        g2: teamGames.g2 - bHcp2 + PENALTY_HCP_GAME,
        g3: teamGames.g3 - bHcp3 + PENALTY_HCP_GAME,
        series: 0,
      };
      hypTeam.series = hypTeam.g1 + hypTeam.g2 + hypTeam.g3;

      // Recalculate XP with hypothetical series
      const hypSeriesMap = new Map(actualSeriesRanked.map(([id, t]) => [id, t.series]));
      hypSeriesMap.set(b.teamID, hypTeam.series);
      const hypRanked = [...hypSeriesMap.entries()].sort((a, b) => b[1] - a[1]);
      const hypXP = new Map<number, number>();
      hypRanked.forEach(([id], i) => hypXP.set(id, getXP(i)));

      // Recalculate total points for all teams
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
  }
  const positivePIN = pinScores.filter(p => p.pin > 0);
  const topPIN = topWithTies(positivePIN, 5, p => p.pin);


  return (
    <section className="mt-10">
      <div className="h-px bg-gradient-to-r from-transparent via-navy/15 to-transparent mb-8" />
      <SectionHeading>Weekly Highlights</SectionHeading>

      {/* Bowler & Team of the Week */}
      {(bowlerOfWeek || teamOfWeek) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {bowlerOfWeek && (
            <div className="bg-white border border-navy/10 border-l-4 border-l-red-600/40 rounded-lg px-4 py-3 shadow-sm">
              <div className="text-xs font-heading text-red-600/70 uppercase tracking-wider mb-1">Bowler of the Week</div>
              <Link href={`/bowler/${bowlerOfWeek.slug}`} className="font-heading text-lg text-navy hover:text-red-600 transition-colors">
                {bowlerOfWeek.name}
              </Link>
              <div className="text-sm font-body text-navy/65">
                {bowlerOfWeek.pinsOver > 0 ? '+' : ''}{bowlerOfWeek.pinsOver} Pins
                <span className="text-navy/30 mx-1">&middot;</span>
                {bowlerOfWeek.series} Series
              </div>
            </div>
          )}
          {teamOfWeek && (
            <div className="bg-white border border-navy/10 border-l-4 border-l-red-600/40 rounded-lg px-4 py-3 shadow-sm">
              <div className="text-xs font-heading text-red-600/70 uppercase tracking-wider mb-1">Team of the Week</div>
              <Link href={`/team/${teamOfWeek.teamSlug}`} className="font-heading text-lg text-navy hover:text-red-600 transition-colors">
                {teamOfWeek.teamName}
              </Link>
              <div className="text-sm font-body text-navy/65">
                {teamOfWeek.pinsOver > 0 ? '+' : ''}{teamOfWeek.pinsOver} Pins
                <span className="text-navy/30 mx-1">&middot;</span>
                {teamOfWeek.hcpSeries} Hcp Series
              </div>
            </div>
          )}
        </div>
      )}

      {/* Debuts, All-Time Records */}
      {(debuts.length > 0 || allTimeHighGames.length > 0 || allTimeHighSeries.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {debuts.length > 0 && (
            <div className="bg-white border border-navy/10 rounded-lg p-3 shadow-sm">
              <h3 className="font-heading text-sm text-navy/60 uppercase tracking-wider mb-1.5">Splitzkrieg Debuts</h3>
              {debuts.map(b => (
                <div key={b.bowlerID} className="text-sm font-body py-0.5">
                  <Link href={`/bowler/${b.bowlerSlug}`} className="text-navy hover:text-red-600 transition-colors">
                    {b.bowlerName}
                  </Link>
                </div>
              ))}
            </div>
          )}
          {allTimeHighGames.length > 0 && (
            <div className="bg-white border border-navy/10 rounded-lg p-3 shadow-sm">
              <h3 className="font-heading text-sm text-navy/60 uppercase tracking-wider mb-1.5">All-Time High Game</h3>
              {allTimeHighGames.map((b, i) => (
                <div key={`${b.bowlerSlug}-${i}`} className="flex justify-between text-sm font-body py-0.5">
                  <span className="truncate mr-2">
                    <Link href={`/bowler/${b.bowlerSlug}`} className="text-navy hover:text-red-600 transition-colors">
                      {b.bowlerName}
                    </Link>
                    <span className="text-navy/65 text-xs ml-1">({b.teamName})</span>
                  </span>
                  <span className="tabular-nums text-navy/60 shrink-0">{b.score}</span>
                </div>
              ))}
            </div>
          )}
          {allTimeHighSeries.length > 0 && (
            <div className="bg-white border border-navy/10 rounded-lg p-3 shadow-sm">
              <h3 className="font-heading text-sm text-navy/60 uppercase tracking-wider mb-1.5">All-Time High Series</h3>
              {allTimeHighSeries.map((b, i) => (
                <div key={`${b.bowlerSlug}-${i}`} className="flex justify-between text-sm font-body py-0.5">
                  <span className="truncate mr-2">
                    <Link href={`/bowler/${b.bowlerSlug}`} className="text-navy hover:text-red-600 transition-colors">
                      {b.bowlerName}
                    </Link>
                    <span className="text-navy/65 text-xs ml-1">({b.teamName})</span>
                  </span>
                  <span className="tabular-nums text-navy/60 shrink-0">{b.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* XP Rankings */}
      {xpTiers.length > 0 && (
        <div className="mb-6">
          <div className="h-px bg-gradient-to-r from-transparent via-navy/10 to-transparent mb-6" />
          <h3 className="font-heading text-lg text-navy mb-3">XP Rankings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {xpTiers.map(tier => (
              <div key={tier.label} className="bg-white border border-navy/10 rounded-lg p-3 shadow-sm">
                <div className="text-xs font-heading text-navy/60 uppercase tracking-wider mb-1.5">{tier.label}</div>
                {tier.teams.map(team => (
                  <div key={team.id} className="flex justify-between text-sm font-body py-0.5">
                    <Link href={`/team/${team.teamSlug}`} className="text-navy hover:text-red-600 transition-colors truncate mr-2">
                      {team.teamName}
                    </Link>
                    <span className="tabular-nums text-navy/60 shrink-0">{team.hcpSeries}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* High Team Scratch Series + PIN */}
      <div className="h-px bg-gradient-to-r from-transparent via-navy/10 to-transparent mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {topTeamScratch.length > 0 && (
          <div className="bg-white border border-navy/10 rounded-lg p-3 shadow-sm">
            <h3 className="font-heading text-sm text-navy/60 uppercase tracking-wider mb-1.5">High Team Scratch Series</h3>
            {(() => {
              const topScratch = topTeamScratch[0].scratchSeries;
              return topTeamScratch.map((team) => {
                const isTop = team.scratchSeries === topScratch;
                return (
                  <div key={team.id} className="flex justify-between text-sm font-body py-0.5">
                    <Link href={`/team/${team.teamSlug}`} className={`text-navy hover:text-red-600 transition-colors truncate mr-2 ${isTop ? 'font-bold' : ''}`}>
                      {team.teamName}
                    </Link>
                    <span className={`tabular-nums shrink-0 ${isTop ? 'font-bold text-navy' : 'text-navy/60'}`}>{team.scratchSeries}</span>
                  </div>
                );
              });
            })()}
          </div>
        )}
        {topPIN.items.length > 0 && (
          <PINList items={topPIN.items} tiedCount={topPIN.tiedCount} tiedValue={topPIN.tiedValue} />
        )}
      </div>

      {/* Individual Leaders — 2x2 grid */}
      <div className="h-px bg-gradient-to-r from-transparent via-navy/10 to-transparent mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <LeaderList title="High Handicap Series" result={topHcpSeries} getItem={b => ({ name: b.bowlerName, slug: b.bowlerSlug, team: b.teamName, value: b.handSeries ?? 0 })} />
        <LeaderList title="High Scratch Game" result={topScratchGame} getItem={g => ({ name: g.bowlerName, slug: g.bowlerSlug, team: g.teamName, value: g.score })} />
        {topMenScratch.items.length > 0 && (
          <LeaderList title="High Men's Scratch Series" result={topMenScratch} getItem={b => ({ name: b.bowlerName, slug: b.bowlerSlug, team: b.teamName, value: b.scratchSeries ?? 0 })} />
        )}
        {topWomenScratch.items.length > 0 && (
          <LeaderList title="High Women's Scratch Series" result={topWomenScratch} getItem={b => ({ name: b.bowlerName, slug: b.bowlerSlug, team: b.teamName, value: b.scratchSeries ?? 0 })} />
        )}
      </div>

      {/* Turkeys + Above Average */}
      <div className="h-px bg-gradient-to-r from-transparent via-navy/10 to-transparent mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {turkeyList.length > 0 && (
          <div className="bg-white border border-navy/10 rounded-lg p-3 shadow-sm">
            <h3 className="font-heading text-sm text-navy/60 uppercase tracking-wider mb-1.5">Turkeys</h3>
            {turkeyList.map(b => (
              <div key={b.bowlerID} className="flex justify-between text-sm font-body py-0.5">
                <Link href={`/bowler/${b.bowlerSlug}`} className="text-navy hover:text-red-600 transition-colors truncate mr-2">
                  {b.bowlerName}
                </Link>
                <span className="shrink-0" title={`${b.turkeys} turkey${b.turkeys > 1 ? 's' : ''}`}>
                  {Array.from({ length: b.turkeys }, (_, i) => (
                    <span key={i} className="text-base">🦃</span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        )}
        {aboveAvgEveryGame.length > 0 && (
          <div className="bg-white border border-navy/10 rounded-lg p-3 shadow-sm">
            <h3 className="font-heading text-sm text-navy/60 uppercase tracking-wider mb-1.5">Above Average Every Game</h3>
            {aboveAvgEveryGame.map(b => (
              <div key={b.bowlerID} className="text-sm font-body py-0.5">
                <Link href={`/bowler/${b.bowlerSlug}`} className="text-navy hover:text-red-600 transition-colors">
                  {b.bowlerName}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PINList({ items, tiedCount, tiedValue }: { items: { name: string; slug: string; team: string; pin: number }[]; tiedCount: number; tiedValue: number }) {
  return (
    <div className="bg-white border border-navy/10 rounded-lg p-3 shadow-sm">
      <details className="mb-1.5">
        <summary className="font-heading text-sm text-navy/60 uppercase tracking-wider cursor-pointer list-none inline-flex items-center gap-1">
          PIN <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-navy/10 text-navy/65 text-xs font-bold leading-none">?</span>
        </summary>
        <p className="text-xs font-body text-navy/65 mt-1">Personal Impact Number - how many points your team would have lost if you didn't show up.</p>
      </details>
      {(() => {
        const topPin = items[0].pin;
        return items.map((item, i) => {
          const isTop = item.pin === topPin;
          return (
            <div key={`${item.slug}-${i}`} className="flex justify-between text-sm font-body py-0.5">
              <span className="truncate mr-2">
                <Link href={`/bowler/${item.slug}`} className={`text-navy hover:text-red-600 transition-colors ${isTop ? 'font-bold' : ''}`}>
                  {item.name}
                </Link>
                <span className="text-navy/65 text-xs ml-1">({item.team})</span>
              </span>
              <span className={`tabular-nums shrink-0 ${isTop ? 'font-bold text-navy' : 'text-navy/60'}`}>+{item.pin}</span>
            </div>
          );
        });
      })()}
      {tiedCount > 0 && (
        <div className="text-sm font-body text-navy/65 italic py-0.5">
          {tiedCount} tied with +{tiedValue}
        </div>
      )}
    </div>
  );
}

function TiedNote({ count, value, prefix }: { count: number; value: number; prefix?: string }) {
  if (count === 0) return null;
  return (
    <div className="text-sm font-body text-navy/65 italic py-0.5">
      {count} tied with {prefix}{value}
    </div>
  );
}

function LeaderList<T>({ title, result, getItem }: {
  title: string;
  result: TopResult<T>;
  getItem: (item: T) => { name: string; slug: string; team?: string; value: number };
}) {
  if (result.items.length === 0) return null;
  return (
    <div className="bg-white border border-navy/10 rounded-lg p-3 shadow-sm">
      <h3 className="font-heading text-sm text-navy/60 uppercase tracking-wider mb-1.5">{title}</h3>
      {(() => {
        const topValue = getItem(result.items[0]).value;
        return result.items.map((raw, i) => {
          const item = getItem(raw);
          const isTop = item.value === topValue;
          return (
            <div key={`${item.slug}-${i}`} className="flex justify-between text-sm font-body py-0.5">
              <span className="truncate mr-2">
                <Link href={`/bowler/${item.slug}`} className={`text-navy hover:text-red-600 transition-colors ${isTop ? 'font-bold' : ''}`}>
                  {item.name}
                </Link>
                {item.team && <span className="text-navy/65 text-xs ml-1">({item.team})</span>}
              </span>
              <span className={`tabular-nums shrink-0 ${isTop ? 'font-bold text-navy' : 'text-navy/60'}`}>{item.value}</span>
            </div>
          );
        });
      })()}
      <TiedNote count={result.tiedCount} value={result.tiedValue} />
    </div>
  );
}
