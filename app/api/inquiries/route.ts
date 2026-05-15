import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { makeId } from '@/lib/id';
import { notifyTelegram, formatInquiryMessage, statusKeyboard } from '@/lib/telegram';

const Schema = z.object({
  description: z.string().min(10).max(4000),
  quantity: z.number().int().min(1).max(1000000),
  budgetRub: z.number().int().min(0).max(100000000).optional().nullable(),
  // На клиенте фото уже загружены как base64 для отправки в Telegram отдельно — здесь храним лишь количество
  photos: z.array(z.string()).max(3).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'validation', detail: parsed.error.flatten() }, { status: 400 });

  const id = makeId('CR');
  const photos = parsed.data.photos || [];
  const photosCount = photos.length;

  try {
    const [inquiry] = await db.insert(schema.inquiries).values({
      id,
      userId: session.userId,
      status: 'new',
      description: parsed.data.description,
      quantity: parsed.data.quantity,
      budgetRub: parsed.data.budgetRub ?? null,
      photosCount,
    }).returning();

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, session.userId)).limit(1);

    // Текст заявки в Telegram + фото отдельным sendPhoto, если есть
    notifyTelegram(
      formatInquiryMessage({
        id: inquiry.id,
        description: inquiry.description,
        quantity: inquiry.quantity,
        budgetRub: inquiry.budgetRub,
        photosCount: inquiry.photosCount,
        user,
      }),
      { inlineKeyboard: statusKeyboard(inquiry.id, 'inquiry') }
    ).catch(e => console.error('[inquiries] tg text failed:', e));

    for (const dataUrl of photos) {
      sendTelegramPhoto(dataUrl, `Референс к заявке ${id}`).catch(e => console.error('[inquiries] tg photo failed:', e));
    }

    return NextResponse.json({ ok: true, inquiry: { id: inquiry.id, status: inquiry.status, createdAt: inquiry.createdAt } });
  } catch (e) {
    console.error('[inquiries] db error:', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const rows = await db.select().from(schema.inquiries)
    .where(eq(schema.inquiries.userId, session.userId))
    .orderBy(desc(schema.inquiries.createdAt))
    .limit(100);
  return NextResponse.json({ inquiries: rows });
}

async function sendTelegramPhoto(dataUrl: string, caption: string) {
  const TG = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT = process.env.TELEGRAM_CHAT_ID;
  if (!TG || !CHAT) return;

  // Извлекаем base64 из data URL
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return;
  const mime = match[1];
  const buf = Buffer.from(match[2], 'base64');

  const fd = new FormData();
  fd.append('chat_id', CHAT);
  fd.append('caption', caption);
  fd.append('photo', new Blob([buf], { type: mime }), `photo.${mime.split('/')[1] || 'jpg'}`);

  await fetch(`https://api.telegram.org/bot${TG}/sendPhoto`, { method: 'POST', body: fd });
}
