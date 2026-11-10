import { cloneElement, isValidElement } from 'react';
import Link from 'next/link';
import type { BowlerWrapped, WrappedWeek } from '@/lib/views/bowler-wrapped';
import { ANIMAL_SILHOUETTES } from './animal-silhouettes';
import { TurkeyParade } from './TurkeyParade';
import { PinParade } from './PinParade';
import { getMinGamesForWeek } from '@/lib/queries/seasons/standings';
import type { BowlerCareerSummary } from '@/lib/queries';
import { fmt, ordinal, animalWeight, stackedFeet, peakComparison, rankPhrase, nearestMilestone, timeSince } from '@/lib/wrapped-text';
import { PatchBadge } from '@/components/ui/PatchBadge';
import { ShareButton } from '@/components/bowler/ShareButton';
import { strikeX } from '@/components/ui/StrikeX';
import { WrappedCard, BigNumber, Headline, Muted, type CardTone, Divider } from './WrappedCard';
import { RankLadder } from './RankLadder';
import { formatMatchDate } from '@/lib/bowling-time';

interface Props {
  w: BowlerWrapped;
  career: BowlerCareerSummary | null;
  shareUrl: string;
  /** True when the recap is for an earlier season than the league's latest. */
  past?: boolean;
}

const PATCH_LABEL: Record<string, string> = {
  botw: 'Bowler of the Week', highGame: 'Weekly High Game', highSeries: 'Weekly High Series',
  aboveAvg: 'Above average all three games', threeOfAKind: 'Three of a kind', perfectGame: 'Perfect game',
  playoff: 'Team playoffs', scratchPlayoff: 'Scratch playoffs', hcpPlayoff: 'Handicap playoffs',
  champion: 'Champion', scratchChampion: 'Scratch champion', hcpChampion: 'Handicap champion',
  turkeyTrophy: 'Turkey Trophy', attendance: 'Like Clockwork', captain: 'Team captain',
};

const MILESTONE_NOUN: Record<string, string> = {
  totalGames: 'career games', totalPins: 'career pins', games200Plus: '200 games',
  series600Plus: '600 series', totalTurkeys: 'career turkeys',
};

const firstName = (name: string) => name.split(' ')[0];
const games = (wk: WrappedWeek) => [wk.game1, wk.game2, wk.game3];

function Scoreline({ wk, tone }: { wk: WrappedWeek; tone: CardTone }) {
  const dim = tone === 'navy' || tone === 'red' ? 'text-cream/80' : 'text-navy/70';
  return (
    <div className="flex items-baseline gap-4 font-heading tabular-nums">
      {games(wk).map((g, i) => (
        <span key={i} className="text-3xl sm:text-4xl">{g ?? <span className={dim}>&ndash;</span>}</span>
      ))}
      <span className={`text-lg ${dim}`}>=</span>
      <span className="text-4xl sm:text-5xl">{wk.scratchSeries}</span>
    </div>
  );
}

const ARCHETYPE_LINE: Record<string, string> = {
  'Fast Starter': 'You came out hot in game one',
  'Middle Child': 'You peaked in game two',
  'Late Bloomer': 'You saved your best for game three',
  'Flatliner': 'Steady across all three games',
};

/** This season's game 1/2/3 averages as the bowler page draws them: your line against the league's, normalized to each average. */
function SlotProfileBlock({ p, ts }: { p: BowlerWrapped['slotProfile'] & {}; ts: string }) {
  const mine = [p.avg1, p.avg2, p.avg3];
  const overall = (p.avg1 + p.avg2 + p.avg3) / 3;
  const norm = mine.map(v => v / overall);
  const lg = p.league ? (() => { const o = (p.league.avg1 + p.league.avg2 + p.league.avg3) / 3; return [p.league.avg1 / o, p.league.avg2 / o, p.league.avg3 / o]; })() : null;
  const all = [...norm, ...(lg ?? [])];
  const min = Math.min(...all), max = Math.max(...all), range = max - min || 0.01;
  const W = 320, H = 120, padX = 28, padTop = 26, padBot = 24;
  const x = (i: number) => padX + (i / 2) * (W - padX * 2);
  const y = (v: number) => padTop + (H - padTop - padBot) - ((v - min) / range) * (H - padTop - padBot);
  const path = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <div>
      <p className="font-heading text-3xl leading-tight">{p.archetype}</p>
      <Muted tone="cream" className="mt-1">{ARCHETYPE_LINE[p.archetype]} {ts}.</Muted>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm h-auto mt-4" role="img" aria-label="Average by game against the league">
        {lg && <path d={path(lg)} fill="none" stroke="currentColor" strokeOpacity={0.6} strokeWidth={2} strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" />}
        <path d={path(norm)} fill="none" className="text-red" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {norm.map((v, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(v)} r={i + 1 === p.bestGame && p.archetype !== 'Flatliner' ? 6 : 4} className="text-red" fill="currentColor" />
            <text x={x(i)} y={y(v) - 11} textAnchor="middle" fontSize={13} fontWeight={600} fill="currentColor" fontFamily="var(--font-body)">{Math.round(mine[i])}</text>
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill="currentColor" fontFamily="var(--font-body)">Game {i + 1}</text>
          </g>
        ))}
      </svg>
      {lg && <Muted tone="cream" className="mt-2">Dashed line: the league {ts}.</Muted>}
    </div>
  );
}

/** Every night of the season as a bar, the best one lit. */
function NightBars({ weeks, best }: { weeks: WrappedWeek[]; best: WrappedWeek }) {
  const nights = weeks.filter(w => w.scratchSeries != null);
  if (nights.length < 2) return null;
  const vals = nights.map(w => w.scratchSeries as number);
  const min = Math.min(...vals), max = Math.max(...vals), span = Math.max(1, max - min);
  return (
    <div className="mt-8 flex items-end gap-2 h-24" role="img" aria-label="Series by night">
      {nights.map(w => {
        const isBest = w === best;
        const pct = 30 + (((w.scratchSeries as number) - min) / span) * 70;
        return (
          <div key={w.week} className="flex-1 flex flex-col items-center justify-end h-full">
            <span className={`font-body text-[11px] tabular-nums mb-1 ${isBest ? 'text-navy font-semibold' : 'text-navy/70'}`}>{w.scratchSeries}</span>
            <div className={`w-full rounded-t ${isBest ? 'bg-amber-600' : 'bg-navy/25'}`} style={{ height: `${pct}%` }} />
            <span className="font-body text-[10px] text-navy/70 mt-1">W{w.week}</span>
          </div>
        );
      })}
    </div>
  );
}

/** The PIN sentence: what a blind 199 in the bowler's spot would have cost the team that night. */
function PinLine({ pin }: { pin: NonNullable<BowlerWrapped['bestNightContext']>['pin'] & {} }) {
  if (pin.pin > 0) {
    const tied = pin.tiedWith > 0 ? 'tied for ' : '';
    const swing = pin.rank === 1
      ? `${tied}the biggest impact of anyone in the league`
      : `${tied}the ${ordinal(pin.rank)} biggest impact of the ${pin.field} bowlers who rolled`;
    return <>If you didn't show up, your team gets {pin.pin} fewer {pin.pin === 1 ? 'point' : 'points'} that night. {swing[0].toUpperCase() + swing.slice(1)}.</>;
  }
  if (pin.pin === 0) return <>If you didn't show up, your team gets the same points that night. Call it a team effort.</>;
  return <>If you didn't show up, your team gets {Math.abs(pin.pin)} more {pin.pin === -1 ? 'point' : 'points'} that night. It happens.</>;
}

/** Every game of the season as a thin bar in night order, the high game lit. */
function GameBars({ weeks, best }: { weeks: WrappedWeek[]; best: { week: number; gameNo: 1 | 2 | 3 } }) {
  const all = weeks.flatMap(w => ([[w.game1, 1], [w.game2, 2], [w.game3, 3]] as Array<[number | null, 1 | 2 | 3]>)
    .filter((g): g is [number, 1 | 2 | 3] => g[0] != null)
    .map(([score, gameNo]) => ({ week: w.week, gameNo, score })));
  if (all.length < 2) return null;
  const min = Math.min(...all.map(g => g.score)), max = Math.max(...all.map(g => g.score)), span = Math.max(1, max - min);
  return (
    <div className="mt-8 flex items-end gap-[3px] h-20" role="img" aria-label="Every game">
      {all.map(g => {
        const isBest = g.week === best.week && g.gameNo === best.gameNo;
        return (
          <div
            key={`${g.week}-${g.gameNo}`}
            className={`flex-1 rounded-t ${isBest ? 'bg-red-light' : 'bg-cream/30'}`}
            style={{ height: `${25 + ((g.score - min) / span) * 75}%` }}
            title={`Week ${g.week}, game ${g.gameNo}: ${g.score}`}
          />
        );
      })}
    </div>
  );
}

/** Steady to mercurial: a track with the bowler's marker and a faint tick at the league median. */
function SteadinessLine({ percentile }: { percentile: number }) {
  const x = Math.max(2, Math.min(98, percentile));
  return (
    <div className="mt-2">
      <div className="flex justify-between font-body text-xs uppercase tracking-[0.2em] text-navy/70">
        <span>Steady</span><span>Mercurial</span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-navy/10">
        <span className="absolute top-[-4px] bottom-[-4px] w-px bg-navy/30" style={{ left: '50%' }} aria-hidden />
        <span
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red border-2 border-white shadow"
          style={{ left: `${x}%` }}
          role="img"
          aria-label={`${percentile} of 100 on the steady to mercurial line`}
        />
      </div>
      <p className="mt-1 text-center font-body text-[10px] text-navy/60">league median</p>
    </div>
  );
}

/**
 * The season as a bowling scoresheet: one frame per league night with the
 * series written in and the week number in the corner box, a missed night left
 * blank, and the season's pins in the wide total box at the end.
 */
function ScoresheetStrip({ weeks, weekCount, pins }: { weeks: WrappedWeek[]; weekCount: number; pins: number }) {
  const byWeek = new Map(weeks.map(w => [w.week, w]));
  const frames = Array.from({ length: Math.min(10, Math.max(weekCount, ...weeks.map(w => w.week))) }, (_, i) => i + 1);
  return (
    <div className="mt-8" role="img" aria-label="Season scoresheet">
      <div className="flex border border-cream/70 rounded-sm font-heading tabular-nums">
        {frames.map(n => {
          const wk = byWeek.get(n);
          return (
            <div key={n} className="relative flex-1 min-w-0 h-16 sm:h-20 border-r border-cream/70">
              <span className="absolute top-0 right-0 w-4 h-4 sm:w-5 sm:h-5 border-l border-b border-cream/70 flex items-center justify-center font-body text-[8px] sm:text-[9px] text-cream/80">{n}</span>
              <span className="absolute inset-x-0 bottom-2 text-center text-base sm:text-xl">
                {wk?.scratchSeries ?? ''}
              </span>
            </div>
          );
        })}
        <div className="relative flex-none w-16 sm:w-20 h-16 sm:h-20 bg-cream/10">
          <span className="absolute top-1 left-0 right-0 text-center font-body text-[8px] sm:text-[9px] uppercase tracking-widest text-cream/80">Total</span>
          <span className="absolute inset-x-0 bottom-2 text-center text-lg sm:text-2xl">{fmt(pins)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * A slow gold sheen sweeping across the text, for the song that was number one
 * the night a bowler started. Pure CSS; still for reduced motion.
 */
function Shimmer({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-semibold text-cream bg-clip-text motion-safe:text-transparent motion-safe:[animation:shimmer_4.5s_ease-in-out_infinite]"
      style={{
        backgroundImage: 'linear-gradient(110deg, #FFFBF2 0%, #FFFBF2 38%, #FDE68A 47%, #FFFFFF 50%, #FDE68A 53%, #FFFBF2 62%, #FFFBF2 100%)',
        backgroundSize: '250% 100%',
      }}
    >
      {children}
      <style>{`@keyframes shimmer { 0% { background-position: 120% 0; } 100% { background-position: -130% 0; } }`}</style>
    </span>
  );
}

/** Row of animal silhouettes, one per animal, sized so the herd fits the card width. */
function AnimalPictogram({ count, animalKey, name }: { count: number; animalKey: string; name: string }) {
  const sil = ANIMAL_SILHOUETTES[animalKey];
  if (!sil) return null;
  const maxH = 5.5;
  return (
    <div className="mt-8 flex items-end gap-3 text-cream" role="img" aria-label={`${count} ${name}`}>
      {Array.from({ length: count }, (_, i) => (
        <svg
          key={i}
          viewBox={sil.viewBox}
          className="block h-auto"
          style={{ width: `calc((100% - ${(count - 1) * 0.75}rem) / ${count})`, maxWidth: `${maxH * sil.aspect}rem` }}
          aria-hidden
          dangerouslySetInnerHTML={{ __html: sil.body }}
        />
      ))}
    </div>
  );
}

/** Closing line for the Nights card: where the career night count stands, and what one more night would do. */
function CareerNightsLine({ r, mine }: { r: BowlerWrapped['careerNightsRank']; mine: number }) {
  const place = `${r.tiedWith > 0 ? 'tied for ' : ''}${ordinal(r.rank)}`;
  const nightsWord = (n: number) => (n === 1 ? 'night' : 'nights');
  if (r.rank === 1) {
    return (
      <>
        Nobody has bowled more league nights than you.
        {r.below && <> {r.below.bowlerName} is {fmt(mine - r.below.nights)} {nightsWord(mine - r.below.nights)} back.</>}
      </>
    );
  }
  const standing = <>That puts you {place} of the {fmt(r.total)} bowlers who have ever rolled with us.</>;
  if (r.rankAfterOneMore < r.rank) {
    return <>{standing} One more night would move you to {ordinal(r.rankAfterOneMore)}, if everyone else stays home.</>;
  }
  const gap = r.above ? r.above.nights - mine : 0;
  return (
    <>
      {standing}
      {r.above && <> {r.above.bowlerName} is {fmt(gap)} {nightsWord(gap)} ahead of you for {ordinal(r.above.rank)}.</>}
    </>
  );
}

/** Everyone whose first night was the same night, or a note that nobody else was new. */
function FirstNightClassmates({ classmates }: { classmates: BowlerWrapped['firstNightClassmates'] }) {
  const cls = 'mt-4 font-body text-base sm:text-lg leading-relaxed text-cream/80';
  if (classmates.length === 0) return <p className={cls}>You were the only new bowler that night (and also the best one).</p>;
  return (
    <p className={cls}>
      {classmates.length === 1 ? <>One other bowler started that same night: </> : <>{fmt(classmates.length)} other bowlers started that same night: </>}
      {classmates.map((c, i) => (
        <span key={c.bowlerID}>
          {i > 0 && ', '}
          <Link href={`/bowler/${c.slug}`} prefetch={false} className="text-cream underline underline-offset-4 decoration-cream/60 hover:text-red-light transition-colors">
            {c.bowlerName}
          </Link>
        </span>
      ))}
      .
    </p>
  );
}

/** Tiny line of the incoming average across the season. */
function AvgSparkline({ weeks }: { weeks: WrappedWeek[] }) {
  const pts = weeks.filter(w => w.incomingAvg != null).map(w => ({ x: w.week, y: w.incomingAvg as number }));
  if (pts.length < 2) return null;
  const W = 320, H = 90, pad = 8;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys) - 2, maxY = Math.max(...ys) + 2;
  const sx = (x: number) => pad + ((x - minX) / Math.max(1, maxX - minX)) * (W - pad * 2);
  const sy = (y: number) => H - pad - ((y - minY) / Math.max(1, maxY - minY)) * (H - pad * 2);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm h-auto mt-6" role="img" aria-label="Average by week">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(p => <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={4} fill="currentColor" />)}
    </svg>
  );
}

/** All of the bowler's seasons as bars, oldest first, this one highlighted. */
function SeasonBars({ w }: { w: BowlerWrapped }) {
  const avgs = w.seasons.map(s => s.average);
  const min = Math.min(...avgs), max = Math.max(...avgs);
  const span = Math.max(1, max - min);
  return (
    <div className="mt-8">
      <div className="flex items-end gap-[3px] h-28">
        {w.seasons.map(s => {
          const isThis = s.seasonID === w.season.seasonID;
          const pct = 25 + ((s.average - min) / span) * 75;
          return (
            <div
              key={s.seasonID}
              title={`Season ${s.romanNumeral}: ${s.average.toFixed(1)}`}
              className={`flex-1 rounded-t-sm ${isThis ? 'bg-red-light' : 'bg-cream/70'}`}
              style={{ height: `${pct}%` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-2 font-body text-xs text-cream/80">
        <span>Season {w.seasons[0]?.romanNumeral}</span>
        <span>Season {w.seasons[w.seasons.length - 1]?.romanNumeral}</span>
      </div>
    </div>
  );
}

export function SeasonWrapped({ w, career, shareUrl, past = false }: Props) {
  const name = firstName(w.bowlerName);
  const season = `Season ${w.season.romanNumeral}`;
  // A past recap follows career cards that name other seasons, so it says which one every time.
  const ts = past ? `in ${season}` : 'this season';
  const cards: React.ReactNode[] = [];

  // 1. Cover
  cards.push(
    <WrappedCard tone="navy" key="cover">
      <div className="mb-8">
        <p className="text-xs sm:text-sm font-body font-semibold uppercase tracking-[0.25em] text-cream/85">Splitzkrieg Bowling League</p>
        <span className="block w-10 h-0.5 mt-2 bg-red-light" />
      </div>
      <h1 className="font-heading text-6xl sm:text-8xl leading-none">{w.bowlerName}</h1>
      <p className="mt-4 text-sm sm:text-base font-body font-semibold uppercase tracking-[0.25em] text-cream/85">Frame by Frame</p>
      <p className="mt-1.5 text-sm sm:text-base font-body font-semibold uppercase tracking-[0.25em] text-cream/85">
        Season {strikeX(w.season.romanNumeral)} &middot; {w.season.displayName}
      </p>
      {w.nights > 0
        ? <ScoresheetStrip weeks={w.weeks} weekCount={w.season.weekCount ?? Math.max(9, ...w.weeks.map(x => x.week))} pins={w.pins} />
        : (w.tenure.firstNight && w.tenure.lastNight && (
          <Muted tone="navy" className="mt-8">
            {formatMatchDate(w.tenure.firstNight, { year: 'numeric' })} to {formatMatchDate(w.tenure.lastNight, { year: 'numeric' })}, {w.seasons.length} {w.seasons.length === 1 ? 'season' : 'seasons'}, {fmt(w.tenure.careerNights)} nights.
          </Muted>
        ))}
      <div className="absolute inset-x-0 bottom-2 flex justify-center text-cream/80" aria-hidden>
        <svg width="32" height="32" viewBox="0 0 40 40" className="motion-safe:animate-bounce">
          <path d="M8 12l12 12 12-12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 22l12 12 12-12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
        </svg>
      </div>
    </WrappedCard>,
  );

  // 1a. Seasons
  const firstNightText = w.tenure.firstNight
    ? formatMatchDate(w.tenure.firstNight, { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  cards.push(
    <WrappedCard tone="navy" eyebrow="Seasons" key="seasons">
      <Headline>
        {w.seasons.length > 1 ? <>You joined in Season {w.seasons[0].romanNumeral}.</> : <>This is your first season.</>}
      </Headline>
      <Muted tone="navy" className="mt-6">
        This is the {ordinal(w.leagueSeasonCount)} season of the league.
        {firstNightText && <> Your first bowling night was {firstNightText}.</>}
      </Muted>
      {(w.firstNightFilm || w.firstNightCulture) && (
        <Muted tone="navy" className="mt-4">
          {w.firstNightFilm && <>That weekend <em>{w.firstNightFilm}</em> was number one at the box office</>}
          {w.firstNightFilm && w.firstNightCulture && <>, and </>}
          {!w.firstNightFilm && w.firstNightCulture && <>That week </>}
          {w.firstNightCulture && <><Shimmer>&ldquo;{w.firstNightCulture.song}&rdquo; by {w.firstNightCulture.artist}</Shimmer> topped the Hot 100</>}.
        </Muted>
      )}
      <FirstNightClassmates classmates={w.firstNightClassmates} />
    </WrappedCard>,
  );

  // 1b. Nights
  const att = w.attendance;
  const lastNightText = w.tenure.lastNight
    ? formatMatchDate(w.tenure.lastNight, { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const missed = w.tenure.lastNight != null && (Date.now() - new Date(w.tenure.lastNight).getTime()) > 365 * 24 * 3600 * 1000;
  cards.push(
    <WrappedCard tone="cream" eyebrow="Nights" key="nights">
      <Headline>
        {w.nights > 0
          ? <>You bowled {w.nights} {w.nights === 1 ? 'night' : 'nights'} {past ? <>in the last season you bowled, {season}</> : 'this season'}.</>
          : <>Your last night on the lanes was {lastNightText}.</>}
      </Headline>
      {w.nights > 0 && lastNightText && (
        <Muted tone="cream" className="mt-6">Your last night on the lanes was {lastNightText}.</Muted>
      )}
      {missed && (
        <Muted tone="cream" className="mt-6">You are missed.</Muted>
      )}
      {w.tenure.leagueNightsSinceFirst > w.nights ? (
        <Muted tone="cream" className="mt-4">
          Since your first night the league has bowled {fmt(w.tenure.leagueNightsSinceFirst)} nights, and you were there for {fmt(w.tenure.careerNights)} of them
          {att.pctBowlersBelow != null && att.pctBowlersBelow >= 50
            ? <>, more than {att.pctBowlersBelow}% of the bowlers who have come through in that time.</>
            : att.pctOfNights != null ? <>, {att.pctOfNights}% of the nights there were.</> : <>.</>}
        </Muted>
      ) : (
        <Muted tone="cream" className="mt-4">
          Out of {w.season.weekCount ?? w.nights} league nights {ts}
          {att.pctOfNights != null && <>, you were on the lanes {att.pctOfNights}% of the time since you joined</>}.
        </Muted>
      )}
      {att.longestStreak && att.longestStreak.length >= 3 && (
        <Muted tone="cream" className="mt-4">
          Your longest run without missing a night: {att.longestStreak.length} straight,
          {' '}{formatMatchDate(att.longestStreak.from, { month: 'long', year: 'numeric' })} to {formatMatchDate(att.longestStreak.to, { month: 'long', year: 'numeric' })}.
          {att.currentStreak >= 3 && att.currentStreak !== att.longestStreak.length && <> You are on a {att.currentStreak}-night streak right now.</>}
          {att.currentStreak >= 3 && att.currentStreak === att.longestStreak.length && <> That streak is alive right now.</>}
        </Muted>
      )}
      <Muted tone="cream" className="mt-4">
        <CareerNightsLine r={w.careerNightsRank} mine={w.tenure.careerNights} />
      </Muted>
    </WrappedCard>,
  );

  // 2. Pins
  const beast = animalWeight(w.pins);
  const stack = stackedFeet(w.pins);
  if (w.nights > 0) cards.push(
    <WrappedCard tone="red" eyebrow={`Pins ${ts}`} key="pins">
      <div className="flex items-baseline gap-3 flex-wrap">
        <BigNumber>{fmt(w.pins)}</BigNumber>
        <span className="font-heading text-2xl sm:text-3xl text-cream/85 tabular-nums whitespace-nowrap">/ {w.games} games</span>
      </div>
      <Muted tone="red" className="mt-4">{rankPhrase(w.ranks.pins.rank, w.ranks.pins.field)}.</Muted>
      <AnimalPictogram count={beast.count} animalKey={beast.animal.key} name={beast.animal.name} />
      <p className="font-heading text-3xl leading-tight mt-4">
        {beast.weightText} of maple, {beast.phrase}.
      </p>
      <Muted tone="red" className="mt-3">
        Stacked base to crown they would stand {fmt(stack)} feet: {peakComparison(stack)}.
      </Muted>
      <RankLadder ranked={w.ranks.pins} you={w.bowlerName} tone="red" />
    </WrappedCard>,
  );

  // 3. Average arc
  const climbed = w.startingAvg != null && w.endingAvg != null ? w.endingAvg - w.startingAvg : null;
  if (w.nights > 0) cards.push(
    <WrappedCard tone="cream" eyebrow="Your average" key="avg">
      <BigNumber>{w.average.toFixed(1)}</BigNumber>
      {w.startingAvg != null && w.endingAvg != null && (
        <Muted tone="cream" className="mt-4">
          You walked in at {w.startingAvg} and walked out at {w.endingAvg}
          {climbed != null && climbed !== 0 && <>, {climbed > 0 ? 'up' : 'down'} {Math.abs(climbed)} pins of book average</>}.
        </Muted>
      )}
      <div className="text-red"><AvgSparkline weeks={w.weeks} /></div>
      <RankLadder ranked={w.ranks.average} you={w.bowlerName} tone="cream" format={v => v.toFixed(1)} />
      {w.debut && w.debut.rank > 0 && (
        <>
          <Divider tone="cream" />
          <Headline>
            {w.debut.rank === 1
              ? <>The best debut season anyone has ever bowled here.</>
              : <>The {ordinal(w.debut.rank)} best debut season in league history.</>}
          </Headline>
          <Muted tone="cream" className="mt-3">Among the {fmt(w.debut.field)} first seasons with at least {getMinGamesForWeek(w.weeks[w.weeks.length - 1]?.week ?? 9)} games.</Muted>
          <RankLadder ranked={w.debut} you={w.bowlerName} tone="cream" format={v => v.toFixed(1)} />
        </>
      )}

    </WrappedCard>,
  );

  // 4. Among your own seasons
  if (w.ownSeasons.total > 1 && w.ownSeasons.rank > 0) {
    const o = w.ownSeasons;
    cards.push(
      <WrappedCard tone="navy" eyebrow="Among your seasons" key="own">
        <Headline>{past ? <>{season} was your {ordinal(o.rank)} best season of {o.total}.</> : <>Your {ordinal(o.rank)} best season of {o.total}.</>}</Headline>
        <Muted tone="navy" className="mt-6">
          {o.bestSince && <>Your best since Season {o.bestSince.romanNumeral} ({o.bestSince.average.toFixed(1)}). </>}
          {o.previous && (
            <>
              {past ? `In Season ${o.previous.romanNumeral} you averaged` : 'Last season you averaged'} {o.previous.average.toFixed(1)}
              {w.average >= o.previous.average
                ? <>, so that is {(w.average - o.previous.average).toFixed(1)} pins better.</>
                : <>, {(o.previous.average - w.average).toFixed(1)} pins ahead of {past ? season : 'this one'}.</>}
            </>
          )}
        </Muted>
        <SeasonBars w={w} />
      </WrappedCard>,
    );
  }

  // 4b. Your style
  if (w.style && w.nights > 0) {
    const st = w.style;
    const ab = st.aboveBelow;
    const total = ab.above + ab.below + ab.even;
    const steadierPct = 100 - st.variationPercentile;
    const steadyLine = st.variationPercentile <= 50
      ? `Steadier than ${steadierPct}% of the league.`
      : `More mercurial than ${st.variationPercentile}% of the league.`;
    cards.push(
      <WrappedCard tone="cream" eyebrow="Your style" key="style">
        {w.slotProfile && <SlotProfileBlock p={w.slotProfile} ts={ts} />}
        {w.slotProfile && <Divider tone="cream" />}
        <SteadinessLine percentile={st.variationPercentile} />
        <Muted tone="cream" className="mt-4">
          Your games wandered {st.variation.toFixed(1)}% from your average. {steadyLine}
        </Muted>
      </WrappedCard>,
    );
    // Impact is about the season just played; a past recap skips it.
    if (!past) cards.push(
      <WrappedCard tone="cream" eyebrow="Your impact" key="impact" compact>
        <div className="flex items-baseline gap-6 font-heading tabular-nums">
          <span><span className="text-5xl">{ab.above}</span><span className="font-body text-base text-navy/70"> above</span></span>
          <span><span className="text-5xl">{ab.below}</span><span className="font-body text-base text-navy/70"> below</span></span>
        </div>
        <Muted tone="cream" className="mt-3">
          {total === w.games ? <>Of your {total} games</> : <>Of the {total} games you bowled carrying a book average</>}, {ab.above} came in above your {ab.basis === 'book' ? 'average going in' : 'season average'} and {ab.below} below{ab.even > 0 && <>, with {ab.even} dead on it</>}.
        </Muted>
        {st.impact.rank > 0 && (
          <>
            <Divider tone="cream" />
            <p className="font-heading text-3xl leading-tight">
              {st.impact.total > 0 && <>Your team would have lost {st.impact.total} {st.impact.total === 1 ? 'point' : 'points'} {ts} if you didn't show up.</>}
              {st.impact.total === 0 && <>Your team would have taken the same points {ts} without you. Call it a team effort.</>}
              {st.impact.total < 0 && <>A blind 199 would have earned your team {Math.abs(st.impact.total)} more {st.impact.total === -1 ? 'point' : 'points'} {ts}. It happens.</>}
            </p>
          </>
        )}
      </WrappedCard>,
    );
  }

  // 5. Best night
  if (w.bestNight) {
    const b = w.bestNight;
    const ctx = w.bestNightContext;
    const won = b.teamGamePts != null && b.oppGamePts != null ? b.teamGamePts > b.oppGamePts : null;
    cards.push(
      <WrappedCard tone="gold" eyebrow="Your best night" key="best">
        <Headline>Week {b.week}{b.opponentName && <> vs {b.opponentName}</>}</Headline>
        <div className="mt-6"><Scoreline wk={b} tone="gold" /></div>
        <NightBars weeks={w.weeks} best={b} />
        {ctx && (
          <Muted tone="gold" className="mt-6">
            {ctx.otherNightsAvg != null && ctx.otherNightsAvg < (b.scratchSeries ?? 0) && (
              <>Your other nights {ts} averaged {ctx.otherNightsAvg}, so this one was {(b.scratchSeries ?? 0) - ctx.otherNightsAvg} pins better. </>
            )}
            {ctx.careerNights > 1 && (ctx.careerRank === 1
              ? <>The best night of your career.</>
              : <>Your {ordinal(ctx.careerRank)} best night of the {fmt(ctx.careerNights)} you have bowled.</>)}
          </Muted>
        )}
        <Muted tone="gold" className="mt-4">
          {b.scratchSeries === b.teamBestSeries && b.handSeries === b.teamBestHandSeries && <>Top scratch and handicap series on your team that night. </>}
          {b.scratchSeries === b.teamBestSeries && b.handSeries !== b.teamBestHandSeries && <>Top scratch series on your team that night. </>}
          {b.scratchSeries !== b.teamBestSeries && b.handSeries != null && b.handSeries === b.teamBestHandSeries && <>Top handicap series on your team that night. </>}
          {won === true && b.teamGamePts != null && <>Your team won the match {b.teamGamePts} to {b.oppGamePts}. </>}
          {won === false && b.teamGamePts != null && <>Your team dropped the match {b.teamGamePts} to {b.oppGamePts}, not for lack of trying. </>}
          {ctx?.pin && <PinLine pin={ctx.pin} />}
        </Muted>
      </WrappedCard>,
    );
  }

  // 5b. Best game
  if (w.highGame && w.highGameContext) {
    const g = w.highGame;
    const gx = w.highGameContext;
    const night = w.weeks.find(wk => wk.week === g.week);
    const nightDate = night?.matchDate ?? null;
    cards.push(
      <WrappedCard tone="navy" eyebrow="Your best game" key="bestgame">
        <BigNumber>{g.score}</BigNumber>
        <Muted tone="navy" className="mt-4">
          Game {g.gameNo}, week {g.week}{night?.opponentName && <> vs {night.opponentName}</>}.
        </Muted>
        <GameBars weeks={w.weeks} best={g} />
        <Muted tone="navy" className="mt-6">
          {gx.otherGamesAvg != null && gx.otherGamesAvg < g.score && (
            <>Your other games {ts} averaged {gx.otherGamesAvg}, so this one was {g.score - gx.otherGamesAvg} pins over. </>
          )}
          {gx.games200 >= 2 && g.score >= 200 && <>One of {gx.games200} games of 200 or better {ts}. </>}
          {w.seasonNumber > 1 && (gx.careerRank === 1
            ? <>The highest game of your career.</>
            : <>Your {ordinal(gx.careerRank)} highest game of the {fmt(gx.careerGames)} you have bowled.</>)}
        </Muted>
        {gx.lastAsGood && gx.lastAsGood.matchDate && nightDate && (
          <Muted tone="navy" className="mt-4">
            {gx.lastAsGood.seasonID === w.season.seasonID
              ? <>You had already shot {gx.lastAsGood.score} in week {gx.lastAsGood.week}, so this was not even your first time {ts}.</>
              : <>It had been {timeSince(gx.lastAsGood.matchDate, nightDate)} since you bowled a game that high: a {gx.lastAsGood.score} in Season {gx.lastAsGood.romanNumeral}, {formatMatchDate(gx.lastAsGood.matchDate, { month: 'long', year: 'numeric' })}.</>}
          </Muted>
        )}
        {!gx.lastAsGood && w.seasonNumber > 1 && gx.careerRank === 1 && (
          <Muted tone="navy" className="mt-4">You had never bowled a game that high before.</Muted>
        )}
        <Muted tone="navy" className="mt-4">{rankPhrase(w.ranks.highGame.rank, w.ranks.highGame.field).replace('Most', 'Highest')} {ts}.</Muted>
      </WrappedCard>,
    );
  }

  // 6. Turkeys
  if (w.turkeys > 0) {
    cards.push(
      <WrappedCard tone="cream" eyebrow="Turkeys" key="turkeys" compact>
        <BigNumber>{w.turkeys}</BigNumber>
        <Muted tone="cream" className="mt-4">
          {w.turkeys === 1 ? `One turkey ${ts}, and here it comes.` : `${w.turkeys} turkeys ${ts}, and here they come.`}
        </Muted>
        <TurkeyParade count={w.turkeys} />
      </WrappedCard>,
    );
  }

  // 7. The big swing
  if (w.bigSwing && Math.abs(w.bigSwing.gap) >= 30) {
    const sw = w.bigSwing;
    const up = sw.gap > 0;
    const night = w.weeks.find(wk => wk.week === sw.week);
    cards.push(
      <WrappedCard tone="red" eyebrow="The big swing" key="swing" compact>
        <div className="flex items-baseline gap-4 font-heading tabular-nums">
          <span className={`${up ? 'text-5xl sm:text-6xl text-cream/85' : 'text-7xl sm:text-8xl'}`}>{sw.from}</span>
          <span className="text-3xl text-cream/85">to</span>
          <span className={`${up ? 'text-7xl sm:text-8xl' : 'text-5xl sm:text-6xl text-cream/85'}`}>{sw.to}</span>
        </div>
        <Muted tone="red" className="mt-6">
          Week {sw.week}{night?.opponentName && <> vs {night.opponentName}</>}, game {sw.fromGame} to game {sw.fromGame + 1}.
          {' '}{up
            ? <>A {sw.gap}-pin jump, the biggest game-to-game swing of your season. You figured out how to bowl right in between these games!</>
            : <>A {Math.abs(sw.gap)}-pin drop, the biggest game-to-game swing of your season. Whoops. Shake it off.</>}
        </Muted>
      </WrappedCard>,
    );
  }

  // 8. Team, or the teams for a floater
  const recordText = (r: { won: number; lost: number }) => `${r.won}\u2013${r.lost}`;
  if (w.isFloater && w.teamStints.length > 1) {
    cards.push(
      <WrappedCard tone="navy" eyebrow="Your teams" key="team">
        <Headline>You bowled for {w.teamStints.length} teams {ts}.</Headline>
        <Muted tone="navy" className="mt-4">A floater. Every captain had your number.</Muted>
        <ul className="mt-8 space-y-5">
          {w.teamStints.map(st => (
            <li key={st.teamID} className="border-l-2 border-red-light pl-4">
              <p className="font-heading text-2xl">
                {st.slug ? <Link href={`/team/${st.slug}`} prefetch={false} className="hover:text-red-light transition-colors">{st.teamName}</Link> : st.teamName}
                <span className="text-cream/80 text-lg"> {st.nights} {st.nights === 1 ? 'night' : 'nights'}</span>
              </p>
              <Muted tone="navy" className="mt-1">
                They went {recordText(st.record)} with you in the lineup.
                {st.nightsAsTeamBest > 0 && <> Top scratch series on the team {st.nightsAsTeamBest === st.nights ? (st.nights === 1 ? 'that night' : 'every night') : `${st.nightsAsTeamBest} of ${st.nights} nights`}.</>}
                {st.nightsAsTeamBestHcp > 0 && <> Top handicap series {st.nightsAsTeamBestHcp === st.nights ? (st.nights === 1 ? 'that night' : 'every night') : `${st.nightsAsTeamBestHcp} of ${st.nights} nights`}.</>}
              </Muted>
            </li>
          ))}
        </ul>
      </WrappedCard>,
    );
  } else if (w.team) {
    const t = w.team;
    const rec = t.matchRecordWithMe;
    const others = w.teamStints.filter(st => st.teamID !== t.teamID);
    cards.push(
      <WrappedCard tone="navy" eyebrow="Your team" key="team">
        <Headline>
          <Link href={`/team/${t.slug}`} prefetch={false} className="hover:text-red-light transition-colors">{t.teamName}</Link>
        </Headline>
        <BigNumber className="mt-6">{t.wins}<span className="text-cream/80 text-5xl sm:text-6xl"> &ndash; </span>{t.losses}</BigNumber>
        <Muted tone="navy" className="mt-4">
          {ordinal(t.place)} of {t.divisionSize}{t.divisionName && <> in {t.divisionName}</>}, with {t.xp} bonus points.
          {' '}On the nights you bowled, the team went {recordText(rec)}.
          {t.nightsAsTeamBest > 0 && <> You had the top scratch series on the team {t.nightsAsTeamBest} of your {w.nights - others.reduce((n, st) => n + st.nights, 0)} nights.</>}
          {t.nightsAsTeamBestHcp > 0 && <> You had the top handicap series on the team {t.nightsAsTeamBestHcp} of your {w.nights - others.reduce((n, st) => n + st.nights, 0)} nights.</>}
        </Muted>
        {others.length > 0 && (
          <Muted tone="navy" className="mt-4">
            Plus {others.map((st, i) => (
              <span key={st.teamID}>{i > 0 && (i === others.length - 1 ? ' and ' : ', ')}{st.nights === 1 ? 'a night' : `${st.nights} nights`} filling in for {st.teamName}</span>
            ))}.
          </Muted>
        )}
      </WrappedCard>,
    );
  }

  // 9. Teammates
  if (w.teammates.length > 0) {
    const max = w.teammates[0].nightsTogether;
    cards.push(
      <WrappedCard tone="cream" eyebrow="Your people" key="teammates">
        <Headline>
          {w.teammates[0].bowlerName} was beside you most: {w.teammates[0].nightsTogether} of {w.nights} nights.
        </Headline>
        <ul className="mt-8 space-y-3 font-body">
          {w.teammates.map(tm => (
            <li key={tm.bowlerID}>
              <div className="flex items-baseline justify-between gap-3">
                <Link href={`/bowler/${tm.slug}`} prefetch={false} className="text-navy font-medium hover:text-red transition-colors truncate">{tm.bowlerName}</Link>
                <span className="font-heading text-lg tabular-nums">{tm.nightsTogether}</span>
              </div>
              <div className="h-2 rounded-full bg-navy/10 mt-1.5">
                <div className="h-2 rounded-full bg-red" style={{ width: `${Math.round((tm.nightsTogether / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </WrappedCard>,
    );
  }

  // 10. Badges
  if (w.patches.length > 0) {
    const counts = new Map<string, number>();
    for (const p of w.patches) counts.set(p.code, (counts.get(p.code) ?? 0) + 1);
    cards.push(
      <WrappedCard tone="gold" eyebrow={`Badges ${ts}`} key="badges">
        <BigNumber>{w.patches.length}</BigNumber>
        <ul className="mt-8 space-y-3">
          {[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([code, n]) => (
            <li key={code} className="flex items-center gap-3 font-body">
              <PatchBadge type={code} />
              <span className="flex-1 text-navy">{PATCH_LABEL[code] ?? code}</span>
              <span className="font-heading text-lg tabular-nums">{n}x</span>
            </li>
          ))}
        </ul>
      </WrappedCard>,
    );
  }

  // 11. Milestones crossed this season, and the next one on the horizon.
  // Not for a past recap: the horizon is a nudge, and the season is long over.
  const next = career ? nearestMilestone(career) : null;
  if (!past && (w.milestones.length > 0 || next)) {
    cards.push(
      <WrappedCard tone="red" eyebrow="Milestones" key="milestones" compact={w.milestones.length === 0}>
        {w.milestones.length > 0 && (
          <>
            <Headline>You crossed {w.milestones.length === 1 ? 'a career line' : `${w.milestones.length} career lines`} {ts}.</Headline>
            <ul className="mt-8 space-y-4">
              {w.milestones.map(m => (
                <li key={`${m.category}-${m.threshold}`} className="flex items-baseline gap-4">
                  <span className="font-heading text-4xl tabular-nums">{fmt(m.threshold)}</span>
                  <span className="font-body text-cream/90">{MILESTONE_NOUN[m.category] ?? m.category}, week {m.week}</span>
                </li>
              ))}
            </ul>
            {next && <Divider tone="red" />}
          </>
        )}
        {next && (
          <>
            <p className="font-body text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-cream/85">On the horizon</p>
            <BigNumber className="mt-4">{fmt(next.needed)}</BigNumber>
            <Muted tone="red" className="mt-4">
              more {MILESTONE_NOUN[next.category]} and you hit {fmt(next.next)}. You are at {fmt(next.current)}.
            </Muted>
          </>
        )}
      </WrappedCard>,
    );
  }

  // 12. Close
  cards.push(
    <WrappedCard tone="cream" key="close">
      <Headline>{w.nights > 0 ? <>That was your {season}, {name}.</> : <>That is your bowling life so far, {name}.</>}</Headline>
      <Muted tone="cream" className="mt-6">
        {w.nights > 0 && !past
          ? <>Thank you, sincerely, for choosing to spend your Monday nights with Splitzkrieg.</>
          : <>Thank you, sincerely, for the time you spent with Splitzkrieg. The lanes are right where you left them.</>}
      </Muted>
      <Muted tone="cream" className="mt-4">
        We&rsquo;ll see you again soon on the lanes.<br />
        And at the Wrap-Up party! (Tues. December 8th)<br />
        And at the Durham Holiday Parade! (Sat. December 12th)
      </Muted>
      <PinParade />
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <ShareButton url={shareUrl} title={`${w.bowlerName}, Frame by Frame, Season ${w.season.romanNumeral}`} label="Share" />
        <Link href={`/bowler/${w.slug}`} prefetch={false} className="font-body text-navy/80 underline underline-offset-4 hover:text-red transition-colors">
          Back to your profile
        </Link>
      </div>
    </WrappedCard>,
  );

  // Narrative order: who you are in the league's time, then this season drilled down
  // (nights, the best of them, the games inside), then the totals those add up to,
  // then back out to the career, and finish with the people.
  const ORDER = ['cover', 'seasons', 'nights', 'pins', 'own', 'avg', 'best', 'bestgame', 'style', 'impact', 'turkeys', 'swing', 'badges', 'team', 'teammates', 'milestones', 'close'];
  const position = (node: React.ReactNode) => {
    const key = (node as { key?: string | null } | null)?.key ?? '';
    const i = ORDER.indexOf(key);
    return i === -1 ? ORDER.length : i;
  };
  const ordered = [...cards].sort((a, b) => position(a) - position(b));

  const total = ordered.length;
  return (
    <div className="space-y-5">
      {ordered.map((c, i) => (
        <div key={i} data-card={i + 1} data-total={total}>
          {isValidElement(c) ? cloneElement(c as React.ReactElement<{ index?: number; total?: number }>, { index: i + 1, total }) : c}
        </div>
      ))}
    </div>
  );
}
