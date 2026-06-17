import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAuthUrl } from '@/lib/gmail-oauth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!['Super Admin', 'Coordinador'].includes(role || '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const email = req.nextUrl.searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'Falta el email' }, { status: 400 });

  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return NextResponse.json({ error: 'OAuth no configurado en .env.local' }, { status: 500 });
  }

  const url = getAuthUrl(email);
  return NextResponse.redirect(url);
}
