import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <h1 className="font-heading text-6xl text-navy mb-4">404</h1>
      <p className="text-lg text-navy/60 mb-8">This page rolled into the gutter.</p>

      {/* Wobbling pin easter egg */}
      <Link href="/game" className="group cursor-pointer">
        <div className="relative">
          {/* SVG bowling pin with wobble animation */}
          <svg
            viewBox="0 0 60 120"
            className="w-20 h-40 animate-wobble group-hover:animate-wobble-fast transition-transform"
            fill="none"
          >
            {/* Pin body - white with red stripes */}
            <ellipse cx="30" cy="95" rx="22" ry="20" fill="#f5f5f0" stroke="#ddd" />
            <ellipse cx="30" cy="55" rx="12" ry="15" fill="#f5f5f0" stroke="#ddd" />
            <rect x="18" y="60" width="24" height="30" fill="#f5f5f0" />
            <ellipse cx="30" cy="25" rx="10" ry="12" fill="#f5f5f0" stroke="#ddd" />
            {/* Red stripes */}
            <rect x="18" y="68" width="24" height="4" fill="#cc3333" rx="2" />
            <rect x="18" y="76" width="24" height="4" fill="#cc3333" rx="2" />
          </svg>
        </div>
        <p className="mt-4 text-sm text-navy/40 group-hover:text-red transition-colors">
          Tap the pin...
        </p>
      </Link>

      <Link
        href="/"
        className="mt-8 text-sm text-navy/60 hover:text-navy underline transition-colors"
      >
        Back to Splitzkrieg
      </Link>
    </div>
  );
}
