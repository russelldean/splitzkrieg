import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sql from 'mssql';
import { requireAdminOrWriter } from '@/lib/admin/auth';
import { getDb, withRetry } from '@/lib/db';
import { deriveWeekStatus, type WeekCounts } from '@/lib/admin/week-status';

export const dynamic = 'force-dynamic';

const run = promisify(execFile);

/**
 * How many commits are staged locally but not pushed.
 *
 * Null on a deployed server, where there is no working tree to inspect. That is
 * an honest "cannot know from here", not a zero: reporting zero would tell the
 * reader everything is deployed when nothing was checked.
 */
async function commitsAhead(): Promise<number | null> {
  try {
    const { stdout } = await run('git', ['rev-list', '--count', 'origin/main..HEAD'], {
      cwd: process.cwd(),
      timeout: 5000,
    });
    const n = parseInt(stdout.trim(), 10);
    return Number.isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

/**
 * GET /api/evillair/week-status?seasonID=36&week=4
 *
 * Everything here is read back out of the system rather than recorded when a
 * button was clicked, so the answer cannot drift from reality.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminOrWriter(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const seasonID = parseInt(request.nextUrl.searchParams.get('seasonID') ?? '', 10);
  const week = parseInt(request.nextUrl.searchParams.get('week') ?? '', 10);
  if (Number.isNaN(seasonID) || Number.isNaN(week)) {
    return NextResponse.json({ error: 'seasonID and week are required' }, { status: 400 });
  }

  try {
    const db = await getDb();
    // One round trip: the pipeline is sequential against a 30-connection cap,
    // so this should not fan out into six parallel queries.
    const result = await withRetry(
      () =>
        db
          .request()
          .input('seasonID', sql.Int, seasonID)
          .input('week', sql.Int, week)
          .query<{
            scores: number;
            turkeys: number;
            matchResults: number;
            patches: number;
            milestones: number;
            facts: number;
            heroImage: string | null;
            // LEN() comes back as a string over tedious, so coerce below.
            writeupChars: number | string | null;
            emailSentAt: string | null;
          }>(`
            SELECT
              (SELECT COUNT(*) FROM scores
                 WHERE seasonID = @seasonID AND week = @week AND isPenalty = 0)      AS scores,
              (SELECT ISNULL(SUM(turkeys), 0) FROM scores
                 WHERE seasonID = @seasonID AND week = @week AND isPenalty = 0)      AS turkeys,
              (SELECT COUNT(*) FROM matchResults mr
                 JOIN schedule s ON s.scheduleID = mr.scheduleID
                 WHERE s.seasonID = @seasonID AND s.week = @week)                    AS matchResults,
              (SELECT COUNT(*) FROM bowlerPatches
                 WHERE seasonID = @seasonID AND week = @week)                        AS patches,
              (SELECT COUNT(*) FROM bowlerMilestones
                 WHERE seasonID = @seasonID AND week = @week)                        AS milestones,
              (SELECT COUNT(*) FROM facts
                 WHERE seasonID = @seasonID AND week = @week)                        AS facts,
              -- blogPosts.seasonID is NULL on all but one row; posts carry their
              -- season as seasonRomanNumeral / seasonSlug instead. Match either,
              -- or the board reports "no photo" for weeks that plainly have one.
              (SELECT TOP 1 heroImage FROM blogPosts
                 WHERE week = @week
                   AND (seasonID = @seasonID
                        OR seasonRomanNumeral = (SELECT romanNumeral FROM seasons
                                                   WHERE seasonID = @seasonID)))     AS heroImage,
              (SELECT TOP 1 LEN(ISNULL(content, '')) FROM blogPosts
                 WHERE week = @week
                   AND (seasonID = @seasonID
                        OR seasonRomanNumeral = (SELECT romanNumeral FROM seasons
                                                   WHERE seasonID = @seasonID)))     AS writeupChars,
              (SELECT TOP 1 settingValue FROM leagueSettings
                 WHERE settingKey = CONCAT('emailSent-s', @seasonID, '-w', @week)) AS emailSentAt
          `),
      'week-status',
    );

    const row = result.recordset[0];
    const counts: WeekCounts = {
      scores: row?.scores ?? 0,
      turkeys: row?.turkeys ?? 0,
      matchResults: row?.matchResults ?? 0,
      patches: row?.patches ?? 0,
      milestones: row?.milestones ?? 0,
      facts: row?.facts ?? 0,
      heroImage: row?.heroImage ?? null,
      writeupChars: Number(row?.writeupChars ?? 0) || 0,
      emailSentAt: row?.emailSentAt ?? null,
      commitsAhead: await commitsAhead(),
    };

    return NextResponse.json({ seasonID, week, counts, steps: deriveWeekStatus(counts) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[WEEK_STATUS]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
