'use client';

import Link from 'next/link';
import { usePostHog } from 'posthog-js/react';

interface ExitRampProps {
  href: string;
  section: string;
  linkText: string;
  className?: string;
}

export function ExitRamp({ href, section, linkText, className }: ExitRampProps) {
  const posthog = usePostHog();

  function handleClick() {
    posthog.capture('exit_ramp_clicked', {
      section,
      destination: href,
      link_text: linkText,
      source_page: window.location.pathname,
    });
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={
        className ??
        'inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg bg-navy/[0.06] font-body text-sm font-semibold text-navy/80 hover:bg-red-600 hover:text-white transition-colors'
      }
    >
      {linkText}
      <svg
        className="w-3.5 h-3.5"
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
    </Link>
  );
}
