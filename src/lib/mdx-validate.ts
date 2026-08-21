/**
 * Static checks on stored MDX, kept free of React so they can be unit tested
 * and reused by the blog editor.
 *
 * There are two ways a stored body takes down a build, and they fail at
 * different moments, which is why one guard never covered both:
 *
 *   syntax (`</br>`, `<Bowler>Amy<Bowler>`)  -> throws while COMPILING
 *   unknown component (`<Standings />`)      -> throws while RENDERING
 *
 * A try/catch around the compile step only ever catches the first. The second
 * needs this scan, so the component map can be made total before render.
 */

/** Fenced blocks and inline spans hold example markup, not components to render. */
function stripCode(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`\n]*`/g, ' ');
}

/**
 * Capitalized JSX tag names referenced by a body. MDX only treats capitalized
 * names as components; lowercase ones are plain HTML elements and never throw.
 */
export function referencedTags(source: string): string[] {
  const found = new Set<string>();
  for (const m of stripCode(source).matchAll(/<\/?([A-Z][A-Za-z0-9]*)/g)) {
    found.add(m[1]);
  }
  return [...found];
}

/**
 * Tag names a body references that nothing has registered. Each one is a build
 * failure waiting for the next deploy unless it is registered or neutralized.
 */
export function unknownTags(source: string, known: Iterable<string>): string[] {
  const registered = new Set(known);
  return referencedTags(source).filter((t) => !registered.has(t));
}

/** Result of checking a draft body, shared by the API route and the editor. */
export interface MdxValidation {
  /** False only for a body that will not compile. Unknown tags still compile. */
  ok: boolean;
  /** Compiler message, trimmed to the part an author can act on. */
  error: string | null;
  /** Capitalized tags nothing has registered. These render as a marker chip. */
  unknownTags: string[];
}

/**
 * MDX parse errors arrive with a stack and a package prefix that bury the one
 * line the author needs. Strip both so the editor can show something readable
 * instead of the bare Next digest the author sees today.
 */
export function readableMdxError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('at '))
    .slice(0, 4)
    .join(' ')
    .replace(/^\[next-mdx-remote\]\s*/, '')
    .replace(/^error compiling MDX:\s*/, '')
    .slice(0, 400);
}
