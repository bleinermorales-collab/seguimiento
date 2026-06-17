import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const PASSWORDS_PATH = path.join(process.cwd(), 'data', 'passwords.json');

type PasswordMap = Record<string, string>; // username → bcrypt hash

function readPasswords(): PasswordMap {
  try {
    if (fs.existsSync(PASSWORDS_PATH)) {
      return JSON.parse(fs.readFileSync(PASSWORDS_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

function writePasswords(data: PasswordMap): void {
  fs.writeFileSync(PASSWORDS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export async function verifyPassword(username: string, password: string): Promise<boolean> {
  const passwords = readPasswords();
  const hash = passwords[username];

  if (hash) {
    return bcrypt.compare(password, hash);
  }

  // Fallback: default password
  return password === 'americana2025';
}

export async function setPassword(username: string, newPassword: string): Promise<void> {
  const passwords = readPasswords();
  passwords[username] = await bcrypt.hash(newPassword, 10);
  writePasswords(passwords);
}

export function hasCustomPassword(username: string): boolean {
  const passwords = readPasswords();
  return !!passwords[username];
}
