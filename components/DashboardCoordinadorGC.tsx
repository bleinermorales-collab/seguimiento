'use client';

import { useMemo } from 'react';

export interface CourseRowGC {
  _nivel: string;
  _programa?: string;
  Asignatura?: string;
  Estado?: string;
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

    const noEmpezadosPorNivel = NIVELES.map(n => ({
      nivel: n,
      count: courses.filter(c => c._nivel === n && isNoIniciado(c)).length,
    }));
    const totalNoEmpezados = noEmpezadosPorNivel.reduce((a, r) => a + r.count, 0);
    const maxNoEmpezados = Math.max(...noEmpezadosPorNivel.map(r => r.count), 1);

    return {
      diasPromedioSolicitudAsignacion,
      muestraDias: dias.length,
      asignadosPorDia,
      pctMesConcuerda,
      totalConAmbasFechas,
      noEmpezadosPorNivel,
      totalNoEmpezados,
      maxNoEmpezados,
    };
  }, [courses]);

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

      <Card title="Cursos no empezados por nivel">
        <div className="space-y-3">
          {s.noEmpezadosPorNivel.map(r => (
            <div key={r.nivel} className="flex items-center gap-3">
              <span className="text-sm text-gray-600 w-32 shrink-0">{NIVEL_SHORT[r.nivel]}</span>
              <div className="flex-1 h-3.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(r.count / s.maxNoEmpezados) * 100}%`, backgroundColor: NIVEL_COLORS[r.nivel] }} />
              </div>
              <span className="text-base font-bold w-10 text-right" style={{ color: NIVEL_COLORS[r.nivel] }}>{r.count}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <span className="text-sm font-bold text-gray-800 w-32 shrink-0">Total</span>
            <div className="flex-1" />
            <span className="text-base font-bold w-10 text-right text-gray-800">{s.totalNoEmpezados}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
