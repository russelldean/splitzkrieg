import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import {
  deleteScoresForWeek,
  insertScores,
  runMatchResults,
  runPatches,
  recordMilestones,
  bumpCacheAndPublish,
} from '@/lib/admin/scores';
import type { StagedMatch } from '@/lib/admin/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { seasonID, week, matches } = body as {
      seasonID: number;
      week: number;
      matches: StagedMatch[];
    };

    if (!seasonID || !week || !matches || !Array.isArray(matches)) {
      return NextResponse.json(
        { error: 'Missing required fields: seasonID, week, matches' },
        { status: 400 },
      );
    }

    // Run the full pipeline SEQUENTIALLY (Azure SQL 30-connection limit)

    // 1. Delete old scores for this week
    const deleted = await deleteScoresForWeek(seasonID, week);

    // 2. Insert new scores
    const { inserted, personalBests } = await insertScores(
      seasonID,
      week,
      matches,
    );

    // 3. Run match results for this season (scoped to week)
    const matchResultCount = await runMatchResults(seasonID, week);

    // 4. Run patches for this season and week
    const patches = await runPatches(seasonID, week);

    // 5. Record career milestones
    const milestoneCount = await recordMilestones(seasonID, week);

    // 6. Bump cache versions
    await bumpCacheAndPublish(seasonID, week);

    return NextResponse.json({
      deleted,
      inserted,
      personalBests,
      matchResultCount,
      patches,
      milestoneCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Score confirm error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
