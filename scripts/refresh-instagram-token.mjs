#!/usr/bin/env node
/**
 * Refresh the Instagram long-lived access token.
 * Tokens last 60 days — run this every ~50 days.
 *
 * Usage:
 *   node scripts/refresh-instagram-token.mjs
 *
 * Updates .env.local with the new token.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(PROJECT_ROOT, '.env.local');

// Load current token
const envContent = readFileSync(ENV_PATH, 'utf8');
const match = envContent.match(/^INSTAGRAM_ACCESS_TOKEN=(.+)$/m);
if (!match) {
  console.error('ERROR: INSTAGRAM_ACCESS_TOKEN not found in .env.local');
  process.exit(1);
}

const currentToken = match[1].trim();
console.log('Current token:', currentToken.slice(0, 20) + '...');

// Exchange for new long-lived token
const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`;

try {
  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    console.error('ERROR:', data.error.message);
    process.exit(1);
  }

  const newToken = data.access_token;
  const expiresIn = data.expires_in; // seconds

  // Update .env.local
  const updated = envContent.replace(
    /^INSTAGRAM_ACCESS_TOKEN=.+$/m,
    `INSTAGRAM_ACCESS_TOKEN=${newToken}`,
  );
  writeFileSync(ENV_PATH, updated);

  const expiresDate = new Date(Date.now() + expiresIn * 1000);
  console.log(`Token refreshed! Expires: ${expiresDate.toLocaleDateString()}`);
  console.log('Updated .env.local');
  console.log(`Remember to update the Vercel env var too.`);
} catch (err) {
  console.error('Failed to refresh token:', err.message);
  process.exit(1);
}
