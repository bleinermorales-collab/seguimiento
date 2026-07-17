'use client';

import { useMemo } from 'react';
import { normalizarNombre } from '@/lib/nombre-aliases';

export interface CourseRowGC {
  _nivel: string;
  _programa?: string;
  _modalidad?: string;
  Asignatura?: string;
  Estado?: string;
  'Gestor asignado'?: string;
  'Fecha de solicitud PA'?: string;
  'Fecha de asignación'?: string;
  'Fecha programada de producción'?: string;
}

const NIVELES = ['Pregrado', 'Especializaciones', 'Maestrías', 'Doctorado'];
const NIVEL_SHORT: Record<string, string> = {
  Pregrado: 'Pregrado', Especializaciones: 'Especialización', Maestrías: 'Maestría', Doctorado: 'Doctorado',
};
const NIVEL_COLORS: Record<string, string> = {
  Pregrado: '#3b82f6', Especializaciones: '#8b5cf6', Maestrías: '#22c55e', Doctorado: '#f97316',
};
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function parseDate(s: unknown): Date | null {
  if (!s) return null;
  if (s instanceof Date) return s;
  const str = String(s).trim();
  if (!str || str === 'null' || str === 'undefined') return null;
  const n = Number(str);
  if (!isNaN(n) && n > 40000 && !str.includes('/')) {
    return new Date(new Date(Date.UTC(1899, 11, 30)).getTime() + n * 86400000);
  }
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function diffDays(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  const d = Math.round((b.getTime() - a.getTime()) / 86400000);
  return d >= 0 ? d : null;
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function isNoIniciado(c: CourseRowGC): boolean {
  const e = String(c.Estado ?? '').trim();
  return !e || e === 'No empezado' || e === 'Sin iniciar';
}

function getGestor(c: CourseRowGC): string {
  const raw = (c['Gestor asignado'] || '').toString().trim();
  return raw ? normalizarNombre(raw) : '';
}

// 'Fecha programada de producción' puede venir como "AAAA-MM" (input type=month) o como nombre de mes en español (dato histórico)
function mesProgramado(raw: unknown): number | null {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const ym = str.match(/^(\d{4})-(\d{1,2})$/);
  if (ym) return parseInt(ym[2], 10);
  const idx = MESES_ES.indexOf(str.toLowerCase());
  if (idx !== -1) return idx + 1;
  const d = parseDate(str);
  return d ? d.getMonth() + 1 : null;
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      {title && <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">{title}</p>}
      {children}
    </div>
  );
}

export default function DashboardCoordinadorGC({ courses }: { courses: CourseRowGC[] }) {
  const s = useMemo(() => {
    const dias: number[] = [];
    for (const c of courses) {
      const sol = parseDate(c['Fecha de solicitud PA']);
      const asig = parseDate(c['Fecha de asignación']);
      const d = diffDays(sol, asig);
      if (d !== null) dias.push(d);
    }
    const diasPromedioSolicitudAsignacion = avg(dias).toFixed(1);

    const now = new Date();
    const asignadosRecientes = courses.filter(c => {
      const d = parseDate(c['Fecha de asignación']);
      if (!d) return false;
      return Math.floor((now.getTime() - d.getTime()) / 86400000) <= 30;
    }).length;
    const asignadosPorDia = (asignadosRecientes / 30).toFixed(1);

    let matchMes = 0, totalConAmbasFechas = 0;
    for (const c of courses) {
      const mesProg = mesProgramado(c['Fecha programada de producción']);
      const fechaAsig = parseDate(c['Fecha de asignación']);
      if (mesProg == null || !fechaAsig) continue;
      totalConAmbasFechas++;
      if (fechaAsig.getMonth() + 1 === mesProg) matchMes++;
    }
    const pctMesConcuerda = totalConAmbasFechas > 0 ? Math.round(matchMes / totalConAmbasFechas * 100) : 0;

    const modalidades = Array.from(new Set(courses.map(c => String(c._modalidad ?? '').trim() || 'Sin modalidad'))).sort();

    const noEmpezadosPorNivel = NIVELES.map(n => {
      const nc = courses.filter(c => c._nivel === n);
      const total = nc.length;
      const faltan = nc.filter(isNoIniciado).length;
      const pct = total > 0 ? Math.round(faltan / total * 100) : 0;
      const porModalidad = modalidades
        .map(mod => {
          const mc = nc.filter(c => (String(c._modalidad ?? '').trim() || 'Sin modalidad') === mod);
          const t = mc.length;
          const f = mc.filter(isNoIniciado).length;
          return { modalidad: mod, total: t, faltan: f, pct: t > 0 ? Math.round(f / t * 100) : 0 };
        })
        .filter(m => m.total > 0);
      return { nivel: n, total, faltan, pct, porModalidad };
    });

    const totalGeneral = courses.length;
    const faltanGeneral = courses.filter(isNoIniciado).length;
    const pctGeneral = totalGeneral > 0 ? Math.round(faltanGeneral / totalGeneral * 100) : 0;

    // Cursos asignados por mes (año actual, según Fecha de asignación)
    const currentYear = now.getFullYear();
    const numMonths = now.getMonth() + 1;
    const asignadosPorMes = Array(numMonths).fill(0);
    for (const c of courses) {
      const d = parseDate(c['Fecha de asignación']);
      if (!d || d.getFullYear() !== currentYear) continue;
      const m = d.getMonth();
      if (m < numMonths) asignadosPorMes[m]++;
    }
    const asignadosPorMesLabels = Array.from({ length: numMonths }, (_, m) => MESES_CORTO[m]);

    // Carga de asignación por gestor (cursos actualmente asignados a cada uno)
    const gestorMap = new Map<string, number>();
    for (const c of courses) {
      const g = getGestor(c);
      if (!g) continue;
      gestorMap.set(g, (gestorMap.get(g) ?? 0) + 1);
    }
    const cargaPorGestor = Array.from(gestorMap.entries())
      .map(([gestor, count]) => ({ gestor, count }))
      .sort((a, b) => b.count - a.count);

    return {
      diasPromedioSolicitudAsignacion,
      muestraDias: dias.length,
      asignadosPorDia,
      pctMesConcuerda,
      totalConAmbasFechas,
      noEmpezadosPorNivel,
      totalGeneral,
      faltanGeneral,
      pctGeneral,
      asignadosPorMes,
      asignadosPorMesLabels,
      cargaPorGestor,
    };
  }, [courses]);

  const maxAsignadosMes = Math.max(...s.asignadosPorMes, 1);
  const maxCargaGestor = Math.max(...s.cargaPorGestor.map(g => g.count), 1);

  return (
    <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Solicitud → Asignación">
          <p className="text-3xl font-bold text-indigo-600">{s.diasPromedioSolicitudAsignacion}</p>
          <p className="text-xs text-gray-500 mt-1">días en promedio</p>
          <p className="text-[10px] text-gray-400 mt-2">Fecha de solicitud PA → Fecha de asignación · {s.muestraDias} curso{s.muestraDias !== 1 ? 's' : ''} con ambas fechas</p>
        </Card>

        <Card title="Ritmo de asignación">
          <p className="text-3xl font-bold text-cyan-600">{s.asignadosPorDia}</p>
          <p className="text-xs text-gray-500 mt-1">cursos asignados por día (prom.)</p>
          <p className="text-[10px] text-gray-400 mt-2">Basado en asignaciones de los últimos 30 días</p>
        </Card>

        <Card title="Cumplimiento del mes programado">
          <p className="text-3xl font-bold text-emerald-600">{s.pctMesConcuerda}%</p>
          <p className="text-xs text-gray-500 mt-1">se asignan en el mes programado</p>
          <p className="text-[10px] text-gray-400 mt-2">Fecha de asignación cae en el mismo mes que Fecha programada de producción · {s.totalConAmbasFechas} curso{s.totalConAmbasFechas !== 1 ? 's' : ''} comparados</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Cursos no empezados por nivel y modalidad">
          <div className="space-y-4">
            {s.noEmpezadosPorNivel.filter(r => r.total > 0).map(r => (
              <div key={r.nivel}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold" style={{ color: NIVEL_COLORS[r.nivel] }}>{NIVEL_SHORT[r.nivel]}</span>
                  <span className="text-sm font-bold text-gray-700">
                    {r.faltan}/{r.total} <span className="text-gray-400 font-normal">({r.pct}%)</span>
                  </span>
                </div>
                <div className="space-y-1 pl-3 border-l-2" style={{ borderColor: NIVEL_COLORS[r.nivel] + '40' }}>
                  {r.porModalidad.map(m => (
                    <div key={m.modalidad} className="flex items-center justify-between text-xs text-gray-500">
                      <span>{m.modalidad}</span>
                      <span>{m.faltan}/{m.total} <span className="text-gray-400">({m.pct}%)</span></span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <span className="text-sm font-bold text-gray-800">Total</span>
              <span className="text-sm font-bold text-gray-800">
                {s.faltanGeneral}/{s.totalGeneral} <span className="text-gray-400 font-normal">({s.pctGeneral}%)</span>
              </span>
            </div>
          </div>
        </Card>

        <Card title="Cursos asignados por mes">
          <div className="flex items-end gap-1.5 h-28 mb-1">
            {s.asignadosPorMes.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                <span className="text-[9px] text-gray-400">{v > 0 ? v : ''}</span>
                <div className="w-full rounded-t"
                  style={{ height: `${Math.max(3, (v / maxAsignadosMes) * 88)}px`, backgroundColor: i === s.asignadosPorMes.length - 1 ? '#0891b2' : '#6366f1' }} />
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            {s.asignadosPorMesLabels.map((l, i) => (
              <span key={i} className="flex-1 text-center text-[9px] text-gray-400">{l}</span>
            ))}
          </div>

          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-5 mb-3">Carga de asignación por gestor</p>
          {s.cargaPorGestor.length === 0 ? (
            <p className="text-xs text-gray-400">Sin gestores asignados</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {s.cargaPorGestor.map(g => (
                <div key={g.gestor} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-28 shrink-0 truncate" title={g.gestor}>{g.gestor}</span>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(g.count / maxCargaGestor) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-indigo-600 w-6 text-right">{g.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
