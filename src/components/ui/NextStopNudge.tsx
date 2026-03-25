'use client';

import Link from 'next/link';
import { usePostHog } from 'posthog-js/react';

interface NextStopNudgeProps {
  currentPage: 'week' | 'season' | 'stats' | 'milestones';
  seasonSlug?: string;
}

function getNextStop(currentPage: string, seasonSlug?: string) {
  const stops: Record<string, { href: string; title: string; description: string }> = {
    week: {
      href: seasonSlug ? `/season/${seasonSlug}` : '/seasons',
      title: 'Season Standings',
      description: 'See where every team stands after this week',
    },
    season: {
      href: seasonSlug ? `/stats/${seasonSlug}` : '/stats',
      title: 'Season Leaderboards',
      description: 'Who leads the averages, high games, and series',
    },
    stats: {
      href: '/milestones',
      title: 'Milestones',
      description: 'Career landmarks hit this season',
    },
    milestones: {
      href: '/stats/all-time',
      title: 'All-Time Records',
      description: 'The best across 35 seasons of Splitzkrieg',
    },
  };

  return stops[currentPage] ?? null;
}

export function NextStopNudge({ currentPage, seasonSlug }: NextStopNudgeProps) {
  const posthog = usePostHog();
  const nextStop = getNextStop(currentPage, seasonSlug);

  if (!nextStop) return null;

  function handleClick() {
    posthog.capture('next_stop_clicked', {
      current_page: currentPage,
      destination: nextStop!.href,
      nudge_label: nextStop!.title,
    });
  }

  return (
    <>
      <style>{`
        @keyframes nudge-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(197, 48, 48, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(197, 48, 48, 0); }
        }
      `}</style>
      <Link
        href={nextStop.href}
        onClick={handleClick}
        className="group block mt-8 min-h-[64px] bg-white border-2 border-red-600/60 rounded-xl p-4 sm:p-5 hover:border-red-600 hover:shadow-md transition-all"
        style={{ animation: 'nudge-glow 2.5s ease-in-out infinite' }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide font-semibold text-red-600 font-body">
              Keep exploring
            </p>
            <p className="text-lg font-heading text-navy">
              {nextStop.title}
            </p>
            <p className="text-sm font-body text-navy/70">
              {nextStop.description}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shrink-0 group-hover:bg-red-700 transition-colors">
            <svg
              className="w-5 h-5 text-white group-hover:translate-x-0.5 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </div>
        </div>
      </Link>
    </>
  );
}
