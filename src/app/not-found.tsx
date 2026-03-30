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
          {/* Pin body - exact USBC regulation profile from game renderer */}
          <path
            d="M30,5 L34.2,8.8 L35.9,16.3 L34.8,29.5 L34.3,36.1 L34.1,42.7 L34.5,47.4 L35.7,53.0 L40.5,73.7 L41.0,84.1 L40.4,92.6 L39.0,101.0 L36.5,112.3 L34.7,118.0 L25.3,118.0 L23.5,112.3 L21.0,101.0 L19.6,92.6 L19.0,84.1 L19.5,73.7 L24.3,53.0 L25.5,47.4 L25.9,42.7 L25.7,36.1 L25.2,29.5 L24.1,16.3 L25.8,8.8 Z"
            fill="#f5f5f0"
            stroke="#c8c8c0"
            strokeWidth="0.8"
          />
          {/* Red stripes at neck */}
          <rect x="25.9" y="41.2" width="8.2" height="3" rx="1.5" fill="#cc3333" />
          <rect x="24.3" y="47.5" width="11.4" height="3" rx="1.5" fill="#cc3333" />
          {/* 3D highlight on belly */}
          <ellipse cx="26" cy="84" rx="3" ry="12" fill="rgba(255,255,255,0.2)" transform="rotate(-5 26 84)" />
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
