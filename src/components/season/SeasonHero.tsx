import Link from 'next/link';
import type { Season, SeasonHeroStats, SeasonPlayoffBracket, PlayoffMatchup } from '@/lib/queries';
import { strikeX } from '@/components/ui/StrikeX';

/** Order matchup teams by regular-season seed (lower seed# = higher finish = top slot). */
function seededPair(m: PlayoffMatchup) {
  const wSeed = m.winnerSeed ?? 99;
  const lSeed = m.loserSeed ?? 99;
  // Higher seed (lower number) goes on top
  const winnerFirst = wSeed <= lSeed;
  const top = winnerFirst
    ? { name: m.winnerName, slug: m.winnerSlug, isWinner: true, seed: m.winnerSeed }
    : { name: m.loserName, slug: m.loserSlug, isWinner: false, seed: m.loserSeed };
  const bot = winnerFirst
    ? { name: m.loserName, slug: m.loserSlug, isWinner: false, seed: m.loserSeed }
    : { name: m.winnerName, slug: m.winnerSlug, isWinner: true, seed: m.winnerSeed };
  return { top, bot };
}

interface Props {
  season: Season;
  heroStats: SeasonHeroStats | null;
  bracket: SeasonPlayoffBracket | null;
}

function TeamLink({ name, slug, className }: { name: string; slug: string; className?: string }) {
  return (
    <Link
      href={`/team/${slug}`}
      className={`hover:text-red-600 transition-colors ${className ?? ''}`}
    >
      {name}
    </Link>
  );
}

function BracketTeamSlot({
  name,
  slug,
  seed,
  isWinner,
  isFinal,
}: {
  name: string;
  slug: string;
  seed?: number | null;
  isWinner: boolean;
  isFinal?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 text-xs font-body truncate
        ${isWinner
          ? isFinal
            ? 'bg-amber-50 font-bold text-navy'
            : 'bg-green-50/60 font-semibold text-navy'
          : 'text-navy/60'
        }`}
      style={{ height: 28 }}
    >
      {isFinal && isWinner && <span className="text-sm shrink-0">🏆</span>}
      <TeamLink name={name} slug={slug} className="truncate hover:text-red-600 transition-colors" />
    </div>
  );
}

interface BracketTeam {
  name: string;
  slug: string;
  isWinner: boolean;
  seed?: number | null;
}

function BracketMatchup({
  team1,
  team2,
  isFinal,
}: {
  team1: BracketTeam;
  team2: BracketTeam;
  isFinal?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded overflow-hidden border
        ${isFinal ? 'border-amber-300/50' : 'border-navy/15'}`}
      style={{ height: 56, minWidth: 150 }}
    >
      <BracketTeamSlot {...team1} isFinal={isFinal} />
      <div className={`border-t ${isFinal ? 'border-amber-200/60' : 'border-navy/10'}`} />
      <BracketTeamSlot {...team2} isFinal={isFinal} />
    </div>
  );
}

function PlayoffBracket({ bracket }: { bracket: SeasonPlayoffBracket }) {
  const TEAM_H = 28;
  const MATCHUP_H = TEAM_H * 2;
  const TOP = TEAM_H / 2;       // 14 — center of top team slot
  const BOT = TEAM_H + TEAM_H / 2; // 42 — center of bottom team slot
  const MID = MATCHUP_H / 2;    // 28 — vertical midpoint
  const CW = 28;                 // connector width
  const HALF = CW / 2;

  const connectorStroke = { stroke: '#1e293b', strokeOpacity: 0.15, strokeWidth: 2 };

  const s1 = seededPair(bracket.semi1!);
  const s2 = seededPair(bracket.semi2!);
  const fin = seededPair(bracket.final);

  return (
    <div className="inline-flex items-center overflow-x-auto pb-1">
      {/* Semi 1 — left side */}
      <BracketMatchup team1={s1.top} team2={s1.bot} />

      {/* Left connector ──┐ */}
      <svg width={CW} height={MATCHUP_H} className="shrink-0" aria-hidden="true">
        <line x1={0} y1={TOP} x2={HALF} y2={TOP} {...connectorStroke} />
        <line x1={0} y1={BOT} x2={HALF} y2={BOT} {...connectorStroke} />
        <line x1={HALF} y1={TOP} x2={HALF} y2={BOT} {...connectorStroke} />
        <line x1={HALF} y1={MID} x2={CW} y2={MID} {...connectorStroke} />
      </svg>

      {/* Championship — center */}
      <BracketMatchup team1={fin.top} team2={fin.bot} isFinal />

      {/* Right connector ┌── (mirrored) */}
      <svg width={CW} height={MATCHUP_H} className="shrink-0" aria-hidden="true">
        <line x1={CW} y1={TOP} x2={HALF} y2={TOP} {...connectorStroke} />
        <line x1={CW} y1={BOT} x2={HALF} y2={BOT} {...connectorStroke} />
        <line x1={HALF} y1={TOP} x2={HALF} y2={BOT} {...connectorStroke} />
        <line x1={0} y1={MID} x2={HALF} y2={MID} {...connectorStroke} />
      </svg>

      {/* Semi 2 — right side */}
      <BracketMatchup team1={s2.top} team2={s2.bot} />
    </div>
  );
}

function PlayoffResultsSimple({ bracket }: { bracket: SeasonPlayoffBracket }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-sm font-body">
        <span className="text-navy/40 text-xs w-12 shrink-0">Final</span>
        <TeamLink name={bracket.final.winnerName} slug={bracket.final.winnerSlug} className="font-semibold text-navy" />
        <span className="text-navy/30">def.</span>
        <TeamLink name={bracket.final.loserName} slug={bracket.final.loserSlug} className="text-navy/60" />
      </div>
      {(bracket.semi1 || bracket.semi2) && (
        <div className="flex items-center gap-2 text-sm font-body">
          <span className="text-navy/40 text-xs w-12 shrink-0">Semis</span>
          {bracket.semi1 && (
            <TeamLink name={bracket.semi1.loserName} slug={bracket.semi1.loserSlug} className="text-navy/60" />
          )}
          {bracket.semi1 && bracket.semi2 && <span className="text-navy/20">&middot;</span>}
          {bracket.semi2 && (
            <TeamLink name={bracket.semi2.loserName} slug={bracket.semi2.loserSlug} className="text-navy/60" />
          )}
        </div>
      )}
    </div>
  );
}

function PlayoffResults({ bracket }: { bracket: SeasonPlayoffBracket }) {
  const hasFullBracket = bracket.semi1?.winnerName && bracket.semi2?.winnerName;

  return (
    <div className="mt-6">
      <div className="text-[0.65rem] uppercase tracking-wider font-heading text-navy/40 mb-3">
        Playoff Bracket
      </div>
      {hasFullBracket ? (
        <PlayoffBracket bracket={bracket} />
      ) : (
        <PlayoffResultsSimple bracket={bracket} />
      )}
    </div>
  );
}

export function SeasonHero({ season, heroStats, bracket }: Props) {
  return (
    <section className="relative pb-8 border-b border-red-600/20">
      <div>
        <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy">
          Season {strikeX(season.romanNumeral)}
        </h1>
        <p className="font-body text-lg text-navy/60 mt-1">
          {season.period} {season.year}
        </p>
      </div>

      {bracket ? (
        <PlayoffResults bracket={bracket} />
      ) : (
        heroStats?.champion && (
          <div className="flex flex-wrap items-start gap-2 mt-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-navy/5 rounded-full text-sm font-body text-navy">
              <span className="text-navy/50">Champion</span>
              <span className="font-semibold">{heroStats.champion}</span>
            </span>
          </div>
        )
      )}
    </section>
  );
}
