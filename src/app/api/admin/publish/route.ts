/**
 * POST /api/admin/publish
 * Publish a week: update leagueSettings, bump cache, write .published-week, trigger revalidation.
 * Separate from score confirmation per CONTEXT.md locked decision.
 */

import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { requireAdmin } from '@/lib/admin/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { seasonID, week } = body as { seasonID: number; week: number };

    if (!seasonID || !week) {
      return NextResponse.json(
        { error: 'seasonID and week are required' },
        { status: 400 },
      );
    }

    const db = await getDb();

    // Update publishedWeek in leagueSettings
    await db
      .request()
      .input('val', sql.VarChar(255), String(week))
      .query(
        `UPDATE leagueSettings SET settingValue = @val WHERE settingKey = 'publishedWeek'`,
      );

    // Update publishedSeasonID in leagueSettings
    await db
      .request()
      .input('val', sql.VarChar(255), String(seasonID))
      .query(
        `UPDATE leagueSettings SET settingValue = @val WHERE settingKey = 'publishedSeasonID'`,
      );

    // Write .published-week file and bump cache versions
    // These are local-only operations; on Vercel the filesystem is read-only
    // so we skip silently -- the DB updates and revalidation are what matter
    const projectRoot = process.cwd();
    const tag = `s${seasonID}-w${week}`;

    try {
      const tagPath = path.join(projectRoot, '.published-week');
      fs.writeFileSync(tagPath, tag + '\n');

      const versionsPath = path.join(projectRoot, '.data-versions.json');
      let versions: Record<string, Record<string, number>> = {};
      try {
        versions = JSON.parse(fs.readFileSync(versionsPath, 'utf-8'));
      } catch {
        // File doesn't exist yet
      }

      if (!versions.scores) versions.scores = {};
      const key = String(seasonID);
      versions.scores[key] = (versions.scores[key] || 1) + 1;
      fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2) + '\n');

      // Clear local cache files for this season
      const cacheDir = path.join(projectRoot, '.next', 'cache', 'sql', 'v1');
      const files = fs.readdirSync(cacheDir);
      for (const f of files) {
        if (f.includes(`-${seasonID}_`) || f.includes(`-${seasonID}-`)) {
          fs.unlinkSync(path.join(cacheDir, f));
        }
      }
    } catch {
      // Read-only filesystem on Vercel or cache dir missing -- safe to skip
    }

    // Trigger ISR revalidation
    const revalidationSecret = process.env.REVALIDATION_SECRET;
    if (revalidationSecret) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://splitzkrieg.com';
        await fetch(`${baseUrl}/api/revalidate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: revalidationSecret }),
        });
      } catch (revalErr) {
        // Revalidation failure is non-fatal; site will pick up changes on next build
        console.warn('Revalidation request failed:', revalErr);
      }
    }

    return NextResponse.json({
      published: true,
      seasonID,
      week,
      tag,
    });
  } catch (err) {
    console.error('Publish error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to publish' },
      { status: 500 },
    );
  }
}
