import Link from 'next/link';
import type { Team, FranchiseNameEntry, TeamCurrentStanding } from '@/lib/queries';
import { ShareButton } from '@/components/bowler/ShareButton';
import { FranchiseHistory } from '@/components/team/FranchiseHistory';

interface Props {
  team: Team;
  rosterCount: number;
  seasonsActive: number;
  franchiseNames: FranchiseNameEntry[];
  shareUrl: string;
  currentStanding?: TeamCurrentStanding | null;
  isGhostTeam?: boolean;
}

export function TeamHero({ team, rosterCount, seasonsActive, franchiseNames, shareUrl, currentStanding, isGhostTeam }: Props) {
  return (
    <section className="pb-8 border-b border-red-600/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl text-navy">
            {team.teamName}
          </h1>
        {team.captainName && team.captainSlug && (
          <Link
            href={`/bowler/${team.captainSlug}`}
            className="inline-flex items-center gap-1.5 mt-2 font-body text-base text-navy/60 hover:text-red-600 transition-colors"
          >
            <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-navy/10 text-[10px] font-heading font-bold text-navy/50 leading-none" title="Captain">C</span>
            {team.captainName}
          </Link>
        )}
        </div>
        <div className="shrink-0 pt-2">
          <ShareButton url={shareUrl} title={`${team.teamName} – Splitzkrieg`} label="Share Team Profile" />
        </div>
      </div>

      {/* Current season standing callout */}
      {currentStanding && (
        <div className="flex items-center gap-4 mt-6 px-4 py-3 bg-navy/[0.04] border border-navy/10 rounded-lg">
          <div className="text-center shrink-0">
            <div className="font-body text-xs text-navy/50 uppercase tracking-wide">Current Rank</div>
            <div className="font-heading text-2xl text-navy mt-0.5">
              #{currentStanding.divisionRank}
              <span className="text-base text-navy/50 font-body ml-0.5">/ {currentStanding.divisionSize}</span>
            </div>
            {currentStanding.divisionName && (
              <div className="font-body text-xs text-navy/50 mt-0.5">{currentStanding.divisionName}</div>
            )}
          </div>
          <div className="border-l border-navy/10 pl-4 flex-1">
            <div className="font-body text-xs text-navy/50 uppercase tracking-wide">Record</div>
            <div className="font-body text-sm text-navy font-semibold tabular-nums mt-0.5">
              {currentStanding.wins} &ndash; {currentStanding.losses}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0 border-l border-navy/10 pl-4">
            <Link
              href={`/season/${currentStanding.seasonSlug}`}
              className="text-xs font-body font-semibold text-navy/55 hover:text-red-600 transition-colors"
            >
              Standings
            </Link>
            <Link
              href={`/week/${currentStanding.seasonSlug}`}
              className="text-xs font-body font-semibold text-navy/55 hover:text-red-600 transition-colors"
            >
              League Nights
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-2 mt-4">
        {isGhostTeam ? (
          <StatPill label="Seasons Active" value="X" strike />
        ) : (
          <StatPill label="Seasons Active" value={seasonsActive} />
        )}
        <FranchiseHistory names={franchiseNames} />
      </div>
    </section>
  );
}

function StatPill({ label, value, strike }: { label: string; value: string | number | null; strike?: boolean }) {
  const display = value === null || value === 0 ? '\u2014' : String(value);

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-navy/5 rounded-full text-sm font-body text-navy">
      <span className="text-navy/65">{label}</span>
      <span className={`font-bold font-heading ${strike ? 'text-red-600/60' : ''}`}>{display}</span>
    </span>
  );
}
