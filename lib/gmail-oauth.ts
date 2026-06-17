import { google } from 'googleapis';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const TOKENS_PATH = path.join(process.cwd(), 'data', 'gmail-tokens.json');

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/gmail-callback`
  );
}

export function getAuthUrl(email: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.send'],
    prompt: 'consent',
    login_hint: email,
    state: email,
  });
}

export function loadTokens(): Record<string, Record<string, unknown>> {
  if (!existsSync(TOKENS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
  } catch { return {}; }
}

export function saveToken(email: string, token: Record<string, unknown>) {
  const tokens = loadTokens();
  tokens[email] = token;
  writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

export function hasToken(email: string): boolean {
  return Boolean(loadTokens()[email]);
}

export function revokeToken(email: string) {
  const tokens = loadTokens();
  delete tokens[email];
  writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

export async function sendViaOAuth(
  fromEmail: string,
  to: string[],
  subject: string,
  html: string,
  fromName?: string
): Promise<{ success: boolean; error?: string }> {
  const token = loadTokens()[fromEmail];
  if (!token) return { success: false, error: `Sin token OAuth para ${fromEmail}` };

  const client = getOAuth2Client();
  client.setCredentials(token);

  // Auto-guardar token renovado
  client.on('tokens', (newTokens) => {
    saveToken(fromEmail, { ...token, ...newTokens });
  });

  const gmail = google.gmail({ version: 'v1', auth: client });

  const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  const raw = [
    `From: ${fromHeader}`,
    `To: ${to.join(', ')}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
  ].join('\r\n');

  try {
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: Buffer.from(raw).toString('base64url') },
    });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error';
    // Token inválido → eliminarlo para que el usuario vuelva a conectar
    if (msg.includes('invalid_grant') || msg.includes('Token has been expired')) {
      revokeToken(fromEmail);
    }
    return { success: false, error: msg };
  }
}
