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
