import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readAllCourses } from '@/lib/sheets';
import { sendEmail } from '@/lib/email';
import { normalizarNombre } from '@/lib/nombre-aliases';

const DEST_EMAIL = 'lizneyr@americana.edu.co';

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

type Curso = Record<string, unknown>;

type EstadoKey = 'sinIniciar' | 'enProceso' | 'enRevision' | 'correccion' | 'aprobado' | 'producido' | 'otros';

const ESTADO_LABELS: Record<EstadoKey, string> = {
  sinIniciar:  'Sin iniciar',
  enProceso:   'En proceso',
  enRevision:  'En revisión',
  correccion:  'Corrección',
  aprobado:    'Aprobado',
  producido:   'Producido / Cargado',
  otros:       'Otros',
};

const ESTADO_COLORS: Record<EstadoKey, string> = {
  sinIniciar:  '#6b7280',
  enProceso:   '#2563eb',
  enRevision:  '#d97706',
  correccion:  '#dc2626',
  aprobado:    '#16a34a',
  producido:   '#7c3aed',
  otros:       '#9ca3af',
};

function classifyEstado(c: Curso): EstadoKey {
  const e = String(c.Estado ?? '').trim();
  const ec = String(c['Estado curso'] ?? '').trim();
  const rev = String(c['Estado de la revalidación DI'] ?? '').trim();

  if (!e || e === 'No empezado' || e === 'Sin iniciar') return 'sinIniciar';
  if (e === 'En proceso') return 'enProceso';
  if (e === 'Aprobado DI' || e === 'Aprobado' || rev === 'Aprobado') return 'aprobado';
  if (e === 'Producido' || e === 'Cargado') return 'producido';
  if (e === 'Corrección' || ec === 'Corrección') return 'correccion';
  if (e === 'En revisión' || e === 'Enviado a revisión') return 'enRevision';
  return 'otros';
}

interface Stats {
  total: number;
  byEstado: Record<EstadoKey, number>;
  byNivel: Record<string, { total: number; byEstado: Record<EstadoKey, number> }>;
  byDI: Record<string, { total: number; byEstado: Partial<Record<EstadoKey, number>> }>;
  byGestor: Record<string, { total: number; byEstado: Partial<Record<EstadoKey, number>> }>;
  enCorreccion: Curso[];
}

function computeStats(courses: Curso[]): Stats {
  const byEstado: Record<EstadoKey, number> = { sinIniciar: 0, enProceso: 0, enRevision: 0, correccion: 0, aprobado: 0, producido: 0, otros: 0 };
  const byNivel: Stats['byNivel'] = {};
  const byDI: Stats['byDI'] = {};
  const byGestor: Stats['byGestor'] = {};
  const enCorreccion: Curso[] = [];

  for (const c of courses) {
    const estado = classifyEstado(c);
    byEstado[estado]++;

    const nivel = String(c._nivel ?? '').trim() || 'Sin nivel';
    if (!byNivel[nivel]) byNivel[nivel] = { total: 0, byEstado: { sinIniciar: 0, enProceso: 0, enRevision: 0, correccion: 0, aprobado: 0, producido: 0, otros: 0 } };
    byNivel[nivel].total++;
    byNivel[nivel].byEstado[estado]++;

    const di = normalizarNombre(String(c['DI responsable'] ?? c['DI asignado'] ?? '').trim());
    if (di) {
      if (!byDI[di]) byDI[di] = { total: 0, byEstado: {} };
      byDI[di].total++;
      byDI[di].byEstado[estado] = (byDI[di].byEstado[estado] ?? 0) + 1;
    }

    const g = normalizarNombre(String(c['Gestor responsable '] ?? c['Gestor responsable'] ?? '').trim());
    if (g) {
      if (!byGestor[g]) byGestor[g] = { total: 0, byEstado: {} };
      byGestor[g].total++;
      byGestor[g].byEstado[estado] = (byGestor[g].byEstado[estado] ?? 0) + 1;
    }

    if (estado === 'correccion') enCorreccion.push(c);
  }

  return { total: courses.length, byEstado, byNivel, byDI, byGestor, enCorreccion };
}

function pct(val: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((val / total) * 100)}%`;
}

function progressBar(val: number, total: number, color: string): string {
  const p = total ? Math.round((val / total) * 100) : 0;
  return `<div style="background:#f3f4f6;border-radius:4px;height:6px;margin-top:4px">
    <div style="background:${color};height:6px;border-radius:4px;width:${p}%"></div>
  </div>`;
}

function buildHtml(stats: Stats, fecha: Date): string {
  const { total, byEstado, byNivel, byDI, byGestor, enCorreccion } = stats;
  const fechaStr = fmtDate(fecha);
  const avance = pct(byEstado.aprobado + byEstado.producido, total);
  const activos = byEstado.enProceso + byEstado.enRevision + byEstado.correccion;

  // Estado summary rows
  const estadoRows = (Object.entries(ESTADO_LABELS) as [EstadoKey, string][])
    .map(([key, label]) => `
      <tr>
        <td style="padding:8px 12px;font-size:13px;color:#374151">${label}</td>
        <td style="padding:8px 12px;text-align:center">
          <span style="background:${ESTADO_COLORS[key]}22;color:${ESTADO_COLORS[key]};font-weight:700;font-size:13px;padding:2px 10px;border-radius:999px">${byEstado[key]}</span>
        </td>
        <td style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280">${pct(byEstado[key], total)}</td>
        <td style="padding:8px 12px;width:100px">${progressBar(byEstado[key], total, ESTADO_COLORS[key])}</td>
      </tr>`)
    .join('');

  // Nivel rows
  const nivelOrder = ['Pregrado', 'Especializaciones', 'Maestrías', 'Doctorado'];
  const nivelesOrdenados = [...nivelOrder.filter(n => byNivel[n]), ...Object.keys(byNivel).filter(n => !nivelOrder.includes(n))];
  const nivelRows = nivelesOrdenados.map(nivel => {
    const nd = byNivel[nivel];
    return `<tr>
      <td style="padding:8px 12px;font-size:13px;color:#374151;font-weight:600">${nivel}</td>
      <td style="padding:8px 12px;text-align:center;font-size:13px;font-weight:700;color:#1a1a2e">${nd.total}</td>
      <td style="padding:8px 12px;font-size:12px;color:#6b7280">
        ${nd.byEstado.aprobado ? `<span style="color:#16a34a">✓ ${nd.byEstado.aprobado} apr.</span> ` : ''}
        ${nd.byEstado.enRevision ? `<span style="color:#d97706">↗ ${nd.byEstado.enRevision} rev.</span> ` : ''}
        ${nd.byEstado.correccion ? `<span style="color:#dc2626">⚠ ${nd.byEstado.correccion} corr.</span>` : ''}
      </td>
    </tr>`;
  }).join('');

  // DI rows
  const diOrdenados = Object.entries(byDI).sort((a, b) => b[1].total - a[1].total);
  const diRows = diOrdenados.map(([nombre, data]) => `
    <tr>
      <td style="padding:7px 12px;font-size:12px;color:#374151">${nombre}</td>
      <td style="padding:7px 12px;text-align:center;font-size:12px;font-weight:700">${data.total}</td>
      <td style="padding:7px 12px;font-size:11px;color:#6b7280">
        ${data.byEstado.enRevision ? `<span style="color:#d97706">${data.byEstado.enRevision} en rev.</span> ` : ''}
        ${data.byEstado.aprobado ? `<span style="color:#16a34a">${data.byEstado.aprobado} apr.</span> ` : ''}
        ${data.byEstado.correccion ? `<span style="color:#dc2626">${data.byEstado.correccion} corr.</span>` : ''}
      </td>
    </tr>`).join('');

  // Corrección list
  const corrRows = enCorreccion.slice(0, 15).map(c => `
    <tr>
      <td style="padding:6px 12px;font-size:12px;color:#1a1a2e;font-weight:600">${String(c.Asignatura ?? '')}</td>
      <td style="padding:6px 12px;font-size:11px;color:#6b7280">${String(c._nivel ?? '')} · ${String(c._programa ?? '')}</td>
      <td style="padding:6px 12px;font-size:11px;color:#6b7280">${String(c['DI responsable'] ?? c['DI asignado'] ?? '—')}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f2f5;padding:32px 16px">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(19,0,253,.10)">

  <tr><td style="height:5px;background:linear-gradient(90deg,#1300fd 0%,#10b981 50%,#f59e0b 100%)"></td></tr>

  <tr><td style="background:#1300fd;padding:28px 36px 24px">
    <div style="font-size:11px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,.6);text-transform:uppercase;margin-bottom:10px">Corporación Universitaria Americana</div>
    <div style="font-size:20px;font-weight:700;color:#fff;line-height:1.3;margin-bottom:4px">Reporte General de Virtualización</div>
    <div style="font-size:13px;color:rgba(255,255,255,.75)">${fechaStr} · ${total} cursos en total · ${avance} completado</div>
  </td></tr>

  <!-- KPIs -->
  <tr><td style="padding:24px 36px 0">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="25%" style="padding:0 6px 0 0">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;text-align:center">
            <div style="font-size:24px;font-weight:800;color:#16a34a">${byEstado.aprobado + byEstado.producido}</div>
            <div style="font-size:11px;color:#15803d;font-weight:600;margin-top:2px">Completados</div>
          </div>
        </td>
        <td width="25%" style="padding:0 6px">
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;text-align:center">
            <div style="font-size:24px;font-weight:800;color:#d97706">${activos}</div>
            <div style="font-size:11px;color:#b45309;font-weight:600;margin-top:2px">En curso</div>
          </div>
        </td>
        <td width="25%" style="padding:0 6px">
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;text-align:center">
            <div style="font-size:24px;font-weight:800;color:#dc2626">${byEstado.correccion}</div>
            <div style="font-size:11px;color:#b91c1c;font-weight:600;margin-top:2px">Corrección</div>
          </div>
        </td>
        <td width="25%" style="padding:0 0 0 6px">
          <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:14px;text-align:center">
            <div style="font-size:24px;font-weight:800;color:#7c3aed">${byEstado.sinIniciar}</div>
            <div style="font-size:11px;color:#6d28d9;font-weight:600;margin-top:2px">Sin iniciar</div>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Estado general -->
  <tr><td style="padding:24px 36px 0">
    <div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1300fd;border-bottom:2px solid #1300fd;padding-bottom:8px;margin-bottom:4px">Estado general</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${estadoRows}
    </table>
  </td></tr>

  <!-- Por nivel -->
  <tr><td style="padding:24px 36px 0">
    <div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1300fd;border-bottom:2px solid #1300fd;padding-bottom:8px;margin-bottom:4px">Por nivel académico</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr style="background:#f9fafb">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase">Nivel</th>
        <th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase">Total</th>
        <th style="padding:8px 12px;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase">Detalle</th>
      </tr>
      ${nivelRows}
    </table>
  </td></tr>

  <!-- Carga de trabajo DIs -->
  ${diRows ? `<tr><td style="padding:24px 36px 0">
    <div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1300fd;border-bottom:2px solid #1300fd;padding-bottom:8px;margin-bottom:4px">Carga de trabajo — Diseñadores Instruccionales</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr style="background:#f9fafb">
        <th style="padding:7px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase">DI</th>
        <th style="padding:7px 12px;text-align:center;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase">Cursos</th>
        <th style="padding:7px 12px;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase">Estado</th>
      </tr>
      ${diRows}
    </table>
  </td></tr>` : ''}

  <!-- Cursos en corrección -->
  ${corrRows ? `<tr><td style="padding:24px 36px 0">
    <div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#dc2626;border-bottom:2px solid #dc2626;padding-bottom:8px;margin-bottom:4px">
      Cursos en corrección (${enCorreccion.length})
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr style="background:#fef2f2">
        <th style="padding:6px 12px;text-align:left;font-size:11px;color:#b91c1c;font-weight:600;text-transform:uppercase">Asignatura</th>
        <th style="padding:6px 12px;font-size:11px;color:#b91c1c;font-weight:600;text-transform:uppercase">Nivel · Programa</th>
        <th style="padding:6px 12px;font-size:11px;color:#b91c1c;font-weight:600;text-transform:uppercase">DI</th>
      </tr>
      ${corrRows}
    </table>
    ${enCorreccion.length > 15 ? `<p style="font-size:11px;color:#9ca3af;padding:0 12px">... y ${enCorreccion.length - 15} más</p>` : ''}
  </td></tr>` : ''}

  <!-- Footer -->
  <tr><td style="padding:24px 36px;margin-top:16px">
    <div style="background:#f8f9ff;border-radius:10px;padding:14px;font-size:11px;color:#9ca3af;text-align:center">
      Reporte generado el ${fechaStr} desde el Panel Super Admin · Corporación Universitaria Americana
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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'Super Admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const all = await readAllCourses();
    const stats = computeStats(all);
    const today = new Date();
    const html = buildHtml(stats, today);
    const fechaStr = fmtDate(today);

    const fromEmail = process.env.REPORT_FROM_EMAIL || process.env.SMTP_USER || undefined;
    const result = await sendEmail({
      to: [DEST_EMAIL],
      subject: `Reporte general de virtualización — ${fechaStr}`,
      html,
      fromEmail,
      fromName: 'Virtualización Americana',
    });

    return NextResponse.json({
      ok: result.success,
      total: stats.total,
      aprobados: stats.byEstado.aprobado + stats.byEstado.producido,
      enCorreccion: stats.byEstado.correccion,
      error: result.error,
    });
  } catch (err) {
    console.error('[api/report/general]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
