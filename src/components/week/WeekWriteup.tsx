import { MDXRemote } from 'next-mdx-remote/rsc';
import { mdxComponents } from '@/lib/mdx-components';

interface Props {
  /** Raw MDX body of the post. */
  content: string;
  /** Post title, used in the summary line. */
  title: string;
  /** Week number, used in the summary line. */
  weekNum: number;
  /** Whether the block starts open. */
  defaultOpen: boolean;
}

/**
 * Russ's writeup for a league night, rendered inline on the week page.
 *
 * Native <details> rather than a JS toggle: the site is fully prebuilt, so a
 * client-state default risks a hydration mismatch. <details open> is resolved
 * at render time, needs no JS, and is keyboard accessible for free.
 *
 * Recap bodies end with <WeekRecap ... />, which used to render the condensed
 * stats inside the blog post. The week page renders the real stats itself, so
 * that component is neutralised here rather than edited out of stored content.
 */
export function WeekWriteup({ content, title, weekNum, defaultOpen }: Props) {
  const components = {
    ...mdxComponents,
    WeekRecap: () => null,
  };

  return (
    <details
      open={defaultOpen}
      className="group mb-6 rounded-xl border border-navy/10 bg-white shadow-sm overflow-hidden"
    >
      <summary className="cursor-pointer list-none px-4 py-3 sm:px-5 hover:bg-navy/[0.02] transition-colors">
        <span className="flex items-center gap-2">
          <svg
            className="w-4 h-4 shrink-0 text-navy/50 transition-transform group-open:rotate-90"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="font-heading text-base sm:text-lg text-navy">
            Week {weekNum} Recap
          </span>
          <span className="sr-only">{title}</span>
        </span>
      </summary>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 border-t border-navy/10">
        <MDXRemote source={content} components={components} />
      </div>
    </details>
  );
}
