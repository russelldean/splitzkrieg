/**
 * Assertions for the post-deploy smoke check.
 *
 * Pure functions over an already-fetched page, so they can be tested without
 * touching the network. scripts/smoke-check.mjs does the fetching.
 *
 * These exist because nothing in this repo ever looked at what the site
 * actually served. Two long-lived bugs are the reason:
 *
 *   - every page title rendered the site name twice, for a very long time,
 *     because no check ever read a <title>
 *   - an admin action was discarding all ~1179 prebuilt pages, so the next
 *     visitor to any page paid for a live render against Azure SQL. It
 *     surfaced only when someone noticed a click taking 15 seconds
 *
 * The cache-health check is aimed squarely at the second one.
 */

/**
 * Cache states where the visitor got a fast, already-built response.
 *
 * PRERENDER means served straight from the deployment's static output, which
 * is the healthiest state of all: the page has not needed regenerating since
 * the build. Right after a deploy every page reports it.
 *
 * STALE means the entry was past its window but the visitor still got the
 * cached copy immediately while it refreshed behind them.
 */
const HEALTHY_CACHE = new Set(['HIT', 'STALE', 'PRERENDER']);

/**
 * States where the visitor waited on a render. For a route that was prebuilt
 * at deploy time, this means its entry was invalidated or evicted.
 */
const REGENERATED_CACHE = new Set(['MISS', 'REVALIDATED']);

export const DEFAULTS = {
  /** A prebuilt page taking longer than this means it was not served warm. */
  latencyWarnMs: 2000,
  latencyFailMs: 8000,
  /** Above this share of regenerated samples, assume a site-wide purge. */
  purgeSuspicionRatio: 0.5,
};

function header(headers, name) {
  if (!headers) return undefined;
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (direct !== undefined) return Array.isArray(direct) ? direct[0] : direct;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? (Array.isArray(headers[key]) ? headers[key][0] : headers[key]) : undefined;
}

export function extractTitle(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html ?? '');
  return m ? m[1].trim() : null;
}

/**
 * Checks that apply to any public page.
 * Returns [{ level: 'error'|'warn', code, message }].
 */
export function checkPage({ url, status, headers, html, durationMs }, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const findings = [];

  if (status !== 200) {
    findings.push({ level: 'error', code: 'STATUS', message: `${url} returned ${status}` });
    return findings;
  }

  const title = extractTitle(html);
  if (!title) {
    findings.push({ level: 'error', code: 'NO_TITLE', message: `${url} has no <title>` });
  } else {
    // The bug that survived for months: generateMetadata appended the site
    // name while the root layout template appended it again.
    const doubled = /(\|\s*Splitzkrieg\s*){2,}$/i.test(title);
    if (doubled) {
      findings.push({
        level: 'error',
        code: 'DOUBLED_TITLE',
        message: `${url} title repeats the site name: "${title}"`,
      });
    }
    if (/—/.test(title)) {
      findings.push({
        level: 'error',
        code: 'EM_DASH_TITLE',
        message: `${url} title contains an em dash: "${title}"`,
      });
    }
  }

  if (typeof durationMs === 'number') {
    if (durationMs >= cfg.latencyFailMs) {
      findings.push({
        level: 'error',
        code: 'SLOW',
        message: `${url} took ${Math.round(durationMs)}ms (budget ${cfg.latencyFailMs}ms)`,
      });
    } else if (durationMs >= cfg.latencyWarnMs) {
      findings.push({
        level: 'warn',
        code: 'SLOW',
        message: `${url} took ${Math.round(durationMs)}ms`,
      });
    }
  }

  return findings;
}

/** Normalised cache state for one sampled page. */
export function cacheState({ headers }) {
  const raw = (header(headers, 'x-vercel-cache') ?? '').toUpperCase();
  if (HEALTHY_CACHE.has(raw)) return 'warm';
  if (REGENERATED_CACHE.has(raw)) return 'regenerated';
  if (raw === 'BYPASS') return 'bypass';
  return 'unknown';
}

/**
 * The check that would have caught the purge bug on its own.
 *
 * Every sampled route is prebuilt, so shortly after a deploy they should all
 * be warm. If most of them had to be regenerated, something invalidated the
 * build, and real visitors are paying for live renders.
 */
export function checkCacheHealth(samples, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const findings = [];
  if (samples.length === 0) return findings;

  const states = samples.map((s) => ({ url: s.url, state: cacheState(s) }));
  const regenerated = states.filter((s) => s.state === 'regenerated');
  const bypassed = states.filter((s) => s.state === 'bypass');

  for (const b of bypassed) {
    findings.push({
      level: 'error',
      code: 'CACHE_BYPASS',
      message: `${b.url} bypassed the cache entirely; a prebuilt route should never do that`,
    });
  }

  const ratio = regenerated.length / samples.length;
  if (ratio >= cfg.purgeSuspicionRatio) {
    findings.push({
      level: 'error',
      code: 'PURGED',
      message:
        `${regenerated.length}/${samples.length} prebuilt pages had to be regenerated. ` +
        `That is the signature of a site-wide purge (revalidatePath with 'layout'), ` +
        `which throws away the build and makes the next visitor to each page wait ` +
        `on a live render.`,
    });
  } else if (regenerated.length > 0) {
    findings.push({
      level: 'warn',
      code: 'SOME_REGENERATED',
      message: `${regenerated.length}/${samples.length} sampled pages were regenerated`,
    });
  }

  return findings;
}
