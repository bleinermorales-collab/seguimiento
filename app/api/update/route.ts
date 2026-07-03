import { NextRequest, NextResponse } from 'next/server';
import { updateCourse, getCourseInfo } from '@/lib/sheets';
import { ESTADOS_GESTOR, ESTADOS_DI } from '@/config/estados';
import { sendEmail, buildEmailHtml } from '@/lib/email';
import { NOTIF_BASE } from '@/config/notificaciones';
import { getGestores, getDIs } from '@/lib/user-management';
import { getCourseLinks, setLinkGestor, setRevisionStarted } from '@/lib/course-links';

function todayString(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function normName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// All words of `stored` must appear in order (as a subsequence) in `full`.
// Handles truncated names in the sheet: "Aimar Mendoza" matches "Aimar Mendoza Torres",
// "Caroll Avendaño" matches "Caroll Tatiana Avendaño Peña", etc.
function nameMatches(stored: string, full: string): boolean {
  if (!stored || !full) return false;
  if (stored === full) return true;
  const shorter = stored.length <= full.length ? stored : full;
  const longer  = stored.length <= full.length ? full   : stored;
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

function lookupEmail(list: { nombre: string; email: string }[], nombre: string): string | undefined {
  const n = normName(nombre);
  // Exact match first
  const exact = list.find(p => normName(p.nombre) === n);
  if (exact) return exact.email;
  // Subsequence match for truncated names (e.g. sheet has "Aimar Mendoza", config has "Aimar Mendoza Torres")
  return list.find(p => nameMatches(n, normName(p.nombre)))?.email;
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
    const courseLinks = getCourseLinks(nivel, programa, curso, nombreElectiva || undefined);
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
        // Keep 'Estado curso': 'Aprobado' (from the base updates) — do NOT delete it.
        // This ensures the Excel shows a consistent approved state after correction.
        updates['Estado de la revalidación DI'] = 'Aprobado';
        updates['Fecha revalidación de DI'] = today;
      }
    }

    const ok = await updateCourse(nivel, curso, updates, programa, nombreElectiva || undefined);

    // Link sidecar written only after confirmed update to avoid orphan entries
    if (ok && estadoId === 'enviado' && link?.trim()) {
      setLinkGestor(nivel, programa, curso, link.trim(), nombreElectiva || undefined);
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

      const neClean = nombreElectiva?.trim() || undefined;
      sendEmail({
        to: filteredRecipients,
        subject: neClean ? `${opcion.label} — ${curso} (${neClean})` : `${opcion.label} — ${curso}`,
        html: buildEmailHtml({
          accion: opcion.label,
          gestor: gestorNombre || responsable,
          di: diParaEmail || undefined,
          nivel,
          programa,
          curso,
          nombreElectiva: neClean,
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

    // Persist the initiation date in the JSON sidecar so it survives page reloads
    // even when the GS column "Fecha inicio revisión DI" is missing or the GS write
    // failed silently. GS is the primary read source, so a failed write means every
    // subsequent read returns null for this field. The sidecar is injected by
    // mergeLinksDI (called in my-courses and admin routes) as a fallback.
    if (estadoId === 'inicio_revision') {
      setRevisionStarted(nivel, programa, curso, todayString(), nombreElectiva || undefined);
    }

    return NextResponse.json({ success: true, updatedFields: Object.keys(updates) });
  } catch (err) {
    console.error('[api/update]', err);
    return NextResponse.json({ error: 'Error interno al actualizar' }, { status: 500 });
  }
}
