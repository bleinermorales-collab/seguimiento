import { NextRequest, NextResponse } from 'next/server';
import { getCourseInfo } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nivel = searchParams.get('nivel') || '';
  const programa = searchParams.get('programa') || '';
  const asignatura = searchParams.get('asignatura') || '';

  if (!nivel || !programa || !asignatura) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
  }

  try {
    const info = await getCourseInfo(nivel, programa, asignatura);
    if (!info) return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });

    return NextResponse.json({
      estado: info['Estado'] ?? null,
      estadoCurso: info['Estado curso'] ?? null,
      gestorResponsable: info['Gestor responsable '] ?? info['Gestor responsable'] ?? null,
      diResponsable: info['DI responsable'] ?? null,
      inicioGestor: info['Inicio Gestor'] ?? null,
      finGestor: info['Fin Gestor'] ?? null,
      fechaInicioRevisionDI: info['Fecha inicio revisión DI'] ?? null,
      fechaFinRevisionDI: info['Fecha fin revisión DI'] ?? null,
      fechaFinCorreccionGestor: info['Fecha fin corrección gestor'] ?? info['Fecha fin corrección docente'] ?? null,
    });
  } catch (err) {
    console.error('[api/course-info]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
