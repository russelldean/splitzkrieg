import Link from 'next/link';
import type { BowlerCareerSummary, GameLogWeek } from '@/lib/queries';
import { scoreColorClass, seriesColorClass } from '@/lib/score-utils';
import { ShareButton } from '@/components/bowler/ShareButton';
import { TeamBreakdown, type TeamStat } from '@/components/bowler/TeamBreakdown';
import { BowlerOfTheWeekRibbon } from '@/components/bowler/BowlerOfTheWeekRibbon';
import { PrivacyNote } from '@/components/bowler/PrivacyNote';


interface Props {
  careerSummary: BowlerCareerSummary | null;
  currentAvg: string | null;
  currentAvgDelta?: string | null;
  shareUrl: string;
  teams: TeamStat[];
  isBowlerOfTheWeek?: boolean;
  currentTeam?: { name: string; slug: string | null } | null;
  slug?: string;
  lastWeek?: GameLogWeek | null;
}

export function BowlerHero({ careerSummary, currentAvg, currentAvgDelta, shareUrl, teams, isBowlerOfTheWeek, currentTeam, slug, lastWeek }: Props) {
  const name = careerSummary?.bowlerName ?? 'Unknown Bowler';

  return (
    <section className="relative pb-8 border-b border-red-600/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            {isBowlerOfTheWeek && <BowlerOfTheWeekRibbon />}
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl text-navy">
              {name}
              {/* EASTER EGG: Alex Leftenstein evil twin tooltip */ slug === 'alex-leftenstein' && (
                <span className="relative group cursor-help inline-block ml-2 align-middle">
                  <svg className="w-5 h-5 text-navy/30 hover:text-navy/60 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-navy text-cream text-xs font-body rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
                    Evil twin of Alex Rubenstein
                  </span>
                </span>
              )}
            </h1>
          </div>
          {currentTeam && currentTeam.slug && (
            <Link
              href={`/team/${currentTeam.slug}`}
              className="inline-flex items-center gap-1 mt-2 font-body text-sm text-navy/65 hover:text-red-600 transition-colors"
            >
              {currentTeam.name}
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          )}
          <PrivacyNote />
        </div>
        <div className="shrink-0 pt-2">
          <ShareButton url={shareUrl} title={`${name} - Splitzkrieg`} />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-2 mt-6">
        <StatPill label="Current Avg" value={currentAvg} delta={currentAvgDelta} />
        <StatPill label="Total Games" value={careerSummary?.totalGamesBowled ?? null} />
        <StatPill
          label="Seasons Active"
          value={careerSummary?.seasonsPlayed ?? null}
        />
        <TeamBreakdown teams={teams} />
        {lastWeek && (
          <LastWeekPill week={lastWeek} />
        )}
      </div>
    </section>
  );
}

function LastWeekPill({ week }: { week: GameLogWeek }) {
  const games = [week.game1, week.game2, week.game3].filter(
    (g): g is number => g !== null && g > 0
  );
  const scores = games.join(' · ');
  const series = week.scratchSeries;

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-navy/5 rounded-full text-sm font-body text-navy">
      <span className="text-navy/65">Last Week</span>
      <span className="font-bold font-heading tabular-nums">{scores}{series != null ? ` = ${series}` : ''}</span>
    </span>
  );
}

function StatPill({ label, value, delta }: { label: string; value: string | number | null; delta?: string | null }) {
  const display = value === null || value === 0 ? '\u2014' : String(value);

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-navy/5 rounded-full text-sm font-body text-navy">
      <span className="text-navy/65">{label}</span>
      <span className="font-bold font-heading">{display}</span>
      {delta && (
        <span className={`text-xs font-semibold ${delta.startsWith('-') ? 'text-red-500' : 'text-green-600'}`}>
          {delta}
        </span>
      )}
    </span>
  );
}
