import { NextRequest, NextResponse } from 'next/server';
import { updateCourse } from '@/lib/sheets';
import { setLinkGC, getCourseLinks } from '@/lib/course-links';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendEmail, buildEmailHtml } from '@/lib/email';
import { NOTIF_BASE } from '@/config/notificaciones';
import { getGestores, getAllUsers } from '@/lib/user-management';

function normName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
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
  const exact = list.find(p => normName(p.nombre) === n);
  if (exact) return exact.email;
  return list.find(p => nameMatches(n, normName(p.nombre)))?.email;
}

function todayString(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string; name?: string; email?: string } | undefined;
  if (user?.role !== 'Coordinador') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const body = await req.json();
    const { nivel, programa, curso, gestor, link, observaciones, nombreElectiva } = body as {
      nivel: string; programa: string; curso: string; gestor: string; link?: string; observaciones?: string; nombreElectiva?: string;
    };
    if (!nivel || !curso || !gestor) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });

    const today = new Date();
    const updates: Record<string, unknown> = {
      'Gestor asignado': gestor,
      'Fecha de asignación': today,
    };

    const ok = await updateCourse(nivel, curso, updates, programa, nombreElectiva || undefined);
    if (!ok) return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });

    if (link && link.trim()) {
      setLinkGC(nivel, programa, curso, link.trim(), nombreElectiva || undefined);
    }

    const courseLinks = getCourseLinks(nivel, programa, curso, nombreElectiva || undefined);
    const linkGC = (link && link.trim()) ? link.trim() : courseLinks.linkGC;
    const linkDI = courseLinks.linkDI;

    // FROM: el correo del coordinador que hizo la asignación
    const coordUser = getAllUsers().find(u => u.nombre === user?.name);
    const fromEmail = coordUser?.email || user?.email;

    // TO: gestor asignado + CGC + CDI + IE (sin incluir al remitente)
    const gestorEmail = lookupEmail(getGestores(), gestor);
    const recipients = [...NOTIF_BASE.asignacion_gestor, ...(gestorEmail ? [gestorEmail] : [])]
      .filter(email => email !== fromEmail);

    if (recipients.length > 0) {
      sendEmail({
        to: recipients,
        subject: `Asignación de gestor — ${curso}`,
        html: buildEmailHtml({
          accion: 'Asignación de Gestor',
          gestor,
          nivel,
          programa,
          curso,
          fecha: todayString(),
          linkGC: linkGC || undefined,
          linkDI: linkDI || undefined,
          observaciones: observaciones?.trim() || undefined,
        }),
        fromEmail: fromEmail || undefined,
        fromName: user?.name || 'Coordinador',
      }).catch(err => console.error('[api/assign] email error:', err));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/assign]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
