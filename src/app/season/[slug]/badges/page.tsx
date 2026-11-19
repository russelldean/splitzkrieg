/**
 * Badge Wall: every badge earned in a season, grouped by badge.
 *
 * Current season only for now (Russ, 2026-11-18: see how it looks, then
 * consider backfilling). Other slugs 404. One query per build.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getSeasonBySlug,
  getCurrentSeasonSlug,
  getSeasonBadgeWall,
  type SeasonBadgeRow,
} from '@/lib/queries';
import { PatchBadge } from '@/components/ui/PatchBadge';
import { compareByLastName } from '@/lib/name-sort';
import { TrailNav } from '@/components/ui/TrailNav';
import { strikeX } from '@/components/ui/StrikeX';

export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slug = await getCurrentSeasonSlug();
  return slug ? [{ slug }] : [];
}

const GROUPS: { title: string; badges: { code: string; label: string; blurb: string; alphaList?: boolean }[] }[] = [
  {
    title: 'Champions',
    badges: [
      { code: 'champion', label: 'Team Champion', blurb: 'Won the team final' },
      { code: 'scratchChampion', label: 'Scratch Champion', blurb: "Won the men's or women's scratch bracket" },
      { code: 'hcpChampion', label: 'Handicap Champion', blurb: 'Won the handicap bracket' },
      { code: 'turkeyTrophy', label: 'Turkey Trophy', blurb: 'Most turkeys in the season' },
    ],
  },
  {
    title: 'Playoffs',
    badges: [
      { code: 'playoff', label: 'Team Playoffs', blurb: 'Bowled for a team that made the playoffs' },
      { code: 'scratchPlayoff', label: 'Scratch Playoffs', blurb: 'Qualified for a scratch bracket' },
      { code: 'hcpPlayoff', label: 'Handicap Playoffs', blurb: 'Qualified for the handicap bracket' },
    ],
  },
  {
    title: 'Season',
    badges: [
      { code: 'attendance', label: 'Like Clockwork', blurb: 'Missed at most one night' },
    ],
  },
  {
    title: 'Weekly',
    badges: [
      { code: 'perfectGame', label: 'Perfect Game', blurb: 'Bowled a 300' },
      { code: 'botw', label: 'Bowler of the Week', blurb: 'Top handicap series of the night' },
      { code: 'highGame', label: 'Weekly High Game', blurb: 'Top scratch game of the night' },
      { code: 'highSeries', label: 'Weekly High Series', blurb: 'Top scratch series of the night' },
      { code: 'threeOfAKind', label: 'Three of a Kind', blurb: 'Same score all three games' },
      // Long list: alphabetical, one name per row, so bowlers can find themselves.
      { code: 'aboveAvg', label: 'Above Average All 3', blurb: 'Matched or beat average every game', alphaList: true },
    ],
  },
];

/**
 * Site palette per group (navy, cream, red, gold). The badge pills keep their
 * own colors; everything around them stays in the house colors.
 */
const GROUP_STYLE: Record<string, { stripe: string; header: string; chip: string }> = {
  Champions: { stripe: 'border-l-amber-400', header: 'bg-amber-200', chip: 'bg-amber-300 text-navy' },
  Playoffs: { stripe: 'border-l-red-600', header: 'bg-cream-dark', chip: 'bg-red-600/10 text-red-700' },
  Season: { stripe: 'border-l-navy', header: 'bg-cream-dark', chip: 'bg-navy/10 text-navy' },
  Weekly: { stripe: 'border-l-navy', header: 'bg-cream-dark', chip: 'bg-navy/10 text-navy' },
};

interface Earner {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  isPublic: boolean;
  weeks: number[];
  count: number;
}

function earnersFor(rows: SeasonBadgeRow[], code: string, alphabetical = false): Earner[] {
  const byBowler = new Map<number, Earner>();
  for (const r of rows) {
    if (r.code !== code) continue;
    let e = byBowler.get(r.bowlerID);
    if (!e) {
      e = { bowlerID: r.bowlerID, bowlerName: r.bowlerName, slug: r.slug, isPublic: r.isPublic, weeks: [], count: 0 };
      byBowler.set(r.bowlerID, e);
    }
    e.count++;
    if (r.week != null) e.weeks.push(r.week);
  }
  return [...byBowler.values()].sort(
    (a, b) => (alphabetical ? 0 : b.count - a.count) || compareByLastName(a.bowlerName, b.bowlerName),
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const season = await getSeasonBySlug(slug);
  if (!season) return { title: 'Season Not Found' };
  return {
    title: `Badge Wall - Season ${season.romanNumeral}`,
    description: `Every badge earned in Season ${season.romanNumeral} (${season.period} ${season.year}) of the Splitzkrieg Bowling League.`,
  };
}

export default async function BadgeWallPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [season, currentSlug] = await Promise.all([getSeasonBySlug(slug), getCurrentSeasonSlug()]);
  if (!season || slug !== currentSlug) notFound();

  const { badges, championTeamName } = await getSeasonBadgeWall(season.seasonID);
  const bowlerCount = new Set(badges.map((b) => b.bowlerID)).size;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <TrailNav current="/seasons" seasonSlug={slug} seasonRoman={season.romanNumeral} position="top" />

      <Link
        href={`/season/${slug}`}
        prefetch={false}
        className="mb-3 inline-flex items-center gap-1 font-body text-sm font-medium text-navy/65 hover:text-red-600 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Season {season.romanNumeral}
      </Link>

      <section className="rounded-xl bg-navy text-cream shadow-md ring-1 ring-navy/10 px-5 py-5 sm:px-8 sm:py-7">
        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-cream/80">
          Badge Wall &middot; {season.period} {season.year}
        </p>
        <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl leading-tight mt-1">
          Season {strikeX(season.romanNumeral)}
        </h1>
        <p className="font-body text-sm sm:text-base text-cream/85 mt-1">
          <span className="font-semibold text-amber-300 tabular-nums">{badges.length}</span> badges earned by{' '}
          <span className="font-semibold text-amber-300 tabular-nums">{bowlerCount}</span> bowlers.
        </p>

        {/* One tile per badge earned this season; each jumps to its section. */}
        <nav aria-label="Badges" className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {GROUPS.flatMap((g) => g.badges).map((b) => {
            const n = badges.filter((r) => r.code === b.code).length;
            if (n === 0) return null;
            return (
              <a
                key={b.code}
                href={`#${b.code}`}
                className="group rounded-lg bg-white/5 px-3 py-2.5 ring-1 ring-cream/15 transition-colors hover:bg-white/10 hover:ring-amber-300/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-heading text-2xl leading-none tabular-nums text-amber-300">{n}</span>
                  <PatchBadge type={b.code} />
                </div>
                <div className="mt-1.5 font-body text-xs font-semibold leading-tight text-cream/85 group-hover:text-cream">
                  {b.label}
                </div>
              </a>
            );
          })}
        </nav>
      </section>

      <div className="mt-8 space-y-10">
        {GROUPS.map((group) => {
          const sections = group.badges
            .map((b) => ({ ...b, earners: earnersFor(badges, b.code, b.alphaList) }))
            .filter((b) => b.earners.length > 0);
          if (sections.length === 0) return null;
          const style = GROUP_STYLE[group.title] ?? GROUP_STYLE.Weekly;
          return (
            <section key={group.title}>
              <h2 className="font-heading text-xl text-navy mb-3 flex items-center gap-3">
                {group.title}
                <span className="h-px flex-1 bg-gradient-to-r from-red-600/40 to-transparent" />
              </h2>
              <div className="space-y-4">
                {sections.map((s) => {
                  const awards = s.earners.reduce((n, e) => n + e.count, 0);
                  return (
                    <div key={s.code} id={s.code} className={`scroll-mt-20 overflow-hidden rounded-lg border border-navy/10 border-l-4 ${style.stripe} bg-white shadow-sm`}>
                      <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-navy/5 px-4 py-3 ${style.header}`}>
                        {/* A white ring lifts the pill off the tinted header. */}
                        <span className="inline-flex rounded-full ring-2 ring-white shadow-sm">
                          <PatchBadge type={s.code} />
                        </span>
                        <h3 className="font-heading text-base text-navy">
                          {s.label}
                          {s.code === 'champion' && championTeamName ? `: ${championTeamName}` : ''}
                        </h3>
                        <span className="font-body text-sm text-navy/70">{s.blurb}</span>
                        <span className="ml-auto font-body text-sm tabular-nums text-navy/70">
                          {awards === s.earners.length
                            ? `${awards} ${awards === 1 ? 'bowler' : 'bowlers'}`
                            : `${awards} awards, ${s.earners.length} bowlers`}
                        </span>
                      </div>
                      <ul className={s.alphaList ? 'divide-y divide-navy/5' : 'flex flex-wrap gap-x-5 gap-y-2 px-4 py-3'}>
                        {s.earners.map((e) => (
                          <li key={e.bowlerID} className={`font-body text-sm text-navy ${s.alphaList ? 'px-4 py-2' : ''}`}>
                            {e.isPublic ? (
                              <Link
                                href={`/bowler/${e.slug}`}
                                prefetch={false}
                                className="font-medium hover:text-red-600 transition-colors"
                              >
                                {e.bowlerName}
                              </Link>
                            ) : (
                              <span className="font-medium">{e.bowlerName}</span>
                            )}
                            {e.count > 1 && (
                              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${style.chip}`}>
                                x{e.count}
                              </span>
                            )}
                            {e.weeks.length > 0 && (
                              <span className="ml-1.5 text-xs tabular-nums text-navy/65">
                                Wk {e.weeks.join(', ')}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-10 border-t border-navy/10 pt-5">
        <Link
          href={`/season/${slug}`}
          prefetch={false}
          className="inline-flex items-center gap-1 font-body text-sm font-medium text-navy/65 hover:text-red-600 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Season {season.romanNumeral}
        </Link>
      </div>
    </main>
  );
}
