/**
 * Public playoff round page. Two rounds per season:
 *   /playoffs/[seasonSlug]/1: semifinals + individual round 1 brackets
 *   /playoffs/[seasonSlug]/2: finals + individual round 2 brackets
 *
 * Renders team match cards (semis/final) plus the three individual
 * leaderboards (Men's Scratch, Women's Scratch, Handicap) with the top
 * advancers highlighted.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getAllSeasonSlugs,
  getSeasonBySlug,
  getSeasonWeeklyScores,
  getSeasonSchedule,
  getTeamChampionshipWins,
  getIndividualChampionshipWins,
} from '@/lib/queries';
import {
  getPlayoffTeamMatches,
  getPlayoffBracketParticipants,
  getSeasonsWithPlayoffData,
  type PlayoffPageBowler,
  type PlayoffTeamMatch,
  type PlayoffBracketParticipant,
} from '@/lib/queries/playoffs/page';
import { getIndividualBracketResults } from '@/lib/queries/playoffs/scores';
import type { PlayoffScoresheetEntry } from '@/lib/queries/playoffs/scores';
import type { ChampionshipType } from '@/lib/admin/playoff-admin';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { strikeX } from '@/components/ui/StrikeX';
import { TeamBoxScore } from '@/components/season/TeamBoxScore';
import { findMatchMVP } from '@/lib/week-utils';
import type { WeeklyMatchScore } from '@/lib/queries';

export const dynamicParams = false;

const ROUND_LABEL: Record<number, string> = {
  1: 'Semifinals',
  2: 'Finals',
};

const BRACKET_LABEL: Record<ChampionshipType, string> = {
  MensScratch: "Men's Scratch",
  WomensScratch: "Women's Scratch",
  Handicap: 'Handicap',
};

export async function generateStaticParams(): Promise<{ seasonSlug: string; round: string }[]> {
  const [seasonSlugs, withData] = await Promise.all([
    getAllSeasonSlugs(),
    getSeasonsWithPlayoffData(),
  ]);
  const slugByID = new Map<number, string>();
  for (const { slug } of seasonSlugs) {
    const season = await getSeasonBySlug(slug);
    if (season) slugByID.set(season.seasonID, slug);
  }
  return withData
    .filter((row) => slugByID.has(row.seasonID))
    .map((row) => ({
      seasonSlug: slugByID.get(row.seasonID)!,
      round: String(row.round),
    }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seasonSlug: string; round: string }>;
}): Promise<Metadata> {
  const { seasonSlug, round } = await params;
  const season = await getSeasonBySlug(seasonSlug);
  if (!season) return { title: 'Playoffs Not Found | Splitzkrieg' };
  const roundNum = parseInt(round, 10);
  const label = ROUND_LABEL[roundNum] ?? 'Playoffs';
  return {
    title: `${label} - Season ${season.romanNumeral} | Splitzkrieg`,
    description: `${label} results for ${season.period} ${season.year}.`,
  };
}

export default async function PlayoffRoundPage({
  params,
}: {
  params: Promise<{ seasonSlug: string; round: string }>;
}) {
  const { seasonSlug, round: roundStr } = await params;
  const round = parseInt(roundStr, 10);
  if (round !== 1 && round !== 2) notFound();
  const season = await getSeasonBySlug(seasonSlug);
  if (!season) notFound();

  const [
    teamMatches,
    mScratch,
    wScratch,
    handicap,
    mScratchField,
    wScratchField,
    handicapField,
    weeklyScores,
    schedule,
  ] = await Promise.all([
    getPlayoffTeamMatches(season.seasonID, round as 1 | 2),
    getIndividualBracketResults(season.seasonID, 'MensScratch', round as 1 | 2),
    getIndividualBracketResults(season.seasonID, 'WomensScratch', round as 1 | 2),
    getIndividualBracketResults(season.seasonID, 'Handicap', round as 1 | 2),
    getPlayoffBracketParticipants(season.seasonID, 'MensScratch', round as 1 | 2),
    getPlayoffBracketParticipants(season.seasonID, 'WomensScratch', round as 1 | 2),
    getPlayoffBracketParticipants(season.seasonID, 'Handicap', round as 1 | 2),
    getSeasonWeeklyScores(season.seasonID),
    getSeasonSchedule(season.seasonID),
  ]);

  if (
    teamMatches.length === 0
    && mScratch.length === 0 && wScratch.length === 0 && handicap.length === 0
    && mScratchField.length === 0 && wScratchField.length === 0 && handicapField.length === 0
  ) {
    notFound();
  }

  const allWeeks = new Set<number>();
  weeklyScores.forEach((s) => allWeeks.add(s.week));
  schedule.forEach((s) => allWeeks.add(s.week));
  const maxRegularWeek = Math.max(0, ...Array.from(allWeeks));

  // Finals only: how many championships each finalist / qualifier has won
  // historically. Used to drop a trophy marker next to their name.
  const [teamWins, indivWins] = round === 2
    ? await Promise.all([getTeamChampionshipWins(), getIndividualChampionshipWins()])
    : [new Map<number, number>(), new Map<number, { MensScratch: number; WomensScratch: number; Handicap: number }>()];
  const winsByCategory = (cat: 'MensScratch' | 'WomensScratch' | 'Handicap') => {
    const out = new Map<number, number>();
    for (const [bowlerID, counts] of indivWins) {
      const n = counts[cat];
      if (n > 0) out.set(bowlerID, n);
    }
    return out;
  };

  const prevHref =
    round === 1
      ? `/week/${seasonSlug}/${maxRegularWeek}`
      : `/playoffs/${seasonSlug}/1`;
  const prevLabel = round === 1 ? `Week ${maxRegularWeek}` : 'Semifinals';
  const nextHref = round === 1 ? `/playoffs/${seasonSlug}/2` : null;
  const nextLabel = 'Finals';

  const topHighlight = round === 1 ? 4 : 1;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="mb-6">
        <div className="pb-5 border-b border-red-600/20">
          <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy">
            Season {strikeX(season.romanNumeral)}
          </h1>
          <p className="font-body text-sm text-navy/55 mt-1">
            {ROUND_LABEL[round]} &middot; {season.period} {season.year}
          </p>
        </div>

        <div className="flex items-center justify-between mt-4">
          <Link
            href={prevHref}
            className="flex items-center gap-1 text-sm font-body text-navy/65 hover:text-red-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {prevLabel}
          </Link>
          {nextHref ? (
            <Link
              href={nextHref}
              className="flex items-center gap-1 text-sm font-body text-navy/65 hover:text-red-600 transition-colors"
            >
              {nextLabel}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ) : <span />}
        </div>
      </div>

      {teamMatches.length > 0 && round === 2 && (
        <div className="mb-10">
          <div className="text-center mb-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-amber-700 font-heading mb-1">Championship Match</p>
            <h2 className="font-heading text-3xl md:text-4xl text-navy">The Final</h2>
          </div>
          {teamMatches.map((m) => (
            <TeamMatchCard
              key={m.playoffID}
              match={m}
              featured
              team1PriorWins={teamWins.get(m.team1ID) ?? 0}
              team2PriorWins={teamWins.get(m.team2ID) ?? 0}
            />
          ))}
        </div>
      )}

      {teamMatches.length > 0 && round === 1 && (
        <>
          <SectionHeading>Semifinals</SectionHeading>
          <div className="space-y-3 mb-8">
            {teamMatches.map((m) => <TeamMatchCard key={m.playoffID} match={m} />)}
          </div>
        </>
      )}

      <SectionHeading>Individual Brackets</SectionHeading>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BracketSection
          title={BRACKET_LABEL.MensScratch}
          results={mScratch}
          field={mScratchField}
          highlightTop={topHighlight}
          metric="scratch"
          isFinal={round === 2}
          priorWins={winsByCategory('MensScratch')}
        />
        <BracketSection
          title={BRACKET_LABEL.WomensScratch}
          results={wScratch}
          field={wScratchField}
          highlightTop={topHighlight}
          metric="scratch"
          isFinal={round === 2}
          priorWins={winsByCategory('WomensScratch')}
        />
        <BracketSection
          title={BRACKET_LABEL.Handicap}
          results={handicap}
          field={handicapField}
          highlightTop={topHighlight}
          metric="handicap"
          isFinal={round === 2}
          priorWins={winsByCategory('Handicap')}
        />
      </div>
    </main>
  );
}

function toWeeklyMatchScore(b: PlayoffPageBowler): WeeklyMatchScore {
  return {
    week: 0,
    matchDate: null,
    teamID: b.teamID ?? 0,
    teamName: '',
    teamSlug: '',
    bowlerID: b.bowlerID,
    bowlerName: b.bowlerName,
    bowlerSlug: b.slug,
    game1: b.game1,
    game2: b.game2,
    game3: b.game3,
    scratchSeries: b.scratchSeries,
    handSeries: b.handSeries,
    incomingAvg: b.incomingAvg,
    incomingHcp: b.incomingHcp,
    turkeys: b.turkeys ?? 0,
    gender: null,
    isFirstNight: false,
    priorBestGame: null,
    priorBestSeries: null,
    isPenalty: false,
  };
}

function teamHcpGame(bowlers: PlayoffPageBowler[], teamID: number, key: 'game1' | 'game2' | 'game3'): number {
  return bowlers
    .filter((b) => b.teamID === teamID)
    .reduce((sum, b) => sum + (b[key] ?? 0) + (b.incomingHcp ?? 0), 0);
}

function gameWinClass(myScore: number, oppScore: number): string {
  if (myScore === 0 && oppScore === 0) return '';
  if (myScore > oppScore) return 'text-amber-600 font-semibold';
  if (myScore < oppScore) return 'text-navy/65';
  return 'text-navy/80';
}

function TeamMatchCard({
  match,
  featured = false,
  team1PriorWins = 0,
  team2PriorWins = 0,
}: {
  match: PlayoffTeamMatch;
  featured?: boolean;
  team1PriorWins?: number;
  team2PriorWins?: number;
}) {
  const hasScores = match.bowlers.length > 0;

  const t1Bowlers = match.bowlers.filter((b) => b.teamID === match.team1ID);
  const t2Bowlers = match.bowlers.filter((b) => b.teamID === match.team2ID);
  const t1Mapped = t1Bowlers.map(toWeeklyMatchScore);
  const t2Mapped = t2Bowlers.map(toWeeklyMatchScore);
  const mvpID = findMatchMVP(t1Mapped, t2Mapped);
  const mvpBowler = [...t1Mapped, ...t2Mapped].find((b) => b.bowlerID === mvpID);

  const t1G1 = teamHcpGame(match.bowlers, match.team1ID, 'game1');
  const t1G2 = teamHcpGame(match.bowlers, match.team1ID, 'game2');
  const t1G3 = teamHcpGame(match.bowlers, match.team1ID, 'game3');
  const t2G1 = teamHcpGame(match.bowlers, match.team2ID, 'game1');
  const t2G2 = teamHcpGame(match.bowlers, match.team2ID, 'game2');
  const t2G3 = teamHcpGame(match.bowlers, match.team2ID, 'game3');

  const team1Won = match.winnerTeamID === match.team1ID;
  const team2Won = match.winnerTeamID === match.team2ID;

  const outerCls = featured
    ? 'bg-white border-2 border-amber-300 rounded-xl shadow-lg overflow-hidden ring-1 ring-amber-200/40'
    : 'bg-white border border-navy/10 rounded-lg shadow-sm overflow-hidden';
  const headerCls = featured ? 'px-5 py-4 bg-amber-50/60 border-b border-amber-200' : 'px-3 py-2 bg-navy/[0.02] border-b border-navy/10';
  const teamNameCls = featured ? 'font-heading text-lg md:text-xl' : '';
  const vsCls = featured ? 'text-amber-700 text-sm uppercase tracking-wider font-heading' : 'text-navy/40 text-xs uppercase tracking-wide';

  return (
    <div className={outerCls}>
      {!hasScores && (
        <div className={`flex items-center justify-between font-body ${headerCls}`}>
          <div className={`flex-1 min-w-0 truncate text-navy/70 ${teamNameCls}`}>
            <Link href={`/team/${match.team1Slug}`} className="hover:text-red-600 transition-colors">
              {match.team1Name}
            </Link>
            {featured && <TrophyMarker count={team1PriorWins} />}
          </div>
          <div className="tabular-nums text-center shrink-0 px-3 text-sm">
            <span className={vsCls}>vs</span>
          </div>
          <div className={`flex-1 min-w-0 truncate text-right text-navy/70 ${teamNameCls}`}>
            <Link href={`/team/${match.team2Slug}`} className="hover:text-red-600 transition-colors">
              {match.team2Name}
            </Link>
            {featured && <TrophyMarker count={team2PriorWins} />}
          </div>
        </div>
      )}

      {hasScores && (
        <>
          {/* Matchup summary - team hcp totals per game with winner highlighted */}
          <div className="bg-navy/[0.03] px-3 py-2">
            <table className="w-full text-xs font-body">
              <thead>
                <tr className="text-navy/65">
                  <th className="text-left font-normal py-0.5 w-[35%]"></th>
                  <th className="text-right font-normal py-0.5 pl-3 pr-2 border-l border-navy/10">G1</th>
                  <th className="text-right font-normal py-0.5 pl-3 pr-2 border-l border-navy/10">G2</th>
                  <th className="text-right font-normal py-0.5 pl-3 pr-2 border-l border-navy/10">G3</th>
                  <th className="text-right font-normal py-0.5 pl-3 pr-2">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-navy">
                  <td className={`py-0.5 ${team1Won ? 'font-semibold' : ''}`}>
                    <Link href={`/team/${match.team1Slug}`} className="hover:text-red-600 transition-colors">
                      {match.team1Name}
                    </Link>
                  </td>
                  <td className={`text-right tabular-nums py-0.5 pl-3 pr-2 border-l border-navy/10 ${gameWinClass(t1G1, t2G1)}`}>{t1G1 || '-'}</td>
                  <td className={`text-right tabular-nums py-0.5 pl-3 pr-2 border-l border-navy/10 ${gameWinClass(t1G2, t2G2)}`}>{t1G2 || '-'}</td>
                  <td className={`text-right tabular-nums py-0.5 pl-3 pr-2 border-l border-navy/10 ${gameWinClass(t1G3, t2G3)}`}>{t1G3 || '-'}</td>
                  <td className={`text-right tabular-nums py-0.5 pl-3 pr-2 font-semibold ${team1Won ? 'text-amber-600' : 'text-navy'}`}>{t1G1 + t1G2 + t1G3 || '-'}</td>
                </tr>
                <tr className="text-navy">
                  <td className={`py-0.5 ${team2Won ? 'font-semibold' : ''}`}>
                    <Link href={`/team/${match.team2Slug}`} className="hover:text-red-600 transition-colors">
                      {match.team2Name}
                    </Link>
                  </td>
                  <td className={`text-right tabular-nums py-0.5 pl-3 pr-2 border-l border-navy/10 ${gameWinClass(t2G1, t1G1)}`}>{t2G1 || '-'}</td>
                  <td className={`text-right tabular-nums py-0.5 pl-3 pr-2 border-l border-navy/10 ${gameWinClass(t2G2, t1G2)}`}>{t2G2 || '-'}</td>
                  <td className={`text-right tabular-nums py-0.5 pl-3 pr-2 border-l border-navy/10 ${gameWinClass(t2G3, t1G3)}`}>{t2G3 || '-'}</td>
                  <td className={`text-right tabular-nums py-0.5 pl-3 pr-2 font-semibold ${team2Won ? 'text-amber-600' : 'text-navy'}`}>{t2G1 + t2G2 + t2G3 || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {mvpBowler && (
            <div className="px-3 py-1.5 border-t border-navy/5 bg-navy/[0.02] text-xs font-body text-amber-800">
              <span className="text-navy/50">Bowler of the Match</span>{' '}
              <Link href={`/bowler/${mvpBowler.bowlerSlug}`} className="hover:text-red-600 transition-colors">
                {mvpBowler.bowlerName}
              </Link>
              <span className="text-navy/65 ml-1">{mvpBowler.handSeries}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
            <TeamBoxScore
              teamName={match.team1Name}
              teamSlug={match.team1Slug}
              bowlers={t1Mapped}
              mvpBowlerID={mvpID}
            />
            <TeamBoxScore
              teamName={match.team2Name}
              teamSlug={match.team2Slug}
              bowlers={t2Mapped}
              mvpBowlerID={mvpID}
            />
          </div>
        </>
      )}
    </div>
  );
}

function TrophyMarker({ count, tone = 'amber' }: { count: number; tone?: 'amber' | 'navy' }) {
  if (count <= 0) return null;
  const colorClass = tone === 'amber' ? 'text-amber-700' : 'text-navy/60';
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[0.8em] ${colorClass} ml-1.5 align-baseline`}
      title={count === 1 ? 'Prior champion' : `${count}-time champion`}
      aria-label={count === 1 ? 'prior champion' : `${count}-time champion`}
    >
      <span aria-hidden="true">🏆</span>
      {count > 1 && <span className="tabular-nums">×{count}</span>}
    </span>
  );
}

function BracketSection({
  title,
  results,
  field,
  highlightTop,
  metric,
  isFinal,
  priorWins,
}: {
  title: string;
  results: PlayoffScoresheetEntry[];
  field: PlayoffBracketParticipant[];
  highlightTop: number;
  metric: 'scratch' | 'handicap';
  isFinal?: boolean;
  priorWins?: Map<number, number>;
}) {
  const cardBorder = isFinal ? 'border-amber-300/50' : 'border-navy/10';
  const headingBg = isFinal ? 'bg-amber-50/70' : 'bg-navy/[0.02]';
  const headingBorder = isFinal ? 'border-amber-200/60' : 'border-navy/10';
  const nameHover = isFinal ? 'hover:text-amber-700' : 'hover:text-red-600';
  const nameAccent = isFinal ? 'text-amber-900' : 'text-navy';

  if (results.length === 0 && field.length === 0) {
    return (
      <div className={`bg-white border ${cardBorder} rounded-lg shadow-sm p-4`}>
        <h3 className="font-heading text-base text-navy mb-2">{title}</h3>
        <p className="font-body text-xs text-navy/50 italic">Field not yet set.</p>
      </div>
    );
  }

  const hasAnyScores = results.some(
    r => r.game1 != null || r.game2 != null || r.game3 != null,
  );

  // Upcoming: qualifiers set but no scores yet. Show preview list.
  if (!hasAnyScores) {
    return (
      <div className={`bg-white border ${cardBorder} rounded-lg shadow-sm overflow-hidden`}>
        <h3 className={`font-heading text-base text-navy px-4 py-2 border-b ${headingBorder} ${headingBg}`}>{title}</h3>
        <ol className={`px-4 py-3 space-y-1.5 list-decimal list-inside font-body text-sm font-medium ${nameAccent}`}>
          {field.map(p => (
            <li key={p.bowlerID}>
              <Link href={`/bowler/${p.slug}`} className={`${nameHover} transition-colors`}>
                {p.bowlerName}
              </Link>
              {isFinal && <TrophyMarker count={priorWins?.get(p.bowlerID) ?? 0} />}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  // Build the unified row list: every qualifier, plus any results that aren't
  // in the qualifier list (alternates). Sort by relevant series desc with
  // un-scored rows at the bottom in qualifier order.
  const resultByBowler = new Map(results.map(r => [r.bowlerID, r]));
  type Row = {
    bowlerID: number;
    bowlerName: string;
    slug: string;
    result: PlayoffScoresheetEntry | null;
    isAlternate: boolean;
    qualifierIndex: number;
  };
  const fieldIDs = new Set(field.map(p => p.bowlerID));
  const rows: Row[] = field
    .map((p, i) => ({
      bowlerID: p.bowlerID,
      bowlerName: p.bowlerName,
      slug: p.slug,
      result: resultByBowler.get(p.bowlerID) ?? null,
      isAlternate: false,
      qualifierIndex: i,
    }))
    // Hide qualifiers who didn't bowl. Only show people with at least one game.
    .filter(row => row.result !== null
      && (row.result.game1 != null || row.result.game2 != null || row.result.game3 != null));
  for (const r of results) {
    if (fieldIDs.has(r.bowlerID)) continue;
    if (r.game1 == null && r.game2 == null && r.game3 == null) continue;
    rows.push({
      bowlerID: r.bowlerID,
      bowlerName: r.bowlerName,
      slug: r.slug,
      result: r,
      isAlternate: true,
      qualifierIndex: Number.MAX_SAFE_INTEGER,
    });
  }
  const seriesOf = (r: PlayoffScoresheetEntry | null) =>
    r == null ? -1 : metric === 'handicap' ? r.handSeries : r.scratchSeries;
  rows.sort((a, b) => {
    const sa = seriesOf(a.result);
    const sb = seriesOf(b.result);
    if (sa !== sb) return sb - sa;
    return a.qualifierIndex - b.qualifierIndex;
  });

  return (
    <div className="bg-white border border-navy/10 rounded-lg shadow-sm overflow-hidden">
      <h3 className="font-heading text-base text-navy px-4 py-2 border-b border-navy/10 bg-navy/[0.02]">{title}</h3>
      <table className="w-full text-xs font-body tabular-nums">
        <thead>
          <tr className="text-navy/40 border-b border-navy/10">
            <th className="text-left py-1 px-3">Bowler</th>
            <th className="text-center py-1 px-1 w-10">G1</th>
            <th className="text-center py-1 px-1 w-10">G2</th>
            <th className="text-center py-1 px-1 w-10">G3</th>
            <th className="text-center py-1 px-1 w-12">{metric === 'handicap' ? 'HSeries' : 'Series'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const hasResult = row.result !== null;
            const highlight = hasResult && idx < highlightTop && !row.isAlternate;
            const series = seriesOf(row.result);
            return (
              <tr
                key={row.bowlerID}
                className={`border-t border-navy/5 ${highlight ? 'bg-amber-50' : ''}`}
              >
                <td className="text-left py-1 px-3 text-navy">
                  <Link href={`/bowler/${row.slug}`} className="hover:text-red-600 transition-colors">
                    {row.bowlerName}
                  </Link>
                  {row.isAlternate && (
                    <span className="ml-1 text-[10px] text-navy/40 italic">(alt)</span>
                  )}
                </td>
                <td className="text-center py-1 px-1 text-navy/80">{row.result?.game1 ?? '-'}</td>
                <td className="text-center py-1 px-1 text-navy/80">{row.result?.game2 ?? '-'}</td>
                <td className="text-center py-1 px-1 text-navy/80">{row.result?.game3 ?? '-'}</td>
                <td className={`text-center py-1 px-1 ${highlight ? 'font-semibold text-amber-900' : 'font-medium text-navy'}`}>
                  {series > 0 ? series : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
