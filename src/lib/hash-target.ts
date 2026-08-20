/**
 * The element id a URL fragment points at, or null when it points at nothing.
 *
 * Split out from the scrolling component purely so this part can be tested:
 * the rest of that component is DOM orchestration, and this project has no
 * component test setup (no jsdom, no testing library) to exercise it with.
 */
export function targetIdFromHash(hash: string): string | null {
  if (!hash || hash === '#') return null;
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;
  try {
    // A hash can arrive percent encoded. getElementById wants the real id.
    // raw is already known non-empty, and decoding cannot empty it.
    return decodeURIComponent(raw);
  } catch {
    // Malformed escape sequence. Fall back to the raw value rather than
    // throwing inside an effect, where it would break hydration.
    return raw;
  }
}
