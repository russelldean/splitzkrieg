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
    <Link
      href={nextStop.href}
      onClick={handleClick}
      className="block mt-8 min-h-[64px] bg-white border border-navy/10 rounded-xl p-4 sm:p-5 hover:shadow-md hover:border-red-600/30 transition-all"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide font-semibold text-navy/60 font-body">
            Keep exploring
          </p>
          <p className="text-base font-heading text-navy">
            {nextStop.title}
          </p>
          <p className="text-sm font-body text-navy/70">
            {nextStop.description}
          </p>
        </div>
        <svg
          className="w-5 h-5 text-navy/60 shrink-0"
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
    </Link>
  );
}
