import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <h1 className="font-heading text-6xl text-navy mb-4">404</h1>
      <p className="text-lg text-navy/70 mb-8">This page rolled into the gutter.</p>

      {/* USBC-profile bowling pin */}
      <div className="animate-wobble">
        <svg viewBox="0 0 60 130" className="w-16 h-32" fill="none">
          {/* Shadow */}
          <ellipse cx="31" cy="122" rx="16" ry="4" fill="rgba(0,0,0,0.15)" />
          {/* Pin body - smooth USBC profile using quadratic curves */}
          <path
            d="
              M30 5
              Q35 5, 37 12
              Q39 18, 38 25
              Q36 32, 35 38
              Q40 48, 43 58
              Q47 68, 47 78
              Q47 90, 44 100
              Q42 110, 35 115
              Q32 118, 30 118
              Q28 118, 25 115
              Q18 110, 16 100
              Q13 90, 13 78
              Q13 68, 17 58
              Q20 48, 25 38
              Q24 32, 22 25
              Q21 18, 23 12
              Q25 5, 30 5
              Z
            "
            fill="#f5f5f0"
            stroke="#c8c8c0"
            strokeWidth="0.8"
          />
          {/* Red stripes at neck */}
          <rect x="22.5" y="30" width="15" height="3" rx="1.5" fill="#cc3333" />
          <rect x="22.5" y="36" width="15" height="3" rx="1.5" fill="#cc3333" />
          {/* 3D highlight on belly */}
          <ellipse cx="26" cy="78" rx="3" ry="12" fill="rgba(255,255,255,0.2)" transform="rotate(-5 26 78)" />
        </svg>
      </div>

      <Link
        href="/"
        className="mt-8 text-sm text-navy/70 hover:text-navy underline transition-colors"
      >
        Back to Splitzkrieg
      </Link>
    </div>
  );
}
