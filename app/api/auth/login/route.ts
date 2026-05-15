import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { signSession, setSessionCookie, clearSessionCookie } from '@/lib/auth';

const Schema = z.object({
  phone: z.string().min(5).max(40),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  const phone = parsed.data.phone.trim();
  const found = await db.select().from(schema.users).where(eq(schema.users.phone, phone)).limit(1);
  const user = found[0];
  if (!user) return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });

  const token = await signSession({ userId: user.id, name: user.name, type: user.type });
  await setSessionCookie(token);

  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, type: user.type, phone: user.phone, email: user.email, orgName: user.orgName, inn: user.inn, kpp: user.kpp, ogrn: user.ogrn },
  });
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
