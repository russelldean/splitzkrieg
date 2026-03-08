import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { name, email, message, pageUrl } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: 'Message too long (max 2000 chars)' }, { status: 400 });
    }

    const trimmed = {
      name: name?.trim().slice(0, 100) || null,
      email: email?.trim().slice(0, 255) || null,
      message: message.trim(),
      pageUrl: pageUrl?.slice(0, 500) || null,
    };

    // Insert into database
    const db = await getDb();
    await db.request()
      .input('name', trimmed.name)
      .input('email', trimmed.email)
      .input('message', trimmed.message)
      .input('pageUrl', trimmed.pageUrl)
      .query(`
        INSERT INTO feedback (name, email, message, pageUrl)
        VALUES (@name, @email, @message, @pageUrl)
      `);

    // Send email notification
    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: 'Splitzkrieg <onboarding@resend.dev>',
          to: 'charlesrusselldean@gmail.com',
          subject: `Splitzkrieg Feedback${trimmed.name ? ` from ${trimmed.name}` : ''}`,
          text: [
            trimmed.name && `From: ${trimmed.name}`,
            trimmed.email && `Email: ${trimmed.email}`,
            trimmed.pageUrl && `Page: ${trimmed.pageUrl}`,
            '',
            trimmed.message,
          ].filter(Boolean).join('\n'),
        });
      } catch (emailErr) {
        // Log but don't fail the request — feedback is already saved
        console.error('Failed to send feedback email:', emailErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Feedback submission error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
