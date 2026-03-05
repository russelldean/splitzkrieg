import Link from 'next/link';
import type { Season, SeasonHeroStats } from '@/lib/queries';
import { ShareButton } from '@/components/bowler/ShareButton';
import { strikeX } from '@/components/ui/StrikeX';

interface Props {
  season: Season;
  heroStats: SeasonHeroStats | null;
  shareUrl: string;
}

function StatPill({ label, value }: { label: string; value: string | number | null }) {
  const display = value === null || value === 0 ? '\u2014' : String(value);
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-navy/5 rounded-full text-sm font-body text-navy">
      <span className="text-navy/50">{label}</span>
      <span className="font-semibold">{display}</span>
    </span>
  );
}

function StatHolderPill({
  label,
  bowlerName,
  slug,
  value,
}: {
  label: string;
  bowlerName: string;
  slug: string;
  value: number;
}) {
  return (
    <Link
      href={`/bowler/${slug}`}
      className="inline-flex items-center gap-1.5 px-3 py-1 bg-navy/5 rounded-full text-sm font-body text-navy hover:bg-navy/10 transition-colors"
    >
      <span className="text-navy/50">{label}</span>
      <span className="font-semibold">{value}</span>
      <span className="text-navy/40">{bowlerName}</span>
    </Link>
  );
}

export function SeasonHero({ season, heroStats, shareUrl }: Props) {
  const displayName = `Season ${season.romanNumeral} \u2014 ${season.period} ${season.year}`;

  return (
    <section className="relative pb-8 border-b border-red-600/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy">
            Season {strikeX(season.romanNumeral)}
          </h1>
          <p className="font-body text-lg text-navy/60 mt-1">
            {season.period} {season.year}
          </p>
        </div>
        <div className="shrink-0 pt-2">
          <ShareButton url={shareUrl} />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-2 mt-6">
        <StatPill label="League Avg" value={heroStats?.leagueAverage?.toFixed(1) ?? null} />
        <StatPill label="Bowlers" value={heroStats?.totalBowlers ?? null} />
        <StatPill label="Games" value={heroStats?.totalGames?.toLocaleString() ?? null} />
        {heroStats?.topAverage && (
          <StatHolderPill
            label="Top Avg"
            bowlerName={heroStats.topAverage.bowlerName}
            slug={heroStats.topAverage.slug}
            value={heroStats.topAverage.value}
          />
        )}
        {heroStats?.highGame && (
          <StatHolderPill
            label="High Game"
            bowlerName={heroStats.highGame.bowlerName}
            slug={heroStats.highGame.slug}
            value={heroStats.highGame.value}
          />
        )}
        {heroStats?.highSeries && (
          <StatHolderPill
            label="High Series"
            bowlerName={heroStats.highSeries.bowlerName}
            slug={heroStats.highSeries.slug}
            value={heroStats.highSeries.value}
          />
        )}
      </div>
    </section>
  );
}
