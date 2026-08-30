/**
 * GET /api/cron/data-integrity
 *
 * Runs the data invariants against the live database and emails only when
 * something is wrong.
 *
 * Why this lives here rather than only in GitHub Actions: Vercel already holds
 * the database credentials, so nothing has to be copied anywhere new. Adding
 * them to a second system means a second place to rotate, a second place to
 * leak from, and a check that sits switched off until someone gets round to
 * it. This runs off infrastructure that already exists and is already proven.
 *
 * It also pushes rather than waits. A red run in Actions is only useful to
 * someone who goes and looks; this arrives in the inbox.
 *
 * Secured with CRON_SECRET, matching /api/cron/lineup-reminder.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getDb } from '@/lib/db';
import { INVARIANTS, evaluate } from '@/lib/data-invariants.mjs';
import { shouldAlert, subjectFor, bodyFor } from '@/lib/data-integrity-report.mjs';

export const dynamic = 'force-dynamic';

// 17 counting queries, run one at a time on a 5 DTU tier, plus a cold start.
// Must be a literal; Next reads it statically.
export const maxDuration = 60;

const ALERT_TO = 'charlesrusselldean@gmail.com';

async function alert(payload: {
  findings: { message: string }[];
  error?: string;
  checked: number;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[DATA-INTEGRITY] RESEND_API_KEY not set; alert not sent');
    return false;
  }
  try {
    await new Resend(apiKey).emails.send({
      from: process.env.RESEND_FROM ?? 'Splitzkrieg <noreply@splitzkrieg.com>',
      to: ALERT_TO,
      subject: subjectFor(payload),
      text: bodyFor({ ...payload, ranAt: new Date().toISOString() }),
    });
    return true;
  } catch (err) {
    console.error('[DATA-INTEGRITY] alert email failed:', err);
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const findings: { name: string; message: string }[] = [];

  try {
    const db = await getDb();

    for (const invariant of INVARIANTS) {
      const res = await db.request().query<{ n: number }>(invariant.sql);
      const finding = evaluate(invariant, res.recordset[0]?.n ?? 0);
      if (finding) findings.push({ name: finding.name, message: finding.message });
    }
  } catch (err) {
    // A failure to run is NOT a pass. Say so loudly and return 500 so the
    // platform records it as a failed invocation rather than a quiet success.
    const message = err instanceof Error ? err.message : String(err);
    console.error('[DATA-INTEGRITY] check could not run:', message);
    await alert({ findings: [], error: message, checked: INVARIANTS.length });
    return NextResponse.json(
      { ok: false, ran: false, error: message },
      { status: 500 },
    );
  }

  const payload = { findings, checked: INVARIANTS.length };

  if (shouldAlert(payload)) {
    const emailed = await alert(payload);
    console.error(
      `[DATA-INTEGRITY] ${findings.length} violation(s): ` +
      findings.map((f) => f.name).join(', '),
    );
    return NextResponse.json({
      ok: false,
      ran: true,
      checked: INVARIANTS.length,
      violations: findings,
      emailed,
    });
  }

  return NextResponse.json({ ok: true, ran: true, checked: INVARIANTS.length, violations: [] });
}
