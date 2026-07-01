import { NextRequest, NextResponse } from 'next/server';
import { readAllCourses } from '@/lib/sheets';
import { mergeLinksDI } from '@/lib/course-links';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Normalize for name comparison: strip accents, lowercase, collapse whitespace.
function normName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Match names even when the sheet has a truncated or abbreviated form.
// Handles three common cases:
//   • Exact prefix:    "Nayerlis Salas" == "Nayerlis Salas Medina"
//   • Skipped words:   "Caroll Avendaño" == "Caroll Tatiana Avendaño Peña"
//                      "Andres Velandia" == "Andrés Felipe Velandia Espitia"
// Strategy: all words in the shorter name must appear as a subsequence (in order)
// inside the longer name. Requires ≥ 2 words to avoid single-word false positives.
function nameMatches(stored: string, session: string): boolean {
  if (!stored || !session) return false;
  if (stored === session) return true;
  const shorter = stored.length <= session.length ? stored : session;
  const longer  = stored.length <= session.length ? session : stored;
  const shortWords = shorter.split(' ').filter(Boolean);
  if (shortWords.length < 2) return false;
  const longWords = longer.split(' ').filter(Boolean);
  let li = 0;
  for (const sw of shortWords) {
    while (li < longWords.length && longWords[li] !== sw) li++;
    if (li >= longWords.length) return false;
    li++;
  }
  return true;
}

export async function GET(req: NextRequest) {
  void req;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  const name = session.user.name ?? '';
  const myName = normName(name);

  try {
    const all = mergeLinksDI(await readAllCourses());

    if (role === 'Gestor') {
      const mine = all.filter(r => {
        const asignado    = normName(String(r['Gestor asignado']    ?? r['Gestor Asignado']    ?? ''));
        const responsable = normName(String(r['Gestor responsable'] ?? r['Gestor responsable '] ?? r['Gestor Responsable'] ?? ''));
        return nameMatches(asignado, myName) || nameMatches(responsable, myName);
      });
      return NextResponse.json({ data: mine });
    }

    if (role === 'Diseñador Instruccional') {
      const mine = all.filter(r => {
        const asignado    = normName(String(r['DI asignado']    ?? r['DI Asignado']    ?? ''));
        const responsable = normName(String(r['DI responsable'] ?? r['DI Responsable'] ?? r['DI responsable '] ?? ''));
        return nameMatches(asignado, myName) || nameMatches(responsable, myName);
      });
      return NextResponse.json({ data: mine });
    }

    return NextResponse.json({ data: [] });
  } catch (err) {
    console.error('[api/my-courses]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
