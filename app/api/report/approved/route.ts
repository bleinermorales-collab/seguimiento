import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readAllCourses } from '@/lib/sheets';
import { sendEmail } from '@/lib/email';
import * as XLSX from 'xlsx';

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function parseDateField(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : fmtDate(val);
  const str = String(val).trim();
  if (!str) return null;
  // Already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  // Excel serial number
  const n = Number(str);
  if (!isNaN(n) && n > 40000) {
    const d = new Date((n - 25569) * 86400000);
    return isNaN(d.getTime()) ? null : fmtDate(d);
  }
  // ISO date (YYYY-MM-DD or full ISO string)
  const iso = new Date(str);
  return isNaN(iso.getTime()) ? null : fmtDate(iso);
}

function nivelTipo(nivel: string): 'Posgrado' | 'Pregrado' {
  return nivel === 'Pregrado' ? 'Pregrado' : 'Posgrado';
}

type Curso = Record<string, unknown>;
type Grupo = { nivelTipo: string; proyecto: string; cursos: Curso[] };

function groupCourses(courses: Curso[]): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const c of courses) {
    const nt = nivelTipo(String(c._nivel ?? ''));
    const proyecto = String(c.Proyecto ?? '').trim();
    const key = `${nt}::${proyecto}`;
    if (!map.has(key)) map.set(key, { nivelTipo: nt, proyecto, cursos: [] });
    map.get(key)!.cursos.push(c);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.nivelTipo !== b.nivelTipo) return a.nivelTipo === 'Posgrado' ? -1 : 1;
    if (!a.proyecto && b.proyecto) return -1;
    if (a.proyecto && !b.proyecto) return 1;
    return a.proyecto.localeCompare(b.proyecto, 'es');
  });
}

function getGestor(c: Curso): string {
  return String(c['Gestor responsable'] ?? c['Gestor responsable '] ?? c['Gestor asignado'] ?? '').trim();
}

function cursoline(c: Curso): string {
  const prog = String(c._programa ?? '').trim();
  const asig = String(c.Asignatura ?? '').trim();
  const ne = electivaNombre(c);
  const g = getGestor(c);
  const asigStr = ne ? `${asig} (${ne})` : asig;
  return `${prog} - ${asigStr}${g ? ` [${g}]` : ''} (aprobado)`;
}

function buildPlainText(grupos: Grupo[], fecha: Date): string {
  const lines: string[] = [];
  lines.push('Buenas tardes,');
  lines.push('');
  lines.push(`Cursos aprobados — ${fmtDate(fecha)}:`);
  lines.push('');

  let lastNivelTipo = '';
  for (const g of grupos) {
    if (g.nivelTipo !== lastNivelTipo) {
      if (lastNivelTipo) lines.push('');
      lines.push(g.nivelTipo.toUpperCase());
      lastNivelTipo = g.nivelTipo;
    }
    if (g.proyecto) {
      lines.push('');
      lines.push(g.proyecto);
    }
    for (const c of g.cursos) {
      lines.push(cursoline(c));
    }
  }
  return lines.join('\n');
}

function buildReportHtml(grupos: Grupo[], plainText: string, fecha: Date, totalAprobados: number): string {
  const fechaStr = fmtDate(fecha);

  let coursesHtml = '';
  let lastNivelTipo = '';
  for (const g of grupos) {
    if (g.nivelTipo !== lastNivelTipo) {
      if (lastNivelTipo) coursesHtml += '<div style="height:12px"></div>';
      coursesHtml += `<div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1300fd;padding:10px 0 6px;border-bottom:2px solid #1300fd;margin-bottom:8px">${g.nivelTipo}</div>`;
      lastNivelTipo = g.nivelTipo;
    }
    if (g.proyecto) {
      coursesHtml += `<div style="font-size:11px;font-weight:700;color:#374151;margin:12px 0 6px;letter-spacing:.5px">${g.proyecto}</div>`;
    }
    for (const c of g.cursos) {
      const gc = getGestor(c);
      coursesHtml += `<div style="font-size:13px;color:#1a1a2e;padding:5px 0;border-bottom:1px solid #f3f4f6;line-height:1.4">
        <span style="color:#6b7280">${String(c._programa ?? '')}</span>
        <span style="color:#9ca3af;margin:0 6px">—</span>
        <strong>${String(c.Asignatura ?? '')}</strong>
        <span style="display:inline-block;margin-left:8px;background:#d1fae5;color:#065f46;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px">aprobado</span>
        ${gc ? `<span style="display:inline-block;margin-left:6px;color:#6b7280;font-size:11px">· ${gc}</span>` : ''}
      </div>`;
    }
  }

  const preText = plainText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f2f5;padding:32px 16px">
  <tr><td align="center">
  <table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(19,0,253,.10)">

    <tr><td style="height:5px;background:linear-gradient(90deg,#1300fd 0%,#10b981 50%,#f59e0b 100%)"></td></tr>

    <tr><td style="background:#1300fd;padding:28px 36px 24px">
      <div style="font-size:11px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,.6);text-transform:uppercase;margin-bottom:10px">Corporación Universitaria Americana</div>
      <div style="font-size:20px;font-weight:700;color:#fff;line-height:1.3;margin-bottom:4px">Reporte de cursos aprobados</div>
      <div style="font-size:13px;color:rgba(255,255,255,.75)">${fechaStr} · ${grupos.reduce((s, g) => s + g.cursos.length, 0)} cursos hoy · ${totalAprobados} aprobados históricos</div>
    </td></tr>

    <tr><td style="padding:28px 36px 0">
      ${coursesHtml}
    </td></tr>

    <tr><td style="padding:24px 36px">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#6b7280;margin-bottom:8px">Texto para copiar</div>
      <pre style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:8px;padding:16px;font-size:12px;line-height:1.7;color:#374151;white-space:pre-wrap;word-break:break-word;font-family:Consolas,'Courier New',monospace;margin:0">${preText}</pre>
    </td></tr>

    <tr><td style="padding:0 36px 28px">
      <div style="font-size:11px;color:#9ca3af;text-align:center">
        Se adjunta archivo Excel con todos los cursos aprobados históricos (${totalAprobados} en total).
      </div>
    </td></tr>

    <tr><td style="background:#f8f9ff;padding:16px 36px;border-top:1px solid #e8eaf0">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td><div style="font-size:11px;font-weight:700;color:#1300fd">Virtualización</div><div style="font-size:10px;color:#9ca3af;margin-top:2px">Corporación Universitaria Americana</div></td>
        <td style="text-align:right"><div style="font-size:10px;color:#9ca3af">Reporte automático — no responder</div></td>
      </tr></table>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
}

const MEANINGLESS_NE = new Set(['no aplica', 'n/a', 'na', '-', '--', 'no', 'ninguno', 'ninguna']);
function electivaNombre(c: Curso): string {
  const v = String(c['Nombre electiva'] ?? '').trim();
  if (!v) return '';
  const norm = v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return MEANINGLESS_NE.has(norm) ? '' : v;
}

function buildApprovedExcel(courses: Curso[]): Buffer {
  const rows = courses.map(c => ({
    'Nivel': String(c._nivel ?? ''),
    'Programa': String(c._programa ?? ''),
    'Modalidad': String(c._modalidad ?? ''),
    'Asignatura': String(c.Asignatura ?? ''),
    'Nombre electiva': electivaNombre(c),
    'Estado': String(c.Estado ?? ''),
    'Gestor': String(c['Gestor responsable'] ?? c['Gestor responsable '] ?? c['Gestor asignado'] ?? ''),
    'DI responsable': String(c['DI responsable'] ?? ''),
    'Fecha inicio revisión DI': String(c['Fecha inicio revisión DI'] ?? ''),
    'Fecha fin revisión DI': String(c['Fecha fin revisión DI'] ?? ''),
    'Fecha revalidación DI': String(c['Fecha revalidación de DI'] ?? ''),
    'Proyecto': String(c.Proyecto ?? ''),
    'Semestre': String(c.Semestre ?? ''),
    'Prioridad': String(c.Prioridad ?? c.PRIORIDAD ?? ''),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  // Auto column widths
  const colWidths = Object.keys(rows[0] || {}).map(k => ({
    wch: Math.max(k.length, ...rows.map(r => String((r as Record<string, string>)[k] ?? '').length)) + 2,
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Aprobados');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export async function POST(req: NextRequest) {
  // Auth: session OR REPORT_SECRET bearer token (for cron)
  const authHeader = req.headers.get('authorization');
  const secret = process.env.REPORT_SECRET;
  const isToken = !!(secret && authHeader === `Bearer ${secret}`);

  if (!isToken) {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string })?.role;
    if (!role || !['Super Admin', 'Coordinador'].includes(role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
  }

  try {
    const all = await readAllCourses();
    const approved = all.filter(c => {
      const e = String(c.Estado ?? '').trim();
      const revalidacion = String(c['Estado de la revalidación DI'] ?? '').trim();
      return e === 'Aprobado DI' || e === 'Aprobado' || revalidacion === 'Aprobado';
    });

    // Window: yesterday 6 PM → today 6 PM. Since dates have no time, include today + yesterday.
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const todayStr = fmtDate(today);
    const yesterdayStr = fmtDate(yesterday);

    const windowApproved = approved.filter(c => {
      const revalidacion = String(c['Estado de la revalidación DI'] ?? '').trim();
      // Segunda aprobación (post-corrección) usa Fecha revalidación de DI
      const fecha = revalidacion === 'Aprobado'
        ? parseDateField(c['Fecha revalidación de DI'])
        : parseDateField(c['Fecha fin revisión DI']);
      return fecha === todayStr || fecha === yesterdayStr;
    });

    if (windowApproved.length === 0) {
      return NextResponse.json({ ok: true, count: 0, message: 'Sin aprobaciones en el período actual' });
    }

    const grupos = groupCourses(windowApproved);
    const plainText = buildPlainText(grupos, today);
    const html = buildReportHtml(grupos, plainText, today, approved.length);
    const xlsxBuffer = buildApprovedExcel(approved);
    const dateTag = todayStr.replace(/\//g, '-');

    const fromEmail = process.env.REPORT_FROM_EMAIL || process.env.SMTP_USER || undefined;
    const result = await sendEmail({
      to: ['coordinacion_di@americana.edu.co'],
      subject: `Reporte de cursos aprobados — ${todayStr}`,
      html,
      fromEmail,
      fromName: 'Virtualización Americana',
      attachments: [{
        filename: `cursos_aprobados_${dateTag}.xlsx`,
        content: xlsxBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }],
    });

    return NextResponse.json({ ok: result.success, count: windowApproved.length, error: result.error });
  } catch (err) {
    console.error('[api/report/approved]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!role || !['Super Admin', 'Coordinador'].includes(role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
  const all = await readAllCourses();
  const approved = all.filter(c => {
    const e = String(c.Estado ?? '').trim();
    const revalidacion = String(c['Estado de la revalidación DI'] ?? '').trim();
    return e === 'Aprobado DI' || e === 'Aprobado' || revalidacion === 'Aprobado';
  });

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayStr = fmtDate(today);
  const yesterdayStr = fmtDate(yesterday);

  const windowApproved = approved.filter(c => {
    const revalidacion = String(c['Estado de la revalidación DI'] ?? '').trim();
    const fecha = revalidacion === 'Aprobado'
      ? parseDateField(c['Fecha revalidación de DI'])
      : parseDateField(c['Fecha fin revisión DI']);
    return fecha === todayStr || fecha === yesterdayStr;
  });

  const grupos = groupCourses(windowApproved);
  const plainText = buildPlainText(grupos, today);

  return NextResponse.json({
    date: todayStr,
    countToday: windowApproved.length,
    countTotal: approved.length,
    plainText,
    groups: grupos.map(g => ({
      nivelTipo: g.nivelTipo,
      proyecto: g.proyecto,
      count: g.cursos.length,
    })),
  });
  } catch (err) {
    console.error('[api/report/approved GET]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
