'use client';

import { useMemo } from 'react';

export interface CourseRowDI {
  _nivel: string;
  Estado?: string;
  'Estado curso'?: string;
  'DI responsable'?: string;
  'Fin Gestor'?: string;
  'Fecha de asignación DI'?: string;
  'Fecha fin revisión DI'?: string;
  'Fecha fin corrección gestor'?: string;
  'Fecha de aprobación (CDI)'?: string;
}

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

function isEnRevision(c: CourseRowDI): boolean {
  const e = String(c.Estado ?? '').trim();
  return e === 'En revisión' || e === 'Enviado a revisión';
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      {title && <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{title}</p>}
      {children}
    </div>
  );
}

export default function DashboardCoordinadorDI({ courses }: { courses: CourseRowDI[] }) {
  const s = useMemo(() => {
    const finGestorAsigDI: number[] = [];
    for (const c of courses) {
      const d = diffDays(parseDate(c['Fin Gestor']), parseDate(c['Fecha de asignación DI']));
      if (d !== null) finGestorAsigDI.push(d);
    }
    const diasFinGestorAsigDI = avg(finGestorAsigDI);

    const aprobDIaNotifCDI: number[] = [];
    for (const c of courses) {
      const d = diffDays(parseDate(c['Fecha fin revisión DI']), parseDate(c['Fecha de aprobación (CDI)']));
      if (d !== null) aprobDIaNotifCDI.push(d);
    }
    const diasAprobDIaNotifCDI = avg(aprobDIaNotifCDI);

    const isAprobadoCurso = (c: CourseRowDI) => String(c['Estado curso'] ?? '').trim() === 'Aprobado';
    const approvedCount = courses.filter(isAprobadoCurso).length;
    const approvedDirect = courses.filter(c => isAprobadoCurso(c) && !parseDate(c['Fecha fin corrección gestor'])).length;
    const tasaDirecta = approvedCount > 0 ? Math.round((approvedDirect / approvedCount) * 100) : 0;

    const enRevisionCursos = courses.filter(isEnRevision);
    const cursosEnRevision = enRevisionCursos.length;
    const disTintos = new Set(
      enRevisionCursos.map(c => (c['DI responsable'] || '').toString().trim()).filter(n => n)
    ).size;

    const now = new Date();
    const reportadosRecientes = courses.filter(c => {
      const d = parseDate(c['Fecha de aprobación (CDI)']);
      if (!d) return false;
      return Math.floor((now.getTime() - d.getTime()) / 86400000) <= 30;
    }).length;
    const reportadosPorDia = (reportadosRecientes / 30).toFixed(1);

    return {
      diasFinGestorAsigDI,
      muestraFinGestorAsigDI: finGestorAsigDI.length,
      diasAprobDIaNotifCDI,
      muestraAprobDIaNotifCDI: aprobDIaNotifCDI.length,
      tasaDirecta,
      approvedCount,
      cursosEnRevision,
      disTintos,
      reportadosPorDia,
      reportadosRecientes,
    };
  }, [courses]);

  return (
    <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <p className="text-2xl font-bold text-orange-600">{s.diasFinGestorAsigDI.toFixed(1)}</p>
          <p className="text-xs text-gray-500 mt-1">Días fin gestor → asignación DI</p>
          <p className={`text-[10px] mt-2 font-semibold ${s.diasFinGestorAsigDI <= 3 ? 'text-green-600' : 'text-red-600'}`}>
            {s.diasFinGestorAsigDI <= 3 ? '✓' : '▲'} Meta: ≤ 3 días
          </p>
        </Card>

        <Card>
          <p className="text-2xl font-bold text-emerald-600">{s.diasAprobDIaNotifCDI.toFixed(1)}</p>
          <p className="text-xs text-gray-500 mt-1">Días aprobación DI → notif. CDI</p>
          <p className={`text-[10px] mt-2 font-semibold ${s.diasAprobDIaNotifCDI <= 2 ? 'text-green-600' : 'text-red-600'}`}>
            {s.diasAprobDIaNotifCDI <= 2 ? '✓' : '▲'} Meta: ≤ 2 días
          </p>
        </Card>

        <Card>
          <p className="text-2xl font-bold text-indigo-600">{s.tasaDirecta}%</p>
          <p className="text-xs text-gray-500 mt-1">Tasa aprobación directa (sin corrección)</p>
          <p className="text-[10px] text-indigo-500 mt-2 font-semibold">{100 - s.tasaDirecta}% van a corrección</p>
        </Card>

        <Card>
          <p className="text-2xl font-bold text-amber-600">{s.cursosEnRevision}</p>
          <p className="text-xs text-gray-500 mt-1">Cursos activos en revisión DI</p>
          <p className="text-[10px] text-gray-400 mt-2">Distribuidos en {s.disTintos} DI{s.disTintos !== 1 ? 's' : ''}</p>
        </Card>

        <Card>
          <p className="text-2xl font-bold text-cyan-600">{s.reportadosPorDia}</p>
          <p className="text-xs text-gray-500 mt-1">Cursos reportados por día (prom.)</p>
          <p className="text-[10px] text-gray-400 mt-2">Según Fecha de aprobación (CDI) · últimos 30 días</p>
        </Card>
      </div>
    </div>
  );
}
