import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const PASSWORDS_PATH = path.join(process.cwd(), 'data', 'passwords.json');

type PasswordMap = Record<string, string>; // username → bcrypt hash

// Seed hashes — used to initialize data/passwords.json on first run.
// Generated with bcrypt rounds=10. Change passwords via the admin panel;
// the file on the server is never overwritten by git deploys.
const SEED_PASSWORDS: PasswordMap = {
  'admin':        '$2b$10$X6/J4obvVwwxOpQYqA8YoO32xhI83LjQ3ive8SRNL/sanhrJhCx1q', // americana2025
  'lizneyr':      '$2b$10$L7dibWgOwsYrBLdVPmWoceeLBR.kW2YGL70lIwJQ0yOFnLibPDubu', // DIE123456
  'maescobar':    '$2b$10$KusHo3WYTMZ188Gix8zaq.GWgrA9zxQgTWcB2isQXyKw1EYL/maQy', // CGC123456
  'karamirez':    '$2b$10$FL4RT3MSdco341CcNvh.V.eghofhnqLyNYXyFxDVY8kqagFPHuPl6', // CDI123456
  'spalencia':    '$2b$10$AWTbtqIS8ZFgQc8uOlxS3u1qV4cqByivPye0w5ca0O3qTtFpgWo0e', // Cua123456
  'hojeda':       '$2b$10$MPZwelOMu58mLu1rTHYiQu8en14KY0.qzD5MisJv/q4EfmAQirdKW', // Cua123456
  'kmunoz':       '$2b$10$F/FsUWmm3Qyk4FDEviSAk.mgHSbtOQgjlhiw6Gui9bA9w53N.dBEW', // Cua123456
  'anunez':       '$2b$10$OTX1u0lLOO7mpjMwJCUbDe/MyEBiSuBObarCCqZI.1A./J2iipI76', // Cua123456
  'amendoza':     '$2b$10$qggStGXpz3jZlE6NR31py.2ej/rML24KBENCFyiuBWfT2HpP64.8C', // Cua123456
  'nsalas':       '$2b$10$PurlgMgY8bq4EK8A52YIrecU1gc6yMBMQf2H4lXRQIN8BvtdER7eG', // Cua123456
  'cavendano':    '$2b$10$BbxVE7bJnfG6QDReTujAQ.FZ8dJy8F2GHGbrXqUL/TAqAmC0E3EpW', // Cua123456
  'mjortega':     '$2b$10$bpamrnLfK6vw9ZjVXtg27e0Mt72yoBNnQ7oC5LDfRX2hxEuWR/Brm', // Cua123456
  'yromero':      '$2b$10$yZcn8T8GJHcOLyufU4kdAuQRMi2pfCxjGpl6nabMp5O73GgjcTF7.', // Cua123456
  'aarrieta':     '$2b$10$3tDOFAXfaVRlMF5T7KjKcOOv3YlZV5l0B2IYRhp4Ip/Fz4WiQ3EYW', // Cua123456
  'jadie':        '$2b$10$THadXIF09AmXDtnU7rB4qusGPAi8rvnjSZuBUvViyx6wnTQgfRPC2',  // Cua123456
  'mmantilla':    '$2b$10$xoO3EFkK518IdoWKNhIdjeffhVuHliGPmtApM6mo9GSoRt7ixwLIy', // Cua123456
  'cnavarro':     '$2b$10$OjLc9Swm3Camooqv4KtRqOHkMhEfnfh0XuoDNfCXdNCLOE9W3hjsm', // Cua123456
  'molaciregui':  '$2b$10$fPV6T.7H4a/Bj5vmpnYTWe982Y/P/HP6NnYzWG156JI.zhcBcygVy', // Cua123456
  'mpimienta':    '$2b$10$H3DKpisBqjQCfXLIm1RsI.3z01CkwJ9Lz0ND7Gs28SVdwGvjiivOm', // Cua123456
  'adelariveros': '$2b$10$gSyMylC7nf5vR1Csx8trAeaw7m9TPyEDNl9kkJuVybzFrauGamaGa', // Ame123456
  'avelandia':    '$2b$10$RaINDk3TSg/cdy6iAtEbIugjrP8PvvFE.w8jztjqvG9cRy.3j2LYm', // Ame123456
  'julianvargas': '$2b$10$BHk.4JZXahewHwJHSM0gleVKzLdH2BoyiZDQLnbDpASGon1KNQeyO', // Ame123456
  'luztinoco':    '$2b$10$p5/rjG4aez0buRQW5BPbOuAVn5AM73L/EN.u.lWUM3s4aVRIpOgQK', // Ame123456
  'yazminmoreno': '$2b$10$xm18vW64YEcsdaOHWiSFsebSKC/FlVfQwNhlqX9oGfhJ74Zh3uR72', // Ame123456
  'luiscortes':   '$2b$10$CH2gL/kTwkGQV4C0siYdPeEH6Aovnahd1Yups5As7s/UMXM7VTRxK', // Ame123456
  'diegopatino':  '$2b$10$Vtlz7J73bKMaSdbK.KYa/OfGRKi9TcWStSja8M2OXSMUJ7Fgqa.TK', // Ame123456
  'juanrubio':    '$2b$10$YtDxqkLscN6cb3SgxoG0G.X3fNXtoQJJasS8c2LAydTRPqPurFRkm', // Ame123456
  'kerenpadilla': '$2b$10$GXr/NFGXdET8le.sr9mDLubeET/gzDwzFxUO6wNVKp4V9qq1np33a', // Ame123456
};

function readPasswords(): PasswordMap {
  try {
    if (fs.existsSync(PASSWORDS_PATH)) {
      return JSON.parse(fs.readFileSync(PASSWORDS_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
  // Seed on first run
  try { fs.writeFileSync(PASSWORDS_PATH, JSON.stringify(SEED_PASSWORDS, null, 2), 'utf-8'); } catch { /* ignore */ }
  return SEED_PASSWORDS;
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
