/**
 * Azure SQL connection pool with exponential retry for cold starts.
 *
 * CRITICAL: This file is server-only. NEVER import from client components.
 * The mssql package uses Node.js net/tls modules that cannot be bundled for
 * the browser. All imports of db.ts must be from server components,
 * generateStaticParams, or API routes only.
 */
import sql from 'mssql';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const config: sql.config = {
  server: process.env.AZURE_SQL_SERVER!,
  database: process.env.AZURE_SQL_DATABASE!,
  user: process.env.AZURE_SQL_USER!,
  password: process.env.AZURE_SQL_PASSWORD!,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 120000, // 120s for Azure SQL cold start
    requestTimeout: 60000, // 60s — Azure SQL throttles during long builds
  },
};

let pool: sql.ConnectionPool | null = null;

// Semaphore to limit concurrent DB queries during builds.
// Azure SQL has a 30-connection limit. The semaphore is per-process, and
// Vercel runs N parallel build workers (set in next.config.ts cpus).
// Effective ceiling: cpus × MAX_CONCURRENT_QUERIES.
// Current setting: 3 × 7 = 21 — under Azure SQL's 30-conn limit with 9
// slots of headroom for retries. Pair with cpus=3 in next.config.ts for
// the architectural-fix transition deploy. After successful deploy where
// cache files settle into the new key format, both can go back up.
const MAX_CONCURRENT_QUERIES = 7;
let activeQueries = 0;
const queryQueue: (() => void)[] = [];

function acquireSlot(): Promise<void> {
  if (activeQueries < MAX_CONCURRENT_QUERIES) {
    activeQueries++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    queryQueue.push(() => { activeQueries++; resolve(); });
  });
}

function releaseSlot(): void {
  activeQueries--;
  const next = queryQueue.shift();
  if (next) next();
}

export async function getDb(): Promise<sql.ConnectionPool> {
  if (pool) return pool;
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      pool = await new sql.ConnectionPool(config).connect();
      return pool;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.min(5000 * Math.pow(2, attempt - 1), 60000);
      console.log(`DB connection attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Failed to connect to database');
}

async function closeDb(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

/* ─────────────────────────────────────────────────────────
 * Disk-based query cache for build-time static generation.
 *
 * Stores JSON results in .next/cache/sql/ which Vercel
 * preserves between deployments. Queries only hit the DB
 * on the first build or after a cache bust.
 *
 * Cache busting:
 *   - Per-season: bump version in .data-versions.json (auto-done by import scripts)
 *   - Per-week: .published-week tag (auto-done by publish-week.mjs)
 *   - Nuclear: set DB_CACHE_VERSION env var (avoid — rebuilds everything)
 * ───────────────────────────────────────────────────────── */

const CACHE_VERSION = process.env.DB_CACHE_VERSION ?? '1';

// Published-week tag: auto-invalidates caches when a new week is published.
// Written by scripts/publish-week.mjs (format: "s35-w4"), read once at startup.
let _publishedTag = '';
try {
  _publishedTag = fs.readFileSync(path.join(process.cwd(), '.published-week'), 'utf-8').trim();
} catch {
  // File doesn't exist yet — no tag applied
}
const PUBLISHED_TAG = _publishedTag;

// Extract the published season ID so season-scoped queries can skip invalidation
// for completed seasons (their data never changes).
const PUBLISHED_SEASON_ID = (() => {
  const m = PUBLISHED_TAG.match(/^s(\d+)-/);
  return m ? parseInt(m[1], 10) : 0;
})();

// Per-channel, per-season data versions: { "scores": { "35": 4 }, "schedule": { "17": 3 } }
// Bumped automatically by import scripts when data changes.
// cachedQuery includes the relevant channel version(s) in the hash so only
// affected queries re-run. Default version is 1 for unlisted seasons.
let DATA_VERSIONS: Record<string, Record<string, number>> = {};
try {
  const raw = fs.readFileSync(path.join(process.cwd(), '.data-versions.json'), 'utf-8');
  const parsed = JSON.parse(raw);
  // Support both old flat format { "17": 3 } and new channel format { "scores": { "17": 3 } }
  const firstValue = Object.values(parsed)[0];
  if (typeof firstValue === 'number') {
    // Legacy flat format — treat all as "scores" channel
    DATA_VERSIONS = { scores: parsed };
  } else {
    DATA_VERSIONS = parsed;
  }
} catch {
  // No data versions file — all seasons default to version 1
}

// Pre-compute a hash per channel for cross-season queries.
// Queries declare dependsOn: ['scores'] or ['schedule'] or both,
// so only the relevant channel hash is included.
const CHANNEL_HASHES: Record<string, string> = {};
for (const [channel, versions] of Object.entries(DATA_VERSIONS)) {
  CHANNEL_HASHES[channel] = crypto
    .createHash('md5')
    .update(JSON.stringify(versions))
    .digest('hex')
    .slice(0, 8);
}

// Legacy: combined hash of ALL channels for backward compat (allSeasons: true)
const ALL_VERSIONS_HASH = crypto
  .createHash('md5')
  .update(JSON.stringify(DATA_VERSIONS))
  .digest('hex')
  .slice(0, 8);

const VERSIONED_CACHE_DIR = path.join(process.cwd(), '.next', 'cache', 'sql', `v${CACHE_VERSION}`);
const STABLE_CACHE_DIR = path.join(process.cwd(), '.next', 'cache', 'sql', 'stable');

function readFromDiskCache<T>(key: string, stable?: boolean): T | undefined {
  try {
    const dir = stable ? STABLE_CACHE_DIR : VERSIONED_CACHE_DIR;
    const filePath = path.join(dir, `${key}.json`);
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch {
    return undefined; // cache miss
  }
}

function writeToDiskCache<T>(key: string, data: T, stable?: boolean): void {
  try {
    const dir = stable ? STABLE_CACHE_DIR : VERSIONED_CACHE_DIR;
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${key}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data));
  } catch {
    // Non-fatal — just skip caching
  }
}

/**
 * Execute a DB query with retry logic for Azure SQL throttling.
 * Retries up to `maxRetries` times with exponential backoff on timeout errors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      const isTimeout = code === 'ETIMEOUT' ||
        (err instanceof Error && err.message.includes('timed out'));
      if (!isTimeout || attempt === maxRetries) throw err;
      const delay = 5000 * attempt;
      console.log(`${label}: timeout on attempt ${attempt}/${maxRetries}, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      // Reset pool in case connection is stale
      if (pool) {
        try { await pool.close(); } catch { /* ignore */ }
        pool = null;
      }
    }
  }
  throw new Error(`${label}: all retries exhausted`);
}

/**
 * All-in-one query wrapper: disk cache → retry → error handling.
 *
 * 1. Checks disk cache — if hit, returns instantly (no DB needed)
 * 2. On cache miss, runs the query with retry (3 attempts with backoff)
 * 3. On success, writes result to disk cache for future builds
 * 4. On failure, logs warning and returns fallback (never caches failures)
 */
export async function cachedQuery<T>(
  key: string,
  fn: () => Promise<T>,
  fallback: T | readonly never[],
  options?: { stable?: boolean; sql?: string; seasonID?: number; allSeasons?: boolean; dependsOn?: string[] },
): Promise<T> {
  const stable = options?.stable;

  // Determine whether to include the published-week tag in the hash:
  //   stable: true              → never include tag (data never changes)
  //   dependsOn provided        → never include tag (channel hashes invalidate properly)
  //   seasonID without dependsOn → include tag only if seasonID matches published season
  //   neither                   → include tag always (legacy fallback; should be empty bucket)
  //
  // The dependsOn check is critical: cross-season bowler queries declare
  // dependsOn:['scores','schedule'] but have no seasonID. Without this rule
  // they'd fall into "non-seasonal, non-stable → always invalidate" and
  // every publish-week would invalidate ~570 bowler page caches at once.
  let usePublishedTag = false;
  if (!stable && PUBLISHED_TAG && !options?.dependsOn) {
    if (options?.seasonID != null) {
      // Season-scoped: only invalidate for the current season
      usePublishedTag = options.seasonID === PUBLISHED_SEASON_ID;
    } else {
      // Non-seasonal, non-stable, no dependsOn: legacy "always invalidate"
      // bucket. After 2026-04-07 audit this should be empty — every query
      // either has dependsOn, seasonID, or stable: true.
      usePublishedTag = true;
    }
  }

  // Data version tag: include per-season or all-seasons version in the hash
  // so data imports automatically invalidate the right queries.
  let dataVersionTag = '';
  if (!stable) {
    if (options?.dependsOn) {
      // Channel-specific: only hash the channels this query actually reads
      const channelParts = options.dependsOn
        .map(ch => CHANNEL_HASHES[ch] ?? '0')
        .join('-');
      dataVersionTag = channelParts;
    } else if (options?.allSeasons) {
      // Legacy fallback: hash of ALL versions
      dataVersionTag = ALL_VERSIONS_HASH;
    } else if (options?.seasonID != null) {
      // Season-scoped: combine all channel versions for this season
      const parts = Object.entries(DATA_VERSIONS)
        .map(([ch, versions]) => `${ch}${versions[String(options.seasonID)] ?? 1}`)
        .join('-');
      dataVersionTag = parts || `dv1`;
    }
  }

  const hashInput = [options?.sql ?? '', usePublishedTag ? PUBLISHED_TAG : '', dataVersionTag].filter(Boolean).join('|');
  const cacheKey = hashInput
    ? `${key}_${crypto.createHash('md5').update(hashInput).digest('hex').slice(0, 8)}`
    : key;

  // 1. Check disk cache
  const cached = readFromDiskCache<T>(cacheKey, stable);
  if (cached !== undefined) return cached;

  // 2. If no DB configured, return fallback
  if (!process.env.AZURE_SQL_SERVER) return fallback as T;

  // 3. Run query with retry (concurrency-limited)
  await acquireSlot();
  try {
    const result = await withRetry(fn, cacheKey);
    // 4. Cache successful result
    writeToDiskCache(cacheKey, result, stable);
    return result;
  } catch (err) {
    console.warn(`${cacheKey}: DB unavailable`, err);
    return fallback as T;
  } finally {
    releaseSlot();
  }
}
