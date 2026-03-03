import Link from 'next/link';
import type { Milestone } from '@/lib/queries';

interface MilestoneTickerProps {
  milestones: Milestone[];
}

function formatMilestone(m: Milestone): string {
  if (m.type === 'achieved') {
    return `hit ${m.threshold} ${m.milestone}`;
  }
  const remaining = m.threshold - m.current;
  return `is ${remaining} away from ${m.threshold} ${m.milestone}`;
}

function MilestoneIcon({ type }: { type: 'achieved' | 'approaching' }) {
  if (type === 'achieved') {
    return (
      <svg className="w-4 h-4 text-red flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-navy/40 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
    </svg>
  );
}

const placeholderMilestones: Milestone[] = [
  { bowlerID: 0, bowlerName: 'League Record', slug: 'leaderboards', type: 'achieved', milestone: 'seasons played', threshold: 35, current: 35 },
  { bowlerID: 0, bowlerName: '619 Bowlers', slug: 'bowlers', type: 'achieved', milestone: 'have rolled with us', threshold: 619, current: 619 },
  { bowlerID: 0, bowlerName: 'Since 2007', slug: 'seasons', type: 'achieved', milestone: 'years of league history', threshold: new Date().getFullYear() - 2007, current: new Date().getFullYear() - 2007 },
];

export function MilestoneTicker({ milestones }: MilestoneTickerProps) {
  const items = milestones.length > 0 ? milestones : placeholderMilestones;

  return (
    <div className="w-full border-y border-navy/10 bg-white/50 overflow-hidden">
      <div
        className="flex items-center gap-8 py-3 whitespace-nowrap motion-safe:animate-ticker"
        style={{ width: 'max-content' }}
      >
        {/* Render twice for seamless loop */}
        {[...items, ...items].map((m, i) => (
          <span key={`${m.bowlerID}-${m.type}-${m.threshold}-${i}`} className="inline-flex items-center gap-2 text-sm font-body">
            <MilestoneIcon type={m.type} />
            <Link
              href={`/bowler/${m.slug}`}
              className="font-medium text-navy hover:text-red transition-colors"
            >
              {m.bowlerName}
            </Link>
            <span className="text-navy/60">{formatMilestone(m)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
