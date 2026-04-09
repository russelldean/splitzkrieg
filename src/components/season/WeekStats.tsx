'use client';
import Link from 'next/link';
import type { WeeklyMatchScore, WeeklyMatchupResult, LeagueMilestone } from '@/lib/queries';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { topWithTies, LeaderList, PINList } from './WeekStatsCards';
import { computeXPRankings, computeIndividualLeaders, computeWeeklyAwards, computePIN } from './weekStatsUtils';

export type WeekStatsSection = 'awards' | 'records' | 'xp' | 'teamStats' | 'leaders' | 'misc';

interface Props {
  weekScores: WeeklyMatchScore[];
  matchResults: WeeklyMatchupResult[];
  careerMilestones?: LeagueMilestone[];
  only?: WeekStatsSection[];
  exclude?: WeekStatsSection[];
  bare?: boolean;
  compact?: boolean;
}

export function WeekStats({ weekScores, matchResults, careerMilestones = [], only, exclude, bare, compact }: Props) {
  if (weekScores.length === 0) return null;

  const { rankedTeams, xpTiers } = computeXPRankings(weekScores);
  const topTeamScratch = [...rankedTeams]
    .sort((a, b) => b.scratchSeries - a.scratchSeries)
    .slice(0, compact ? 1 : 5);

  const { bowlers, topHcpSeries, topScratchGame, topMenScratch, topWomenScratch } = computeIndividualLeaders(weekScores, !!compact);
  const { turkeyList, aboveAvgEveryGame, debuts, allTimeHighGames, allTimeHighSeries, bowlerOfWeek, teamOfWeek } = computeWeeklyAwards(weekScores, bowlers);
  const topPIN = computePIN(bowlers, matchResults, !!compact);

  const show = (section: WeekStatsSection) => {
    if (only) return only.includes(section);
    if (exclude) return !exclude.includes(section);
    return true;
  };

  return (
    <section className={bare ? '' : 'mt-10'}>
      {!bare && !compact && (
        <>
          <div className="h-px bg-gradient-to-r from-transparent via-navy/15 to-transparent mb-8" />
          <SectionHeading>Weekly Highlights</SectionHeading>
        </>
      )}

      {/* Bowler & Team of the Week + League Heat Check */}
      {show('awards') && (bowlerOfWeek || teamOfWeek) && (
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

      {/* Milestones & Personal Bests */}
      {show('records') && (careerMilestones.length > 0 || debuts.length > 0 || allTimeHighGames.length > 0 || allTimeHighSeries.length > 0) && (
        <div className="mb-6">
          {!bare && <h3 className={compact ? "font-heading text-lg text-navy/80 mb-2" : "font-heading text-lg text-navy mb-3"}>Milestones &amp; Personal Bests</h3>}
          {careerMilestones.length > 0 && (
            <div className={`bg-amber-50/50 border border-amber-300/60 border-l-4 border-l-amber-500 rounded-lg shadow-sm mb-4 ${compact ? 'overflow-hidden' : 'p-3'}`}>
              <h3 className={compact ? "px-3 py-1 bg-amber-100/40 border-b border-amber-200/60 font-heading text-sm text-amber-800 leading-tight" : "font-heading text-sm text-amber-800 uppercase tracking-wider mb-1.5"}>&#11088; Career Milestones</h3>
              <div className={compact ? "px-3 py-1" : ""}>
              {careerMilestones.map((m, i) => (
                <div key={`${m.slug}-${m.category}-${i}`} className="flex justify-between text-sm font-body py-0.5">
                  <span className="truncate mr-2">
                    <Link href={`/bowler/${m.slug}`} className="text-navy hover:text-red-600 transition-colors">
                      {m.bowlerName}
                    </Link>
                  </span>
                  <span className="tabular-nums text-navy/60 shrink-0">
                    {m.threshold.toLocaleString()} {m.categoryLabel}
                  </span>
                </div>
              ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {debuts.length > 0 && (
              <div className={`bg-emerald-50/50 border border-emerald-300/60 border-l-4 border-l-emerald-500 rounded-lg shadow-sm ${compact ? 'overflow-hidden' : 'p-3'}`}>
                <h3 className={compact ? "px-3 py-1 bg-emerald-100/40 border-b border-emerald-200/60 font-heading text-sm text-emerald-800 leading-tight" : "font-heading text-sm text-emerald-800 uppercase tracking-wider mb-1.5"}>Splitzkrieg Debuts</h3>
                <div className={compact ? "px-3 py-1" : ""}>
                {debuts.map(b => (
                  <div key={b.bowlerID} className="text-sm font-body py-0.5">
                    <Link href={`/bowler/${b.bowlerSlug}`} className="text-navy hover:text-red-600 transition-colors">
                      {b.bowlerName}
                    </Link>
                  </div>
                ))}
                </div>
              </div>
            )}
            {allTimeHighGames.length > 0 && (
              <div className={`bg-amber-50/50 border border-amber-300/60 border-l-4 border-l-amber-500 rounded-lg shadow-sm ${compact ? 'overflow-hidden' : 'p-3'}`}>
                <h3 className={compact ? "px-3 py-1 bg-amber-100/40 border-b border-amber-200/60 font-heading text-sm text-amber-800 leading-tight" : "font-heading text-sm text-amber-800 uppercase tracking-wider mb-1.5"}>&#11088; All-Time High Game</h3>
                <div className={compact ? "px-3 py-1" : ""}>
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
              </div>
            )}
            {allTimeHighSeries.length > 0 && (
              <div className={`bg-amber-50/50 border border-amber-300/60 border-l-4 border-l-amber-500 rounded-lg shadow-sm ${compact ? 'overflow-hidden' : 'p-3'}`}>
                <h3 className={compact ? "px-3 py-1 bg-amber-100/40 border-b border-amber-200/60 font-heading text-sm text-amber-800 leading-tight" : "font-heading text-sm text-amber-800 uppercase tracking-wider mb-1.5"}>&#11088; All-Time High Series</h3>
                <div className={compact ? "px-3 py-1" : ""}>
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
              </div>
            )}
          </div>
        </div>
      )}

      {/* XP Rankings */}
      {show('xp') && xpTiers.length > 0 && (
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
      {show('teamStats') && (<>
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
      </>)}

      {/* Individual Leaders */}
      {show('leaders') && (<>
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
      </>)}

      {/* Turkeys + Above Average */}
      {show('misc') && (<>
      <div className="h-px bg-gradient-to-r from-transparent via-navy/10 to-transparent mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {!compact && turkeyList.length > 0 && (
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
      </>)}
    </section>
  );
}
