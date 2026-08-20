import Link from 'next/link';
import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import { TopPerformers } from '@/components/blog/TopPerformers';
import { MilestonesBlock } from '@/components/blog/MilestonesBlock';
import { MatchResultsSummary } from '@/components/blog/MatchResultsSummary';
import { LeaderboardSnapshot } from '@/components/blog/LeaderboardSnapshot';
import { RecapCallout, type CalloutData } from '@/components/blog/RecapCallout';

function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

function Bowler({ children }: { children: ReactNode }) {
  const name = typeof children === 'string' ? children : String(children);
  return <Link href={`/bowler/${toSlug(name)}`} className="text-red-600 hover:text-red-700 font-semibold">{name}</Link>;
}

function Team({ children }: { children: ReactNode }) {
  const name = typeof children === 'string' ? children : String(children);
  return <Link href={`/team/${toSlug(name)}`} className="text-red-600 hover:text-red-700 font-semibold">{name}</Link>;
}

/**
 * Feature callout, written directly in a post body:
 *   <Callout headline="..." description="..." href="/x" linkText="Take a look" />
 * Wraps RecapCallout, which takes a single `callout` object, so MDX can pass
 * flat attributes. Lives in the shared map so it works on the week page (inside
 * the collapsible writeup) and on standalone blog posts alike.
 */
function Callout(props: CalloutData) {
  return <RecapCallout callout={props} />;
}

export const mdxComponents: MDXComponents = {
  h1: ({ children }) => <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-4">{children}</h1>,
  h2: ({ children }) => <h2 className="font-heading text-2xl text-navy mt-8 mb-3">{children}</h2>,
  h3: ({ children }) => <h3 className="font-heading text-xl text-navy mt-6 mb-2">{children}</h3>,
  p: ({ children }) => <p className="font-body text-navy/80 leading-relaxed mb-4">{children}</p>,
  a: ({ href, children }) => (
    <Link href={href ?? '#'} className="text-red-600 hover:text-red-700 underline">{children}</Link>
  ),
  ul: ({ children }) => <ul className="list-disc pl-6 mb-4 font-body text-navy/80">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 font-body text-navy/80">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-navy">{children}</strong>,
  img: ({ src, alt }) => (
    <img src={src} alt={alt ?? ''} className="rounded-lg w-full my-6 shadow-sm" />
  ),
  // Blog stat block components (async server components)
  TopPerformers,
  MilestonesBlock,
  MatchResultsSummary,
  // Older stored bodies may still contain <WeekRecap />. The week page renders the
  // real stats itself, so the tag is a no-op, but the NAME must stay registered:
  // MDX throws on an unknown component and every recap page would break.
  WeekRecap: () => null,
  LeaderboardSnapshot,
  Bowler,
  Team,
  Callout,
} as MDXComponents;
