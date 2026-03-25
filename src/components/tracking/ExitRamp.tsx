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
        'inline-flex items-center gap-1 font-body text-sm text-red-600 hover:text-red-700 transition-colors'
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
