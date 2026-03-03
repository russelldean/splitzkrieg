import type { BowlerCareerSummary } from '@/lib/queries';
import { ShareButton } from '@/components/bowler/ShareButton';
import { TeamBreakdown, type TeamStat } from '@/components/bowler/TeamBreakdown';

interface Props {
  careerSummary: BowlerCareerSummary | null;
  shareUrl: string;
  teams: TeamStat[];
}

export function BowlerHero({ careerSummary, shareUrl, teams }: Props) {
  const name = careerSummary?.bowlerName ?? 'Unknown Bowler';

  return (
    <section className="relative pb-8 border-b border-red-600/20">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl text-navy">
          {name}
        </h1>
        <div className="shrink-0 pt-2">
          <ShareButton url={shareUrl} />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-2 mt-6">
        <StatPill label="Career Avg" value={careerSummary?.careerAverage?.toFixed(1) ?? null} />
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

function StatPill({ label, value }: { label: string; value: string | number | null }) {
  const display = value === null || value === 0 ? '\u2014' : String(value);

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-navy/5 rounded-full text-sm font-body text-navy">
      <span className="text-navy/50">{label}</span>
      <span className="font-semibold">{display}</span>
    </span>
  );
}
