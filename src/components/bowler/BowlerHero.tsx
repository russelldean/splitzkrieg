import Link from 'next/link';
import type { BowlerCareerSummary } from '@/lib/queries';
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
}

export function BowlerHero({ careerSummary, currentAvg, currentAvgDelta, shareUrl, teams, isBowlerOfTheWeek, currentTeam }: Props) {
  const name = careerSummary?.bowlerName ?? 'Unknown Bowler';

  return (
    <section className="relative pb-8 border-b border-red-600/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            {isBowlerOfTheWeek && <BowlerOfTheWeekRibbon />}
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl text-navy">
              {name}
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
      </div>
    </section>
  );
}

function StatPill({ label, value, delta }: { label: string; value: string | number | null; delta?: string | null }) {
  const display = value === null || value === 0 ? '\u2014' : String(value);

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-navy/5 rounded-full text-sm font-body text-navy">
      <span className="text-navy/65">{label}</span>
      <span className="font-bold font-heading">{display}</span>
      {delta && (
        <span className={`text-xs ${delta.startsWith('-') ? 'text-red-500' : 'text-green-600'}`}>
          {delta}
        </span>
      )}
    </span>
  );
}
