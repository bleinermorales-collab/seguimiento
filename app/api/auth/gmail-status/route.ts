import { NextResponse } from 'next/server';
import { loadTokens, revokeToken } from '@/lib/gmail-oauth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!['Super Admin', 'Coordinador'].includes(role || '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const tokens = loadTokens();
  const connected = Object.keys(tokens);
  return NextResponse.json({ connected });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!['Super Admin', 'Coordinador'].includes(role || '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const { email } = await req.json() as { email: string };
  if (!email) return NextResponse.json({ error: 'Falta email' }, { status: 400 });
  revokeToken(email);
  return NextResponse.json({ success: true });
}
