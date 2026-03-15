import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { requireAdmin } from '@/lib/admin/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const db = await getDb();
    const showAll = request.nextUrl.searchParams.get('all') === '1';

    const query = showAll
      ? 'SELECT bowlerID, bowlerName, isActive, establishedAvg FROM bowlers ORDER BY bowlerName'
      : 'SELECT bowlerID, bowlerName FROM bowlers WHERE isActive = 1 ORDER BY bowlerName';

    const result = await db.request().query(query);

    return NextResponse.json({ bowlers: result.recordset });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { bowlerName, gender, establishedAvg } = body as {
      bowlerName: string;
      gender?: string;
      establishedAvg?: number;
    };

    if (!bowlerName || !bowlerName.trim()) {
      return NextResponse.json(
        { error: 'Bowler name is required' },
        { status: 400 },
      );
    }

    const name = bowlerName.trim();
    const slug = name.toLowerCase().replace(/\s+/g, '-');

    const db = await getDb();

    // Check for duplicate slug
    const existing = await db
      .request()
      .input('slug', sql.VarChar(100), slug)
      .query('SELECT bowlerID FROM bowlers WHERE slug = @slug');

    if (existing.recordset.length > 0) {
      return NextResponse.json(
        { error: `A bowler with slug "${slug}" already exists` },
        { status: 409 },
      );
    }

    const result = await db
      .request()
      .input('bowlerName', sql.VarChar(100), name)
      .input('slug', sql.VarChar(100), slug)
      .input('gender', sql.Char(1), gender?.trim() || null)
      .input('isActive', sql.Bit, 1)
      .input('isPublic', sql.Bit, 1)
      .input('establishedAvg', sql.Decimal(5, 1), establishedAvg ?? null)
      .query(
        `INSERT INTO bowlers (bowlerName, slug, gender, isActive, isPublic, establishedAvg)
         OUTPUT INSERTED.bowlerID, INSERTED.bowlerName
         VALUES (@bowlerName, @slug, @gender, @isActive, @isPublic, @establishedAvg)`,
      );

    const created = result.recordset[0];
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { bowlerID, establishedAvg } = body as {
      bowlerID: number;
      establishedAvg: number | null;
    };

    if (!bowlerID) {
      return NextResponse.json(
        { error: 'bowlerID is required' },
        { status: 400 },
      );
    }

    const db = await getDb();
    await db
      .request()
      .input('bowlerID', sql.Int, bowlerID)
      .input('establishedAvg', sql.Decimal(5, 1), establishedAvg)
      .query(
        'UPDATE bowlers SET establishedAvg = @establishedAvg WHERE bowlerID = @bowlerID',
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
