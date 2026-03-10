import type { MDXComponents } from 'mdx/types';
import Link from 'next/link';

export function useMDXComponents(): MDXComponents {
  return {
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
  };
}
