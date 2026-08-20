/**
 * Normalisation applied to stored MDX before rendering.
 *
 * Russ writes `<bowler>Name</bowler>` and `<team>Name</team>` in lowercase,
 * which reads naturally in the editor. MDX only maps CAPITALIZED names to
 * components, so a lowercase tag is parsed as a raw HTML element and the name
 * renders as unlinked plain text.
 *
 * Shared because it has to happen everywhere stored content is rendered. It
 * lived only in the blog route, so when the writeup moved to the week page the
 * bowler and team links silently stopped working there.
 */

/** Inline components that may be written in lowercase. */
const INLINE_TAGS = ['bowler', 'team'] as const;

export function normalizeInlineTags(content: string): string {
  let out = content;
  for (const tag of INLINE_TAGS) {
    const capitalized = tag[0].toUpperCase() + tag.slice(1);
    // Anchored to the angle bracket and the closing bracket so a bare word like
    // "the bowler bowled" is never touched.
    out = out.replace(new RegExp(`<(/?)${tag}>`, 'gi'), `<$1${capitalized}>`);
  }
  return out;
}
