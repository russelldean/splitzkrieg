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
}

export function TeamHero({ team, rosterCount, seasonsActive, franchiseNames, shareUrl, currentStanding }: Props) {
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
              className="inline-flex items-center gap-2 mt-2 font-body text-lg text-navy/60 hover:text-red-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-red-600/50" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-navy/40">Captain -</span>
              {team.captainName}
              <svg className="w-3.5 h-3.5 text-red-600/50" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </Link>
          )}
        </div>
        <div className="shrink-0 pt-2">
          <ShareButton url={shareUrl} />
        </div>
      </div>

      {/* Current season standing callout */}
      {currentStanding && (
        <Link
          href={`/season/${currentStanding.seasonSlug}#standings`}
          className="flex items-center gap-4 mt-6 px-4 py-3 bg-navy/[0.04] border border-navy/10 rounded-lg hover:bg-navy/[0.07] hover:border-navy/20 transition-all group"
        >
          <div className="font-heading text-2xl text-navy">
            #{currentStanding.divisionRank}
            <span className="text-base text-navy/40 font-body ml-1">of {currentStanding.divisionSize}</span>
          </div>
          <div className="border-l border-navy/10 pl-4">
            <div className="font-body text-sm text-navy tabular-nums">
              {currentStanding.wins}W · {currentStanding.xp}XP · {currentStanding.totalPts}pts
            </div>
            <div className="font-body text-xs text-navy/50">
              Season {currentStanding.seasonRoman}{currentStanding.divisionName ? ` · ${currentStanding.divisionName}` : ''} · View Standings →
            </div>
          </div>
        </Link>
      )}

      <div className="flex flex-wrap items-start gap-2 mt-4">
        <StatPill label="Current Roster" value={rosterCount} />
        <StatPill label="Seasons Active" value={seasonsActive} />
        <FranchiseHistory names={franchiseNames} />
      </div>
    </section>
  );
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
