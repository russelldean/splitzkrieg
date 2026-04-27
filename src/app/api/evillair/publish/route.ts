/**
 * POST /api/evillair/publish
 * Publish a week: update leagueSettings, then commit .published-week and
 * .data-versions.json to GitHub via the Git Data API (single commit) which
 * triggers a Vercel deploy automatically.
 */

import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { requireAdmin } from '@/lib/admin/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const GH_OWNER = 'russelldean';
const GH_REPO = 'splitzkrieg';
const GH_API = 'https://api.github.com';

async function ghFetch(path: string, opts: RequestInit = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not configured');
  const res = await fetch(`${GH_API}${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

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
      return NextResponse.json({ error: 'seasonID and week are required' }, { status: 400 });
    }

    const db = await getDb();

    // 1. Update publishedWeek + publishedSeasonID in leagueSettings
    await db.request()
      .input('val', sql.VarChar(255), String(week))
      .query(`UPDATE leagueSettings SET settingValue = @val WHERE settingKey = 'publishedWeek'`);
    await db.request()
      .input('val', sql.VarChar(255), String(seasonID))
      .query(`UPDATE leagueSettings SET settingValue = @val WHERE settingKey = 'publishedSeasonID'`);

    // 2. Find which bowlers bowled this week (to bump per-bowler cache versions)
    const bowlerResult = await db.request()
      .input('seasonID', sql.Int, seasonID)
      .input('week', sql.Int, week)
      .query<{ bowlerID: number }>(
        `SELECT DISTINCT bowlerID FROM scores WHERE seasonID = @seasonID AND week = @week AND isPenalty = 0 AND bowlerID IS NOT NULL`
      );
    const bowlerIDs = bowlerResult.recordset.map(r => r.bowlerID);

    // 3. Fetch current .data-versions.json from GitHub
    const tag = `s${seasonID}-w${week}`;
    const repo = `repos/${GH_OWNER}/${GH_REPO}`;

    const dvFile = await ghFetch(`/${repo}/contents/.data-versions.json`);
    const versions: Record<string, Record<string, number>> = JSON.parse(
      Buffer.from(dvFile.content as string, 'base64').toString('utf-8')
    );

    // 4. Bump scores channel version for this season (busts season-scoped pages)
    if (!versions.scores) versions.scores = {};
    const sKey = String(seasonID);
    versions.scores[sKey] = (versions.scores[sKey] ?? 1) + 1;

    // 5. Bump per-bowler versions (only bowlers who bowled this week)
    if (!versions.bowlers) versions.bowlers = {};
    for (const id of bowlerIDs) {
      const k = String(id);
      versions.bowlers[k] = (versions.bowlers[k] ?? 1) + 1;
    }

    // 6. Commit both files in a single Git commit via the Data API
    //    so only one Vercel deploy fires.
    const refData = await ghFetch(`/${repo}/git/refs/heads/main`);
    const headSha: string = refData.object.sha;
    const commitData = await ghFetch(`/${repo}/git/commits/${headSha}`);
    const treeSha: string = commitData.tree.sha;

    const [dvBlob, pwBlob] = await Promise.all([
      ghFetch(`/${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: JSON.stringify(versions, null, 2) + '\n', encoding: 'utf-8' }),
      }),
      ghFetch(`/${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: tag + '\n', encoding: 'utf-8' }),
      }),
    ]);

    const newTree = await ghFetch(`/${repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: treeSha,
        tree: [
          { path: '.data-versions.json', mode: '100644', type: 'blob', sha: dvBlob.sha },
          { path: '.published-week', mode: '100644', type: 'blob', sha: pwBlob.sha },
        ],
      }),
    });

    const newCommit = await ghFetch(`/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message: `publish: ${tag}`,
        tree: newTree.sha,
        parents: [headSha],
      }),
    });

    await ghFetch(`/${repo}/git/refs/heads/main`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommit.sha }),
    });

    return NextResponse.json({
      published: true,
      seasonID,
      week,
      tag,
      commit: newCommit.sha,
      bowlersBumped: bowlerIDs.length,
    });
  } catch (err) {
    console.error('Publish error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to publish' },
      { status: 500 },
    );
  }
}
