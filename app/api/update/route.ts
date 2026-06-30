import { NextRequest, NextResponse } from 'next/server';
import { updateCourse, getCourseInfo } from '@/lib/sheets';
import { ESTADOS_GESTOR, ESTADOS_DI } from '@/config/estados';
import { sendEmail, buildEmailHtml } from '@/lib/email';
import { NOTIF_BASE } from '@/config/notificaciones';
import { getGestores, getDIs } from '@/lib/user-management';
import { getCourseLinks, setLinkGestor } from '@/lib/course-links';

function todayString(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function lookupEmail(list: { nombre: string; email: string }[], nombre: string): string | undefined {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const n = norm(nombre);
  return list.find(p => norm(p.nombre) === n)?.email;
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
    const { rol, responsable, nivel, programa, curso, estadoId, observaciones, link, nombreElectiva } = body as {
      rol: string; responsable: string; nivel: string;
      programa: string; curso: string; estadoId: string; observaciones?: string; link?: string; nombreElectiva?: string;
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
    const diNombre = String(courseInfo?.['DI responsable'] ?? courseInfo?.['DI asignado'] ?? courseInfo?.['DI Responsable'] ?? '').trim();

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

    const ok = await updateCourse(nivel, curso, updates, programa, nombreElectiva || undefined);

    if (estadoId === 'enviado' && link?.trim()) {
      setLinkGestor(nivel, programa, curso, link.trim());
    }

    // Notificaciones — se envían siempre que la acción sea válida,
    // independiente de si el sheet se actualizó (para que coordinadores siempre sean notificados)
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
          linkGC: estadoId === 'enviado'
            ? (link?.trim() || courseLinks.linkGC || undefined)
            : estadoId === 'devuelto' ? undefined : (courseLinks.linkGC || undefined),
          linkDI: estadoId !== 'enviado' ? (courseLinks.linkDI || undefined) : undefined,
          observaciones: observaciones?.trim() || undefined,
        }),
        fromEmail,
        fromName: responsable,
      }).catch(err => console.error('[api/update] email error:', err));
    }

    if (!ok) {
      console.error(`[api/update] updateCourse falló para "${curso}" (nivel: ${nivel}, programa: ${programa}) — el email fue enviado igualmente`);
      return NextResponse.json({ error: `No se encontró el curso "${curso}" en la hoja ${nivel}` }, { status: 404 });
    }

    return NextResponse.json({ success: true, updatedFields: Object.keys(updates) });
  } catch (err) {
    console.error('[api/update]', err);
    return NextResponse.json({ error: 'Error interno al actualizar' }, { status: 500 });
  }
}
