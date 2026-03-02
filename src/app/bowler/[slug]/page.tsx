/**
 * Static bowler profile page.
 *
 * All bowler pages are pre-rendered at build time via generateStaticParams.
 * dynamicParams = false ensures unknown slugs return 404 immediately —
 * the DB is never queried at runtime.
 *
 * Phase 1: Scaffold with bowler name. Full stats in Phase 2.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAllBowlerSlugs, getBowlerBySlug } from '@/lib/queries';

// Unknown slugs return 404 — never attempt to render or hit the DB at runtime.
export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getAllBowlerSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const bowler = await getBowlerBySlug(slug);
  if (!bowler) {
    return {
      title: 'Bowler Not Found | Splitzkrieg',
    };
  }
  const fullName = `${bowler.firstName} ${bowler.lastName}`;
  return {
    title: `${fullName} | Splitzkrieg`,
    description: `${fullName}'s bowling stats, career averages, and league history on Splitzkrieg.`,
  };
}

export default async function BowlerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bowler = await getBowlerBySlug(slug);

  if (!bowler) {
    notFound();
  }

  const fullName = `${bowler.firstName} ${bowler.lastName}`;

  return (
    <main className="container mx-auto px-4 py-12">
      <h1 className="font-heading text-4xl font-bold text-navy mb-4">{fullName}</h1>
      <p className="text-lg text-gray-600">
        Full profile coming in Phase 2 — career stats, averages, personal records, and season history.
      </p>
    </main>
  );
}
