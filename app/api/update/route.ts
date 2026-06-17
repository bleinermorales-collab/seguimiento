import { NextRequest, NextResponse } from 'next/server';
import { updateCourse, getCourseInfo } from '@/lib/sheets';
import { ESTADOS_GESTOR, ESTADOS_DI } from '@/config/estados';
import { sendEmail, buildEmailHtml } from '@/lib/email';
import { NOTIF_BASE } from '@/config/notificaciones';
import { getGestores, getDIs } from '@/lib/user-management';
import { getCourseLinks } from '@/lib/course-links';

function todayString(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function lookupEmail(list: { nombre: string; email: string }[], nombre: string): string | undefined {
  return list.find(p => p.nombre === nombre)?.email;
}

// Busca el email de un responsable en gestores o DIs
function resolveFromEmail(responsable: string, rol: string): string | undefined {
  if (rol === 'Gestor') return lookupEmail(getGestores(), responsable);
  if (rol === 'Diseñador Instruccional') return lookupEmail(getDIs(), responsable);
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rol, responsable, nivel, programa, curso, estadoId, observaciones } = body as {
      rol: string; responsable: string; nivel: string;
      programa: string; curso: string; estadoId: string; observaciones?: string;
    };

    if (!nivel || !curso || !estadoId) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const opciones = rol === 'Gestor' ? ESTADOS_GESTOR : ESTADOS_DI;
    const opcion = opciones.find(o => o.id === estadoId);
    if (!opcion) return NextResponse.json({ error: 'Estado no válido' }, { status: 400 });

    // Info del curso antes de actualizar (para saber gestor/DI asignado)
    const courseInfo = await getCourseInfo(nivel, programa, curso);
    const courseLinks = getCourseLinks(nivel, programa, curso);
    const gestorNombre = String(courseInfo?.['Gestor responsable'] ?? courseInfo?.['Gestor responsable '] ?? '').trim();
    const diNombre = String(courseInfo?.['DI responsable'] ?? '').trim();

    const today = new Date();
    const updates: Record<string, unknown> = {};
    for (const [col, val] of Object.entries(opcion.updates)) {
      if (val === '__TODAY__') updates[col] = today;
      else if (val === '__RESPONSABLE__') updates[col] = responsable || null;
      else updates[col] = val;
    }
    if (rol === 'Diseñador Instruccional' && responsable) {
      updates['DI responsable'] = responsable;
    }
    // Cuando el DI aprueba un curso que estaba en revalidación:
    // - NO escribir Estado curso (debe conservar 'Corrección')
    // - Escribir Estado de la revalidación DI = 'Aprobado' y Fecha revalidación de DI
    if (estadoId === 'aprobado') {
      const revalidacion = String(courseInfo?.['Estado de la revalidación DI'] ?? '').trim();
      if (revalidacion === 'En revalidación') {
        delete updates['Estado curso'];
        updates['Estado de la revalidación DI'] = 'Aprobado';
        updates['Fecha revalidación de DI'] = today;
      }
    }

    const ok = await updateCourse(nivel, curso, updates, programa);
    if (!ok) {
      return NextResponse.json({ error: `No se encontró el curso "${curso}" en la hoja ${nivel}` }, { status: 404 });
    }

    // Notificaciones
    const baseRecipients = NOTIF_BASE[estadoId] ?? [];
    if (baseRecipients.length > 0) {
      // FROM: el correo de quien tomó la acción
      const fromEmail = resolveFromEmail(responsable, rol);

      const recipients = [...baseRecipients];
      if (estadoId === 'corregido') {
        const diEmail = lookupEmail(getDIs(), diNombre || responsable);
        if (diEmail) recipients.push(diEmail);
      }
      if (estadoId === 'aprobado' || estadoId === 'devuelto') {
        const gestorEmail = lookupEmail(getGestores(), gestorNombre);
        if (gestorEmail) recipients.push(gestorEmail);
      }

      const filteredRecipients = recipients.filter(email => email !== fromEmail);
      const diParaEmail = rol === 'Diseñador Instruccional' ? (responsable || diNombre) : diNombre;

      sendEmail({
        to: filteredRecipients,
        subject: `${opcion.label} — ${curso}`,
        html: buildEmailHtml({
          accion: opcion.label,
          gestor: gestorNombre || responsable,
          di: diParaEmail || undefined,
          nivel,
          programa,
          curso,
          fecha: todayString(),
          linkGC: estadoId === 'enviado' ? (courseLinks.linkGC || undefined) : undefined,
          linkDI: estadoId !== 'enviado' ? (courseLinks.linkDI || undefined) : undefined,
          observaciones: observaciones?.trim() || undefined,
        }),
        fromEmail,
        fromName: responsable,
      }).catch(err => console.error('[api/update] email error:', err));
    }

    return NextResponse.json({ success: true, updatedFields: Object.keys(updates) });
  } catch (err) {
    console.error('[api/update]', err);
    return NextResponse.json({ error: 'Error interno al actualizar' }, { status: 500 });
  }
}
