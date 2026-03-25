#!/usr/bin/env node
/**
 * Send a weekly recap email via Resend.
 *
 * Usage:
 *   node scripts/send-recap-email.mjs --week=4 --season=XXXV
 *   node scripts/send-recap-email.mjs --slug=season-xxxv-week-4-recap --subject="Week 4 Recap is Live!"
 *   node scripts/send-recap-email.mjs --week=4 --season=XXXV --teaser="Three career highs and a debut!"
 *   node scripts/send-recap-email.mjs --week=4 --season=XXXV --to=someone@example.com
 *
 * Requires RESEND_API_KEY in .env.local
 */

import { Resend } from 'resend';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// Load env
const envContent = readFileSync(resolve(PROJECT_ROOT, '.env.local'), 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

if (!process.env.RESEND_API_KEY) {
  console.error('ERROR: RESEND_API_KEY not found in .env.local');
  process.exit(1);
}

// Parse args
const args = process.argv.slice(2);
const getArg = (prefix) => {
  const arg = args.find(a => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
};

const weekNum = getArg('--week=');
const seasonRoman = getArg('--season=') ?? 'XXXV';
const customSlug = getArg('--slug=');
const customSubject = getArg('--subject=');
const customTeaser = getArg('--teaser=');
const bullets = args.filter(a => a.startsWith('--bullet=')).map(a => a.slice('--bullet='.length));
const toAddress = getArg('--to=') ?? 'splitzkrieg-bowlers@googlegroups.com';
const dryRun = args.includes('--dry-run');

if (!weekNum && !customSlug) {
  console.error('Usage:');
  console.error('  node scripts/send-recap-email.mjs --week=4 --season=XXXV');
  console.error('  node scripts/send-recap-email.mjs --slug=season-xxxv-week-4-recap --subject="..."');
  console.error('');
  console.error('Options:');
  console.error('  --week=N          Week number (auto-generates slug and subject)');
  console.error('  --season=ROMAN    Season roman numeral (default: XXXV)');
  console.error('  --slug=SLUG       Custom blog post slug');
  console.error('  --subject=TEXT    Custom email subject');
  console.error('  --teaser=TEXT     Teaser paragraph for the email body');
  console.error('  --bullet=TEXT     Add a bullet point to "What\'s new" section (can use multiple times)');
  console.error('  --to=EMAIL        Recipient (default: splitzkrieg-bowlers@googlegroups.com)');
  console.error('  --dry-run         Print email without sending');
  process.exit(1);
}

// Build slug and subject
const slug = customSlug ?? `season-${seasonRoman.toLowerCase()}-week-${weekNum}-recap`;
const subject = customSubject ?? `Week ${weekNum} Recap is Live!`;
const blogUrl = `https://splitzkrieg.com/blog/${slug}`;
const teaser = customTeaser ?? `This week's scores are in. Check out who topped the charts and who made their mark.`;

// Build HTML email
const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f0e8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f0e8; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td style="background-color: #1a1f3d; padding: 24px 32px; text-align: center;">
              <h1 style="margin: 0; color: #f5f0e8; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                Splitzkrieg
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px;">
              <h2 style="margin: 0 0 16px; color: #1a1f3d; font-size: 22px; font-weight: 600;">
                ${subject}
              </h2>
              <p style="margin: 0 0 24px; color: #333; font-size: 16px; line-height: 1.6;">
                ${teaser}
              </p>
              ${bullets.length > 0 ? `
              <div style="margin: 0 0 24px; padding: 16px; background-color: #faf7f2; border-radius: 8px;">
                <p style="margin: 0 0 8px; color: #1a1f3d; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                  What's new on the site
                </p>
                <ul style="margin: 0; padding: 0 0 0 18px; color: #333; font-size: 15px; line-height: 1.8;">
                  ${bullets.map(b => `<li>${b}</li>`).join('\n                  ')}
                </ul>
              </div>
              ` : ''}
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #c41e3a; border-radius: 6px;">
                    <a href="${blogUrl}"
                       style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Read the Full Recap
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f5f0e8; padding: 20px 32px; text-align: center;">
              <p style="margin: 0; color: #888; font-size: 13px; line-height: 1.5;">
                You're receiving this because you're in the Splitzkrieg bowling league.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

async function main() {
  console.log('Recap Email');
  console.log('  To:      ' + toAddress);
  console.log('  Subject: ' + subject);
  console.log('  Blog:    ' + blogUrl);
  console.log('  Teaser:  ' + teaser.substring(0, 80) + (teaser.length > 80 ? '...' : ''));
  if (bullets.length > 0) {
    console.log('  Bullets: ' + bullets.length + ' item(s)');
    bullets.forEach((b, i) => console.log('    ' + (i + 1) + '. ' + b));
  }
  console.log('');

  if (dryRun) {
    console.log('=== DRY RUN ===');
    console.log('HTML preview:');
    console.log(html);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { data, error } = await resend.emails.send({
      from: 'Splitzkrieg <noreply@splitzkrieg.com>',
      to: [toAddress],
      subject,
      html,
    });

    if (error) {
      console.error('Resend error:', JSON.stringify(error, null, 2));
      if (error.statusCode === 403) {
        console.error('');
        console.error('403 Forbidden — this usually means the from domain is not verified in Resend.');
        console.error('Go to https://resend.com/domains and verify splitzkrieg.com.');
      }
      process.exit(1);
    }

    console.log('Email sent successfully.');
    console.log('  Resend ID: ' + data.id);
  } catch (err) {
    console.error('Failed to send email:', err.message);
    if (err.message.includes('403') || err.message.includes('forbidden')) {
      console.error('');
      console.error('This usually means the from domain is not verified in Resend.');
      console.error('Go to https://resend.com/domains and verify splitzkrieg.com.');
    }
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
