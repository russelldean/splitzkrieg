import Link from 'next/link';

export function BackToHome() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-0">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-body font-medium text-navy/60 hover:text-navy transition-colors"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
        </svg>
        Home
      </Link>
    </div>
  );
}
