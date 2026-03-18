'use client';

import Link from 'next/link';

export function SharesCard() {
  return (
    <Link
      href="/splitzkrieg-shares"
      className="relative overflow-hidden rounded-lg p-5 border border-red/20 bg-gradient-to-br from-white via-white to-red/5 hover:to-red/10 hover:shadow-md transition-all group"
    >
      {/* Sharing animation */}
      <div className="absolute -inset-4 flex items-center justify-center opacity-25" aria-hidden="true">
        <svg viewBox="0 0 200 80" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* Left person */}
          <g className="animate-[shares-left_8s_ease-in-out_infinite]">
            <circle cx="0" cy="20" r="6" fill="currentColor" className="text-navy" />
            <line x1="0" y1="26" x2="0" y2="48" stroke="currentColor" strokeWidth="2.5" className="text-navy" />
            <line x1="0" y1="33" x2="-8" y2="42" stroke="currentColor" strokeWidth="2" className="text-navy" />
            <line x1="0" y1="33" x2="8" y2="38" stroke="currentColor" strokeWidth="2" className="text-navy" />
            <line x1="0" y1="48" x2="-6" y2="62" stroke="currentColor" strokeWidth="2" className="text-navy" />
            <line x1="0" y1="48" x2="6" y2="62" stroke="currentColor" strokeWidth="2" className="text-navy" />
          </g>

          {/* Right person */}
          <g className="animate-[shares-right_8s_ease-in-out_infinite]">
            <circle cx="0" cy="20" r="6" fill="currentColor" className="text-navy" />
            <line x1="0" y1="26" x2="0" y2="48" stroke="currentColor" strokeWidth="2.5" className="text-navy" />
            <line x1="0" y1="33" x2="-8" y2="38" stroke="currentColor" strokeWidth="2" className="text-navy" />
            <line x1="0" y1="33" x2="8" y2="42" stroke="currentColor" strokeWidth="2" className="text-navy" />
            <line x1="0" y1="48" x2="-6" y2="62" stroke="currentColor" strokeWidth="2" className="text-navy" />
            <line x1="0" y1="48" x2="6" y2="62" stroke="currentColor" strokeWidth="2" className="text-navy" />
          </g>

          {/* Item A - bowling ball, starts with left person */}
          <g className="animate-[shares-itemA_8s_ease-in-out_infinite]">
            <text x="0" y="42" textAnchor="middle" fontSize="14">&#x1F4DA;</text>
          </g>

          {/* Item B - teddy bear, starts with right person */}
          <g className="animate-[shares-itemB_8s_ease-in-out_infinite]">
            <text x="0" y="42" textAnchor="middle" fontSize="14">&#x1F9F8;</text>
          </g>
        </svg>
      </div>

      <div className="relative z-10">
        <h3 className="font-body font-medium text-navy group-hover:text-red transition-colors">
          Splitzkrieg Shares
        </h3>
        <p className="font-body text-sm text-navy/65 mt-1">
          The free table. One bowler&apos;s junk is another bowler&apos;s treasure.
        </p>
      </div>
    </Link>
  );
}
