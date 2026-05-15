import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ user: null });

  const [user] = await db.select().from(schema.users)
    .where(eq(schema.users.id, session.userId)).limit(1);
  if (!user) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: {
      id: user.id,
      type: user.type,
      name: user.name,
      phone: user.phone,
      email: user.email,
      orgName: user.orgName,
      inn: user.inn,
      kpp: user.kpp,
      ogrn: user.ogrn,
    },
  });
}
