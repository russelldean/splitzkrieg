import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getAllUpdates } from '@/lib/admin/updates-db';

export const dynamic = 'force-dynamic';

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { date: string };
  };
}

/** Prefixes that are never user-facing */
const SKIP_PREFIXES = ['chore', 'docs', 'ci', 'build', 'test', 'style', 'refactor', 'perf'];

/**
 * GET: Suggest site update entries from recent GitHub commits.
 * Query params: ?since=YYYY-MM-DD (defaults to 7 days ago)
 *
 * Filters out non-user-facing commits (chore, docs, ci, etc.)
 * and deduplicates against existing site updates.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'GITHUB_TOKEN not configured' },
      { status: 500 },
    );
  }

  const sinceParam = request.nextUrl.searchParams.get('since');
  const since = sinceParam || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  try {
    const owner = process.env.GITHUB_OWNER ?? 'russelldean';
    const repo = process.env.GITHUB_REPO ?? 'splitzkrieg';
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?since=${since}T00:00:00Z&per_page=100`;

    const [res, existingUpdates] = await Promise.all([
      fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      }),
      getAllUpdates(),
    ]);

    if (!res.ok) {
      const text = await res.text();
      console.error('GitHub API error:', res.status, text);
      return NextResponse.json(
        { error: `GitHub API error: ${res.status}` },
        { status: 502 },
      );
    }

    const commits: GitHubCommit[] = await res.json();

    // Build a set of existing update texts (lowercased) for deduplication
    const existingTexts = new Set(
      existingUpdates.map((u) => u.text.toLowerCase().trim()),
    );

    // Parse commit messages into update suggestions
    const suggestions = commits
      .map((c) => {
        const msg = c.commit.message.split('\n')[0]; // first line only
        const date = c.commit.author.date.split('T')[0];

        // Detect prefix before stripping
        const prefixMatch = msg.match(/^(feat|fix|chore|docs|style|refactor|perf|test|ci|build)(\([^)]*\))?:\s*/i);
        const prefix = prefixMatch ? prefixMatch[1].toLowerCase() : null;
        const scope = prefixMatch?.[2]?.replace(/[()]/g, '').toLowerCase() ?? null;
        const tag = prefix === 'fix' ? 'fix' : 'feat';

        // Strip conventional commit prefix for cleaner text
        const text = msg
          .replace(/^(feat|fix|chore|docs|style|refactor|perf|test|ci|build)(\([^)]*\))?:\s*/i, '')
          .trim();

        return { date, text, tag, sha: c.sha.slice(0, 7), prefix, scope };
      })
      .filter((s) => {
        // Filter out merge commits and very short messages
        if (s.text.toLowerCase().startsWith('merge') || s.text.length <= 10) return false;
        // Filter out non-user-facing prefixes
        if (s.prefix && SKIP_PREFIXES.includes(s.prefix)) return false;
        // Filter out admin-only scoped commits
        if (s.scope === 'admin') return false;
        // Deduplicate against existing updates
        if (existingTexts.has(s.text.toLowerCase().trim())) return false;
        return true;
      })
      // Remove internal fields before sending to client
      .map(({ prefix: _p, scope: _s, ...rest }) => rest)
      // Newest first
      .reverse();

    return NextResponse.json({ suggestions, since });
  } catch (err) {
    console.error('Admin updates suggest error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch commits' },
      { status: 500 },
    );
  }
}
