import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { makeId } from '@/lib/id';
import { notifyTelegram, formatOrderMessage, statusKeyboard } from '@/lib/telegram';

const Schema = z.object({
  city: z.string().min(1).max(80),
  items: z.array(z.object({
    id: z.string().min(1).max(40),
    name: z.string().min(1).max(300),
    qty: z.number().int().min(1).max(100000),
    price: z.number().int().min(0).max(100000000),
  })).min(1).max(200),
});

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'validation', detail: parsed.error.flatten() }, { status: 400 });

  const total = parsed.data.items.reduce((s, i) => s + i.qty * i.price, 0);
  const id = makeId('MN');

  try {
    const [order] = await db.insert(schema.orders).values({
      id,
      userId: session.userId,
      status: 'new',
      city: parsed.data.city,
      total,
      items: parsed.data.items,
    }).returning();

    // Получаем актуальные user details для уведомления
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, session.userId)).limit(1);

    // Отправка в Telegram — не блокирует ответ если сеть упала
    notifyTelegram(
      formatOrderMessage({ id: order.id, city: order.city, total: order.total, items: order.items, user }),
      { inlineKeyboard: statusKeyboard(order.id, 'order') }
    ).catch(e => console.error('[orders] tg notify failed:', e));

    return NextResponse.json({ ok: true, order: { id: order.id, total: order.total, status: order.status, createdAt: order.createdAt } });
  } catch (e) {
    console.error('[orders] db error:', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rows = await db.select().from(schema.orders)
    .where(eq(schema.orders.userId, session.userId))
    .orderBy(desc(schema.orders.createdAt))
    .limit(100);
  return NextResponse.json({ orders: rows });
}
