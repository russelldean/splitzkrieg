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

export async function closeDb(): Promise<void> {
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
 *   - Set DB_CACHE_VERSION env var (default: "1")
 *   - Or use Vercel's "Redeploy without cache" option
 * ───────────────────────────────────────────────────────── */

const CACHE_VERSION = process.env.DB_CACHE_VERSION ?? '1';
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
  options?: { stable?: boolean; sql?: string },
): Promise<T> {
  const stable = options?.stable;

  // Include SQL hash in cache key so query changes auto-invalidate
  const cacheKey = options?.sql
    ? `${key}_${crypto.createHash('md5').update(options.sql).digest('hex').slice(0, 8)}`
    : key;

  // 1. Check disk cache
  const cached = readFromDiskCache<T>(cacheKey, stable);
  if (cached !== undefined) return cached;

  // 2. If no DB configured, return fallback
  if (!process.env.AZURE_SQL_SERVER) return fallback as T;

  // 3. Run query with retry
  try {
    const result = await withRetry(fn, cacheKey);
    // 4. Cache successful result
    writeToDiskCache(cacheKey, result, stable);
    return result;
  } catch (err) {
    console.warn(`${cacheKey}: DB unavailable`, err);
    return fallback as T;
  }
}
