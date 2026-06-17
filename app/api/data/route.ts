import { NextRequest, NextResponse } from 'next/server';
import { getProgramas, getCursos } from '@/lib/sheets';
import { getGestores, getDIs } from '@/lib/user-management';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const nivel = searchParams.get('nivel') || '';
  const programa = searchParams.get('programa') || '';

  try {
    if (type === 'gestores') {
      return NextResponse.json({ data: getGestores().map(g => g.nombre) });
    }
    if (type === 'dis') {
      return NextResponse.json({ data: getDIs().map(d => d.nombre) });
    }
    if (type === 'programas' && nivel) {
      const data = await getProgramas(nivel);
      return NextResponse.json({ data });
    }
    if (type === 'cursos' && nivel && programa) {
      const data = await getCursos(nivel, programa);
      return NextResponse.json({ data });
    }
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  } catch (err) {
    console.error('[api/data]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
