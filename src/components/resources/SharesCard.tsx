'use client';

import Link from 'next/link';

export function SharesCard() {
  return (
    <Link
      href="/splitzkrieg-shares"
      className="relative overflow-hidden rounded-lg p-5 border border-red/35 bg-gradient-to-b from-red/15 via-red/6 to-transparent shadow-[0_-4px_30px_rgba(200,30,30,0.16)] hover:shadow-[0_-4px_40px_rgba(200,30,30,0.25)] transition-all group"
    >
      {/* Red ambient light spilling from top edge */}
      <div
        className="absolute inset-x-0 -top-4 h-20 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(200,30,30,0.18), transparent)' }}
        aria-hidden="true"
      />
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

          {/* Item A - giant tuba, starts with left person */}
          <g className="animate-[shares-itemA_8s_ease-in-out_infinite]">
            <text x="0" y="48" textAnchor="middle" fontSize="24">&#x1F3BA;</text>
          </g>

          {/* Item B - teddy bear, starts with right person */}
          <g className="animate-[shares-itemB_8s_ease-in-out_infinite]">
            <text x="0" y="44" textAnchor="middle" fontSize="17">&#x1F9F8;</text>
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
