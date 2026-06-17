import { NextRequest, NextResponse } from 'next/server';
import { getOAuth2Client, saveToken } from '@/lib/gmail-oauth';

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get('code');
  const email = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/connect-gmail?error=${encodeURIComponent(error)}`);
  }
  if (!code || !email) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/connect-gmail?error=missing_params`);
  }

  try {
    const client = getOAuth2Client();
    const { tokens } = await client.getToken(code);
    saveToken(email, tokens as Record<string, unknown>);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/connect-gmail?success=${encodeURIComponent(email)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error';
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/connect-gmail?error=${encodeURIComponent(msg)}`);
  }
}
