import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db, schema } from '@/lib/db';
import { signSession, setSessionCookie } from '@/lib/auth';

const Schema = z.object({
  type: z.enum(['private', 'business']),
  name: z.string().min(1, 'Укажите имя').max(120),
  phone: z.string().min(10, 'Укажите корректный телефон').max(40),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(6, 'Пароль минимум 6 символов').max(200),
  // Только для business
  orgName: z.string().max(200).optional(),
  inn: z.string().max(20).optional(),
  kpp: z.string().max(20).optional(),
  ogrn: z.string().max(20).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation', detail: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.type === 'business') {
    if (!data.orgName?.trim()) return NextResponse.json({ error: 'org_name_required' }, { status: 400 });
    if (!data.inn || data.inn.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ error: 'inn_invalid' }, { status: 400 });
    }
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  try {
    const [user] = await db.insert(schema.users).values({
      type: data.type,
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email?.trim() || null,
      passwordHash,
      orgName: data.orgName?.trim() || null,
      inn: data.inn?.trim() || null,
      kpp: data.kpp?.trim() || null,
      ogrn: data.ogrn?.trim() || null,
    }).returning();

    const token = await signSession({ userId: user.id, name: user.name, type: user.type });
    await setSessionCookie(token);

    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, type: user.type, phone: user.phone, email: user.email, orgName: user.orgName, inn: user.inn, kpp: user.kpp, ogrn: user.ogrn },
    });
  } catch (e) {
    console.error('[register] db error:', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
