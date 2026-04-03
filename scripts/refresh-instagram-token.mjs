#!/usr/bin/env node
/**
 * Refresh the Instagram long-lived access token.
 * Tokens last 60 days — run this every ~50 days.
 *
 * Usage:
 *   node scripts/refresh-instagram-token.mjs
 *
 * Updates both .env.local and Vercel production env var.
 * Sends email notification via Resend with result.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(PROJECT_ROOT, '.env.local');

// Load env for Resend
const envContent = readFileSync(ENV_PATH, 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

async function sendNotification(subject, body) {
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RECAP_FROM_ADDRESS || 'Splitzkrieg <noreply@splitzkrieg.com>',
      to: 'charlesrusselldean@gmail.com',
      subject,
      html: `<div style="font-family: -apple-system, sans-serif; max-width: 500px; padding: 24px;">
        <p style="color: #333; line-height: 1.6;">${body}</p>
      </div>`,
    });
  } catch (err) {
    console.error('Failed to send notification email:', err.message);
  }
}

// Load current token
const match = envContent.match(/^INSTAGRAM_ACCESS_TOKEN=(.+)$/m);
if (!match) {
  console.error('ERROR: INSTAGRAM_ACCESS_TOKEN not found in .env.local');
  await sendNotification(
    'Instagram Token Refresh FAILED',
    'INSTAGRAM_ACCESS_TOKEN not found in .env.local. The Instagram feed will stop working in ~10 days. Run <code>node scripts/refresh-instagram-token.mjs</code> manually after fixing.'
  );
  process.exit(1);
}

const currentToken = match[1].trim();
console.log('Current token:', currentToken.slice(0, 20) + '...');

// Refresh the long-lived token
const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`;

try {
  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    console.error('ERROR:', data.error.message);
    await sendNotification(
      'Instagram Token Refresh FAILED',
      `Instagram API returned an error: <strong>${data.error.message}</strong>. The Instagram feed will stop working when the current token expires. You may need to generate a new token in the Meta developer portal.`
    );
    process.exit(1);
  }

  const newToken = data.access_token;
  const expiresIn = data.expires_in; // seconds
  const expiresDate = new Date(Date.now() + expiresIn * 1000);

  // Update .env.local
  const updated = envContent.replace(
    /^INSTAGRAM_ACCESS_TOKEN=.+$/m,
    `INSTAGRAM_ACCESS_TOKEN=${newToken}`,
  );
  writeFileSync(ENV_PATH, updated);
  console.log('Updated .env.local');

  // Update Vercel production env var
  let vercelOk = false;
  try {
    execSync(
      `echo "${newToken}" | npx vercel env rm INSTAGRAM_ACCESS_TOKEN production -y 2>/dev/null; echo "${newToken}" | npx vercel env add INSTAGRAM_ACCESS_TOKEN production`,
      { cwd: PROJECT_ROOT, stdio: 'pipe' },
    );
    console.log('Updated Vercel production env var');
    vercelOk = true;
  } catch (err) {
    console.error('Failed to update Vercel env var:', err.message);
  }

  const dateStr = expiresDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  console.log(`Token refreshed! Expires: ${dateStr}`);

  await sendNotification(
    'Instagram Token Refreshed',
    `Token refreshed successfully. New token expires <strong>${dateStr}</strong>.${vercelOk ? '' : '<br><br><strong>Warning:</strong> Failed to update Vercel env var. Update it manually in the Vercel dashboard.'}`
  );

  console.log('Done!');
} catch (err) {
  console.error('Failed to refresh token:', err.message);
  await sendNotification(
    'Instagram Token Refresh FAILED',
    `Script crashed: <strong>${err.message}</strong>. The Instagram feed will stop working when the current token expires. Run the script manually to debug.`
  );
  process.exit(1);
}
