import type { ReactNode } from 'react';
import { compileMDX } from 'next-mdx-remote/rsc';
import { mdxComponents } from '@/lib/mdx-components';
import { normalizeInlineTags } from '@/lib/mdx-source';
import { unknownTags } from '@/lib/mdx-validate';

/**
 * Renders a stored MDX body without letting a bad one fail the build.
 *
 * Post bodies are authored in the blog editor and read at build time, so a
 * single stray tag used to throw during prerender and take the whole deploy
 * down. Since the recap moved onto the week page that meant the weekly
 * deliverable, not just one blog post. Neither call site had an error boundary,
 * and an RSC that throws while prerendering cannot be caught by one anyway.
 *
 * The two failure classes need different handling because they fail at
 * different moments (see mdx-validate.ts):
 *
 *   unknown component -> throws at RENDER, so a try/catch is useless. Every
 *                        unregistered tag is registered as a marker BEFORE
 *                        render, which makes the component map total so the
 *                        throw cannot happen. The rest of the body renders.
 *   syntax error      -> throws at COMPILE, which a try/catch does catch. The
 *                        body is replaced by a short note.
 *
 * MDXRemote is exactly `const { content } = await compileMDX(props); return
 * content`, so using compileMDX directly changes nothing except giving us the
 * place to catch.
 */

/** Stands in for a tag nothing registered, so an unknown name cannot throw. */
function unknownTagMarker(name: string) {
  const Marker = ({ children }: { children?: ReactNode }) => (
    <>
      <span
        className="font-body text-xs text-navy/65 border border-navy/20 rounded px-1.5 py-0.5"
        title={`No component named ${name} is registered, so this tag was not rendered.`}
      >
        unrendered tag: {name}
      </span>
      {children}
    </>
  );
  Marker.displayName = `UnknownTag(${name})`;
  return Marker;
}

/**
 * Shown in place of a body that would not compile. Deliberately says nothing
 * about the parse error: the detail goes to the build log, not a public page.
 */
function CompileFailureNote() {
  return (
    <p className="font-body text-sm text-navy/65 italic">
      This writeup could not be displayed.
    </p>
  );
}

interface Props {
  /** Raw MDX body as stored. */
  source: string;
  /** Identifies the body in the build log when it fails. */
  label: string;
}

export async function SafeMDX({ source, label }: Props) {
  const normalized = normalizeInlineTags(source);

  // Make the component map total before rendering. A false positive here is
  // harmless: a name that is never actually rendered costs one unused entry.
  const missing = unknownTags(normalized, Object.keys(mdxComponents));
  const components = missing.length
    ? {
        ...mdxComponents,
        ...Object.fromEntries(missing.map((t) => [t, unknownTagMarker(t)])),
      }
    : mdxComponents;

  if (missing.length) {
    // Same shape as the [QUERY_FAIL] telemetry, so it greps out of Vercel logs.
    console.error(`[MDX_UNKNOWN_TAG] ${JSON.stringify({ label, tags: missing })}`);
  }

  try {
    const { content } = await compileMDX({ source: normalized, components });
    return content;
  } catch (err) {
    console.error(
      `[MDX_FAIL] ${JSON.stringify({
        label,
        message: err instanceof Error ? err.message : String(err),
      })}`,
    );
    return <CompileFailureNote />;
  }
}
