/**
 * Environment loading for the DB scripts.
 *
 * Every script in scripts/ did an unguarded
 * `readFileSync(resolve(ROOT, '.env.local'))`, which is fine on Russ's machine
 * and throws immediately anywhere else. That is one reason none of these ever
 * ran on a schedule: they could not start in CI, where credentials arrive as
 * environment variables and there is no .env.local on disk.
 *
 * Real environment variables always win. A value already in process.env is
 * never overwritten by the file, so CI secrets take precedence and a local
 * one-off `AZURE_SQL_DATABASE=... node scripts/...` still works.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const REQUIRED_DB_VARS = [
  'AZURE_SQL_SERVER',
  'AZURE_SQL_DATABASE',
  'AZURE_SQL_USER',
  'AZURE_SQL_PASSWORD',
];

/**
 * Parse .env.local contents. Exported for testing.
 * Skips blanks and comments, keeps '=' inside values, strips matched quotes.
 */
export function parseEnvFile(contents) {
  const out = {};
  for (const line of (contents ?? '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Which required vars are still missing once file values fill the gaps.
 * Pure, so the failure path is testable without touching the environment.
 */
export function missingVars(env, fileValues = {}, required = REQUIRED_DB_VARS) {
  return required.filter((k) => !(env[k] ?? fileValues[k]));
}

/**
 * Load credentials into process.env and return the mssql connection config.
 * Throws with a readable message naming what is missing.
 */
export function loadEnv({ required = REQUIRED_DB_VARS, envPath = resolve(ROOT, '.env.local') } = {}) {
  const fileValues = existsSync(envPath)
    ? parseEnvFile(readFileSync(envPath, 'utf-8'))
    : {};

  for (const [k, v] of Object.entries(fileValues)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }

  const missing = missingVars(process.env, {}, required);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
      (existsSync(envPath)
        ? `Not found in ${envPath} or the environment.`
        : `No .env.local at ${envPath}; in CI these come from repository secrets.`),
    );
  }

  return {
    server: process.env.AZURE_SQL_SERVER,
    database: process.env.AZURE_SQL_DATABASE,
    user: process.env.AZURE_SQL_USER,
    password: process.env.AZURE_SQL_PASSWORD,
    options: { encrypt: true, trustServerCertificate: false },
  };
}
