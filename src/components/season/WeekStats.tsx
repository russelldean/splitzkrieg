'use client';
import Link from 'next/link';
import type { WeeklyMatchScore, WeeklyMatchupResult } from '@/lib/queries';

interface Props {
  weekScores: WeeklyMatchScore[];
  matchResults: WeeklyMatchupResult[];
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

  // --- Individual stats ---
  const bowlers = weekScores.filter(s => s.scratchSeries != null);

  // High Handicap Series (top 5)
  const topHcpSeries = [...bowlers]
    .sort((a, b) => (b.handSeries ?? 0) - (a.handSeries ?? 0))
    .slice(0, 5);

  // High Scratch Game (top 5 individual games)
  const allGames: { bowlerName: string; bowlerSlug: string; teamName: string; score: number }[] = [];
  for (const b of bowlers) {
    if (b.game1 != null) allGames.push({ bowlerName: b.bowlerName, bowlerSlug: b.bowlerSlug, teamName: b.teamName, score: b.game1 });
    if (b.game2 != null) allGames.push({ bowlerName: b.bowlerName, bowlerSlug: b.bowlerSlug, teamName: b.teamName, score: b.game2 });
    if (b.game3 != null) allGames.push({ bowlerName: b.bowlerName, bowlerSlug: b.bowlerSlug, teamName: b.teamName, score: b.game3 });
  }
  const topScratchGame = allGames.sort((a, b) => b.score - a.score).slice(0, 5);

  // High Men's Scratch Series (top 5)
  const topMenScratch = [...bowlers]
    .filter(b => b.gender === 'M')
    .sort((a, b) => (b.scratchSeries ?? 0) - (a.scratchSeries ?? 0))
    .slice(0, 5);

  // High Women's Scratch Series (top 5)
  const topWomenScratch = [...bowlers]
    .filter(b => b.gender === 'F')
    .sort((a, b) => (b.scratchSeries ?? 0) - (a.scratchSeries ?? 0))
    .slice(0, 5);

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

  // --- Bowler of the Week (most pins over average: series - 3×incomingAvg) ---
  const bowlerOfWeek = bowlers.reduce<{ name: string; slug: string; pinsOver: number; series: number } | null>((best, b) => {
    if (b.scratchSeries == null || b.incomingAvg == null || b.incomingAvg === 0) return best;
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

  // --- League avg for the week ---
  const totalGames = bowlers.reduce((sum, b) => {
    let count = 0;
    if (b.game1 != null) count++;
    if (b.game2 != null) count++;
    if (b.game3 != null) count++;
    return sum + count;
  }, 0);
  const totalPins = bowlers.reduce((sum, b) => sum + (b.scratchSeries ?? 0), 0);
  const weekAvg = totalGames > 0 ? (totalPins / totalGames).toFixed(1) : null;

  return (
    <section className="mt-8 pt-6 border-t border-navy/10">
      <h2 className="font-heading text-2xl text-navy mb-4">Week Stats</h2>

      {/* Bowler & Team of the Week */}
      {(bowlerOfWeek || teamOfWeek) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {bowlerOfWeek && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <div className="text-xs font-heading text-amber-700 uppercase tracking-wider mb-1">Bowler of the Week</div>
              <Link href={`/bowler/${bowlerOfWeek.slug}`} className="font-heading text-lg text-navy hover:text-red-600 transition-colors">
                {bowlerOfWeek.name}
              </Link>
              <div className="text-sm font-body text-navy/50">
                {bowlerOfWeek.pinsOver > 0 ? '+' : ''}{bowlerOfWeek.pinsOver} Pins
                <span className="text-navy/30 mx-1">&middot;</span>
                {bowlerOfWeek.series} Series
              </div>
            </div>
          )}
          {teamOfWeek && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <div className="text-xs font-heading text-amber-700 uppercase tracking-wider mb-1">Team of the Week</div>
              <Link href={`/team/${teamOfWeek.teamSlug}`} className="font-heading text-lg text-navy hover:text-red-600 transition-colors">
                {teamOfWeek.teamName}
              </Link>
              <div className="text-sm font-body text-navy/50">
                {teamOfWeek.pinsOver > 0 ? '+' : ''}{teamOfWeek.pinsOver} Pins
                <span className="text-navy/30 mx-1">&middot;</span>
                {teamOfWeek.hcpSeries} Hcp Series
              </div>
            </div>
          )}
        </div>
      )}

      {/* League average */}
      {weekAvg && (
        <p className="text-sm font-body text-navy/50 mb-4">
          League Average: <span className="text-navy font-semibold">{weekAvg}</span>
        </p>
      )}

      {/* XP Rankings */}
      {xpTiers.length > 0 && (
        <div className="mb-6">
          <h3 className="font-heading text-lg text-navy mb-2">XP Rankings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {xpTiers.map(tier => (
              <div key={tier.label} className="border border-navy/10 rounded-lg p-3">
                <div className="text-xs font-heading text-navy/50 uppercase tracking-wider mb-1.5">{tier.label}</div>
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

      {/* High Team Scratch Series */}
      {topTeamScratch.length > 0 && (
        <div className="mb-6">
          <h3 className="font-heading text-lg text-navy mb-2">High Team Scratch Series</h3>
          <div className="border border-navy/10 rounded-lg p-3 max-w-sm">
            {topTeamScratch.map(team => (
              <div key={team.id} className="flex justify-between text-sm font-body py-0.5">
                <Link href={`/team/${team.teamSlug}`} className="text-navy hover:text-red-600 transition-colors truncate mr-2">
                  {team.teamName}
                </Link>
                <span className="tabular-nums text-navy/60 shrink-0">{team.scratchSeries}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Individual Leaders — 2x2 grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <LeaderList title="High Handicap Series" items={topHcpSeries.map(b => ({ name: b.bowlerName, slug: b.bowlerSlug, team: b.teamName, value: b.handSeries ?? 0 }))} />
        <LeaderList title="High Scratch Game" items={topScratchGame.map(g => ({ name: g.bowlerName, slug: g.bowlerSlug, team: g.teamName, value: g.score }))} />
        {topMenScratch.length > 0 && (
          <LeaderList title="High Men's Scratch Series" items={topMenScratch.map(b => ({ name: b.bowlerName, slug: b.bowlerSlug, team: b.teamName, value: b.scratchSeries ?? 0 }))} />
        )}
        {topWomenScratch.length > 0 && (
          <LeaderList title="High Women's Scratch Series" items={topWomenScratch.map(b => ({ name: b.bowlerName, slug: b.bowlerSlug, team: b.teamName, value: b.scratchSeries ?? 0 }))} />
        )}
      </div>

      {/* Turkeys + Above Average */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {turkeyList.length > 0 && (
          <div className="border border-navy/10 rounded-lg p-3">
            <h3 className="font-heading text-sm text-navy/60 uppercase tracking-wider mb-1.5">Turkeys</h3>
            {turkeyList.map(b => (
              <div key={b.bowlerID} className="flex justify-between text-sm font-body py-0.5">
                <Link href={`/bowler/${b.bowlerSlug}`} className="text-navy hover:text-red-600 transition-colors truncate mr-2">
                  {b.bowlerName}
                </Link>
                <span className="tabular-nums text-navy/60 shrink-0">{b.turkeys}</span>
              </div>
            ))}
          </div>
        )}
        {aboveAvgEveryGame.length > 0 && (
          <div className="border border-navy/10 rounded-lg p-3">
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

function LeaderList({ title, items }: { title: string; items: { name: string; slug: string; team?: string; value: number }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="border border-navy/10 rounded-lg p-3">
      <h3 className="font-heading text-sm text-navy/60 uppercase tracking-wider mb-1.5">{title}</h3>
      {items.map((item, i) => (
        <div key={`${item.slug}-${i}`} className="flex justify-between text-sm font-body py-0.5">
          <span className="truncate mr-2">
            <Link href={`/bowler/${item.slug}`} className="text-navy hover:text-red-600 transition-colors">
              {item.name}
            </Link>
            {item.team && <span className="text-navy/40 text-xs ml-1">({item.team})</span>}
          </span>
          <span className="tabular-nums text-navy/60 shrink-0">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
