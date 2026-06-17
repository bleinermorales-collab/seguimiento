import { NextRequest, NextResponse } from 'next/server';
import { readAllCourses } from '@/lib/sheets';
import { mergeLinksDI } from '@/lib/course-links';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  void req;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  const name = session.user.name;

  try {
    const all = mergeLinksDI(await readAllCourses());

    if (role === 'Gestor') {
      const mine = all.filter(r => {
        const asignado    = String(r['Gestor asignado']    ?? r['Gestor Asignado']    ?? '').trim();
        const responsable = String(r['Gestor responsable '] ?? r['Gestor responsable'] ?? '').trim();
        return asignado === name || responsable === name;
      });
      return NextResponse.json({ data: mine });
    }

    if (role === 'Diseñador Instruccional') {
      const mine = all.filter(r => {
        const asignado    = String(r['DI asignado']    ?? r['DI Asignado']    ?? '').trim();
        const responsable = String(r['DI responsable'] ?? r['DI Responsable'] ?? r['DI responsable '] ?? '').trim();
        return asignado === name || responsable === name;
      });
      return NextResponse.json({ data: mine });
    }

    return NextResponse.json({ data: [] });
  } catch (err) {
    console.error('[api/my-courses]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
