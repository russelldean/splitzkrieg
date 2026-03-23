import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readdir, unlink } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('screenshot') as File;
  if (!file) {
    return NextResponse.json({ error: 'No file' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = file.name || `game-debug-${Date.now()}.png`;
  const filepath = path.join(process.cwd(), 'debug-screenshots', filename);

  await writeFile(filepath, buffer);
  return NextResponse.json({ path: filepath });
}

export async function DELETE(request: NextRequest) {
  const clear = request.nextUrl.searchParams.get('clear');
  const dir = path.join(process.cwd(), 'debug-screenshots');

  if (clear === 'rolls') {
    // Delete all roll-*.png files
    const files = await readdir(dir);
    const rollFiles = files.filter(f => f.startsWith('roll-') && f.endsWith('.png'));
    await Promise.all(rollFiles.map(f => unlink(path.join(dir, f))));
    return NextResponse.json({ deleted: rollFiles.length });
  }

  return NextResponse.json({ error: 'Unknown clear target' }, { status: 400 });
}
