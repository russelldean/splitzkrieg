import Link from 'next/link';

interface CalloutData {
  headline: string;
  description: string;
  href?: string;
  linkText?: string;
}

interface Props {
  callout?: CalloutData;
}

export function RecapCallout({ callout }: Props) {
  if (!callout) return null;

  return (
    <div className="bg-red-600/[0.08] border-l-4 border-red-600 rounded-r-lg p-4">
      <div className="flex items-start gap-3">
        <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full inline-block shrink-0 mt-0.5">
          NEW
        </span>
        <div>
          <p className="font-body text-base font-semibold text-navy">{callout.headline}</p>
          <p className="font-body text-sm text-navy/75 mt-1">{callout.description}</p>
          {callout.href && callout.linkText && (
            <Link
              href={callout.href}
              className="inline-flex items-center gap-1 font-body text-sm font-semibold text-red-600 hover:text-red-700 mt-2 transition-colors"
            >
              {callout.linkText}
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
