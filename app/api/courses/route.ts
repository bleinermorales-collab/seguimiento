import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { appendCourse } from '@/lib/sheets';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (user?.role !== 'Coordinador') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const body = await req.json() as Record<string, string>;
    const { nivel, programa, asignatura } = body;

    if (!nivel || !programa || !asignatura) {
      return NextResponse.json({ error: 'Nivel, programa y asignatura son obligatorios' }, { status: 400 });
    }

    // Build the fields map with exact Excel/Sheets column names
    const fields: Record<string, string | number> = {};
    const colMap: Record<string, string> = {
      modalidad:       'Modalidad',
      programa:        'Programa',
      asignatura:      'Asignatura',
      nombreElectiva:  'Nombre electiva',
      tipoAsignatura:  'Tipo de asignatura',
      prioridad:       'Prioridad',
      programa2:       'Programa 2',
      modalidad2:      'Modalidad 2',
      estadoSemestre:  'Estado semestre',
      proyecto:        'Proyecto',
      codigoPensum:    'Código de Pensum',
      codigoPrograma:  'Código de programa',
      codigoAsignatura:'Código de asignatura',
      nivel:           'Nivel',
      facultad:        'Facultad',
      mallaCurricular: 'Malla curricular',
      troncoComun:     '¿Tronco común?',
      fechaProduccion: 'Fecha programada de producción',
    };

    for (const [formKey, colName] of Object.entries(colMap)) {
      const val = body[formKey];
      if (val && val.trim()) fields[colName] = val.trim();
    }

    // Semestre as number when possible
    if (body.semestre && body.semestre.trim()) {
      const n = Number(body.semestre);
      fields['Semestre'] = isNaN(n) ? body.semestre.trim() : n;
    }

    // Default Estado
    fields['Estado'] = 'No empezado';

    const ok = await appendCourse(nivel, fields);
    if (!ok) return NextResponse.json({ error: 'Hoja de nivel no encontrada' }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/courses]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
