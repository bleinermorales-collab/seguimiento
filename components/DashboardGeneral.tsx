'use client';

import { useMemo } from 'react';

export interface CourseRow {
  _nivel: string;
  _programa: string;
  _modalidad?: string;
  Asignatura: string;
  Estado?: string;
  'Estado curso'?: string;
  'Gestor responsable '?: string;
  'Gestor responsable'?: string;
  'DI responsable'?: string;
  'Fecha de asignación'?: string;
  'Inicio Gestor'?: string;
  'Fin Gestor'?: string;
  'Fecha inicio revisión DI'?: string;
  'Fecha fin revisión DI'?: string;
  'Fecha fin corrección gestor'?: string;
  Prioridad?: string;
  PRIORIDAD?: string;
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

function isPriority(c: CourseRow): boolean {
  const val = String(c['Prioridad'] ?? c['PRIORIDAD'] ?? '').trim();
  return val !== '' && val !== '0' && val.toUpperCase() !== 'NO' && val !== 'null';
}

function getGestor(c: CourseRow): string {
  return (c['Gestor responsable '] || c['Gestor responsable'] || '').toString().trim();
}

function isAprobado(c: CourseRow): boolean {
  const e = String(c.Estado ?? '').trim();
  const ec = String(c['Estado curso'] ?? '').trim();
  return e === 'Aprobado DI' || ec === 'Aprobado';
}

function isEnRevision(c: CourseRow): boolean {
  const e = String(c.Estado ?? '').trim();
  return e === 'En revisión' || e === 'Enviado a revisión';
}

function isNoIniciado(c: CourseRow): boolean {
  const e = String(c.Estado ?? '').trim();
  return !e || e === 'No empezado' || e === 'Sin iniciar';
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const NIVELES = ['Pregrado', 'Especializaciones', 'Maestrías', 'Doctorado'];
const NIVEL_SHORT: Record<string, string> = {
  Pregrado: 'Pregrado', Especializaciones: 'Especialización', Maestrías: 'Maestría', Doctorado: 'Doctorado',
};
const NIVEL_COLORS: Record<string, string> = {
  Pregrado: '#3b82f6', Especializaciones: '#8b5cf6', Maestrías: '#22c55e', Doctorado: '#f97316',
};

// ── Donut SVG ─────────────────────────────────────────────────────────────────
function DonutChart({ segs, total }: { segs: { color: string; value: number }[]; total: number }) {
  const r = 45, cx = 60, cy = 60, circ = 2 * Math.PI * r;
  if (total === 0) return <svg viewBox="0 0 120 120" className="w-36 h-36"><circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={13} /></svg>;

  let cumulative = 0;
  const circles = segs.filter(s => s.value > 0).map((seg, i) => {
    const frac = seg.value / total;
    const dash = frac * circ;
    const rotate = -90 + (cumulative / total) * 360;
    cumulative += seg.value;
    return (
      <circle key={i} cx={cx} cy={cy} r={r} fill="none"
        stroke={seg.color} strokeWidth={13}
        strokeDasharray={`${dash} ${circ - dash}`}
        transform={`rotate(${rotate} ${cx} ${cy})`}
        strokeLinecap="butt" />
    );
  });

  return (
    <svg viewBox="0 0 120 120" className="w-36 h-36">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={13} />
      {circles}
      <text x={cx} y={cy - 7} textAnchor="middle" fill="#111827" fontSize="20" fontWeight="bold">{total}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#9ca3af" fontSize="9">cursos</text>
    </svg>
  );
}

// ── Stacked progress bar ───────────────────────────────────────────────────────
function StackedBar({ aprobado, enRevision, correccion, noIniciado, total }: {
  aprobado: number; enRevision: number; correccion: number; noIniciado: number; total: number;
}) {
  if (total === 0) return <div className="h-3 bg-gray-100 rounded-full" />;
  const pct = (v: number) => `${(v / total * 100).toFixed(1)}%`;
  return (
    <div className="h-3 rounded-full overflow-hidden flex">
      <div style={{ width: pct(aprobado), backgroundColor: '#22c55e' }} />
      <div style={{ width: pct(enRevision), backgroundColor: '#3b82f6' }} />
      <div style={{ width: pct(correccion), backgroundColor: '#f97316' }} />
      <div style={{ width: pct(noIniciado), backgroundColor: '#e5e7eb' }} />
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-col gap-0.5 shadow-sm">
      <p className="text-[11px] text-gray-500 font-medium leading-tight">{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 shadow-sm ${className}`}>
      {title && <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">{title}</p>}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardGeneral({ courses }: { courses: CourseRow[] }) {
  const s = useMemo(() => {
    const total = courses.length;
    const aprobados = courses.filter(isAprobado).length;
    const enRevision = courses.filter(isEnRevision).length;
    const enCorreccion = courses.filter(c => String(c.Estado ?? '').trim() === 'Corrección').length;
    const noIniciados = courses.filter(isNoIniciado).length;
    const producidos = courses.filter(c => String(c.Estado ?? '').trim() === 'Producido').length;
    const cargados = courses.filter(c => String(c.Estado ?? '').trim() === 'Cargado').length;

    // Pipeline
    const asignados = courses.filter(c => !!getGestor(c)).length;
    const iniciados = courses.filter(c => !!parseDate(c['Inicio Gestor'])).length;
    const conDI = courses.filter(c => !!(c['DI responsable'] || '').toString().trim()).length;

    // Times
    const tAsigIni: number[] = [], tFinDI: number[] = [], tRevDI: number[] = [], tCorr: number[] = [], tTotal: number[] = [];
    for (const c of courses) {
      const asig = parseDate(c['Fecha de asignación']);
      const ini = parseDate(c['Inicio Gestor']);
      const fin = parseDate(c['Fin Gestor']);
      const iniDI = parseDate(c['Fecha inicio revisión DI']);
      const finDI = parseDate(c['Fecha fin revisión DI']);
      const finCorr = parseDate(c['Fecha fin corrección gestor']);
      const d1 = diffDays(asig, ini);    if (d1 !== null && d1 < 90) tAsigIni.push(d1);
      const d2 = diffDays(fin, iniDI);   if (d2 !== null && d2 < 90) tFinDI.push(d2);
      const d3 = diffDays(iniDI, finDI); if (d3 !== null && d3 < 90) tRevDI.push(d3);
      const d4 = diffDays(finDI, finCorr); if (d4 !== null && d4 < 90) tCorr.push(d4);
      if (asig && finDI) { const tot = diffDays(asig, finDI); if (tot !== null && tot < 365) tTotal.push(tot); }
    }

    // Aprobaciones por mes (last 8)
    const now = new Date();
    const monthCounts = Array(8).fill(0);
    const monthLabels: string[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthLabels.push(MONTHS_ES[d.getMonth()]);
    }
    for (const c of courses) {
      const d = parseDate(c['Fecha fin revisión DI']);
      if (!d) continue;
      const mo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (mo >= 0 && mo < 8) monthCounts[7 - mo]++;
    }

    // Nivel stats
    const nivelStats = NIVELES.map(n => {
      const nc = courses.filter(c => c._nivel === n);
      return {
        nivel: n,
        total: nc.length,
        aprobado: nc.filter(isAprobado).length,
        enRevision: nc.filter(isEnRevision).length,
        correccion: nc.filter(c => String(c.Estado ?? '').trim() === 'Corrección').length,
        noIniciado: nc.filter(isNoIniciado).length,
      };
    });

    // Prioritarios
    const prioAll = courses.filter(isPriority);
    const prioAprobados = prioAll.filter(isAprobado).length;
    const prioRevision = prioAll.filter(isEnRevision).length;
    const prioCorreccion = prioAll.filter(c => String(c.Estado ?? '').trim() === 'Corrección').length;
    const prioNoIniciados = prioAll.filter(isNoIniciado).length;

    const prioByNivel = NIVELES.map(n => {
      const nc = courses.filter(c => c._nivel === n);
      const prio = nc.filter(isPriority);
      return { nivel: n, total: nc.length, prio: prio.length, sinIniciar: prio.filter(isNoIniciado).length };
    });

    // Indicadores rápidos
    const recent = courses.filter(c => {
      const d = parseDate(c['Fecha fin revisión DI']);
      if (!d) return false;
      return Math.floor((now.getTime() - d.getTime()) / 86400000) <= 30;
    }).length;
    const aprobadosSemana = (recent / 4.3).toFixed(1);
    const aprobadosDia = (recent / 30).toFixed(1);

    const recentEnviados = courses.filter(c => {
      const d = parseDate(c['Fin Gestor']);
      if (!d) return false;
      return Math.floor((now.getTime() - d.getTime()) / 86400000) <= 30;
    }).length;
    const enviadosSemana = (recentEnviados / 4.3).toFixed(1);
    const approvedCount = courses.filter(isAprobado).length;
    const approvedDirect = courses.filter(c => isAprobado(c) && !parseDate(c['Fecha fin corrección gestor'])).length;
    const tasaDirecta = approvedCount > 0 ? Math.round((approvedDirect / approvedCount) * 100) : 0;

    return {
      total, aprobados, enRevision, enCorreccion, noIniciados, producidos, cargados,
      asignados, iniciados, conDI,
      tAsigIni: avg(tAsigIni).toFixed(1),
      tFinDI: avg(tFinDI).toFixed(1),
      tRevDI: avg(tRevDI).toFixed(1),
      tCorr: avg(tCorr).toFixed(1),
      tTotal: avg(tTotal).toFixed(1),
      monthCounts, monthLabels,
      nivelStats,
      prioAll: prioAll.length, prioAprobados, prioRevision, prioCorreccion, prioNoIniciados,
      prioByNivel,
      aprobadosSemana, aprobadosDia, tasaDirecta, enviadosSemana,
    };
  }, [courses]);

  const maxMonth = Math.max(...s.monthCounts, 1);

  const pipelineSteps = [
    { label: 'Solicitados', value: s.total,     color: '#3b82f6' },
    { label: 'Asignados',   value: s.asignados,  color: '#6366f1' },
    { label: 'Iniciados',   value: s.iniciados,  color: '#8b5cf6' },
    { label: 'Con DI',      value: s.conDI,      color: '#a855f7' },
    { label: 'Aprobados',   value: s.aprobados,  color: '#22c55e' },
    { label: 'Producidos',  value: s.producidos, color: '#10b981' },
    { label: 'Cargados',    value: s.cargados,   color: '#06b6d4' },
  ];

  const donutSegs = [
    { color: '#22c55e', value: s.aprobados },
    { color: '#3b82f6', value: s.enRevision },
    { color: '#f97316', value: s.enCorreccion },
    { color: '#ef4444', value: s.noIniciados },
    { color: '#a855f7', value: s.producidos },
    { color: '#06b6d4', value: s.cargados },
  ];

  return (
    <div className="bg-gray-50 rounded-2xl p-5 space-y-4">

      {/* ── KPIs ── */}
      <div className="grid grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard label="Total cursos"   value={s.total}        color="#111827" />
        <KpiCard label="No iniciados"   value={s.noIniciados}  color="#dc2626" />
        <KpiCard label="En revisión"    value={s.enRevision}   color="#2563eb" />
        <KpiCard label="En corrección"  value={s.enCorreccion} color="#ea580c" />
        <KpiCard label="Aprobados"      value={s.aprobados}    color="#16a34a" />
        <KpiCard label="Producidos"     value={s.producidos}   color="#9333ea" />
        <KpiCard label="Cargados"       value={s.cargados}     color="#0891b2" />
      </div>

      {/* ── Row 2: Vista rápida | Distribución | Aprobaciones ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Vista rápida */}
        <Card title="Vista rápida">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
              <p className="text-2xl font-bold text-violet-600">{s.enviadosSemana}</p>
              <p className="text-[10px] text-gray-500 mt-1 leading-tight">Enviados a<br />revisión/semana</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
              <p className="text-2xl font-bold text-cyan-600">{s.aprobadosSemana}</p>
              <p className="text-[10px] text-gray-500 mt-1 leading-tight">Aprobados<br />por semana</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
              <p className="text-2xl font-bold text-green-600">{s.aprobadosDia}</p>
              <p className="text-[10px] text-gray-500 mt-1 leading-tight">Aprobados<br />por día (prom.)</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
              <p className="text-2xl font-bold text-indigo-600">{s.tasaDirecta}%</p>
              <p className="text-[10px] text-gray-500 mt-1 leading-tight">Tasa aprobación<br />directa</p>
            </div>
          </div>

          {/* Donut */}
          <div className="flex items-center gap-4">
            <DonutChart segs={donutSegs} total={s.total} />
            <div className="space-y-1 text-[10px]">
              {[
                { color: '#22c55e', label: 'Aprobados',    val: s.aprobados },
                { color: '#3b82f6', label: 'En revisión',  val: s.enRevision },
                { color: '#f97316', label: 'Corrección',   val: s.enCorreccion },
                { color: '#ef4444', label: 'No iniciados', val: s.noIniciados },
                { color: '#a855f7', label: 'Producidos',   val: s.producidos },
                { color: '#06b6d4', label: 'Cargados',     val: s.cargados },
              ].map(seg => (
                <div key={seg.label} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-gray-500">{seg.label}</span>
                  <span className="font-bold ml-auto pl-2" style={{ color: seg.color }}>{s.total > 0 ? Math.round(seg.val / s.total * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Distribución por nivel */}
        <Card title="Distribución por nivel y estado">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {s.nivelStats.map(n => (
              <div key={n.nivel}>
                <p className="text-xs font-bold mb-2" style={{ color: NIVEL_COLORS[n.nivel] }}>
                  {NIVEL_SHORT[n.nivel]} {n.total}
                </p>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between text-gray-500"><span>Aprobado</span><span className="text-green-600 font-semibold">{n.aprobado}</span></div>
                  <div className="flex justify-between text-gray-500"><span>En revisión</span><span className="text-blue-600 font-semibold">{n.enRevision}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Corrección</span><span className="text-orange-600 font-semibold">{n.correccion}</span></div>
                  <div className="flex justify-between text-gray-500"><span>No iniciado</span><span className="text-gray-700 font-semibold">{n.noIniciado}</span></div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Aprobaciones por mes + tiempos */}
        <Card title="Aprobaciones por mes">
          <div className="flex items-end gap-1 h-28 mb-1">
            {s.monthCounts.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                <span className="text-[9px] text-gray-400">{v > 0 ? v : ''}</span>
                <div className="w-full rounded-t"
                  style={{ height: `${Math.max(3, (v / maxMonth) * 88)}px`, backgroundColor: i === s.monthCounts.length - 1 ? '#16a34a' : '#3b82f6' }} />
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            {s.monthLabels.map((l, i) => (
              <span key={i} className="flex-1 text-center text-[9px] text-gray-400">{l}</span>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-4 pt-3 space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Resumen de tiempos promedio</p>
            {[
              { label: 'Asignación → Inicio gestor', val: s.tAsigIni, color: '#6366f1' },
              { label: 'Fin gestor → asig. DI',      val: s.tFinDI,   color: '#8b5cf6' },
              { label: 'Duración revisión DI',        val: s.tRevDI,   color: '#2563eb' },
              { label: 'Tiempo corrección gestor',    val: s.tCorr,    color: '#ea580c' },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center text-[11px]">
                <span className="text-gray-500">{row.label}</span>
                <span className="font-bold" style={{ color: row.color }}>{row.val} días</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-1">
              <span className="text-[12px] font-bold text-gray-900">Ciclo total prom.</span>
              <span className="text-sm font-bold text-cyan-600">{s.tTotal} días</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Row 3: Cursos prioritarios | Prioridades por nivel | Embudo ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Cursos prioritarios */}
        <Card title="Cursos prioritarios">
          <div className="flex items-center gap-4 mb-4">
            <div>
              <p className="text-4xl font-bold text-violet-600">{s.prioAll}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">cursos con etiqueta<br /><span className="text-violet-600 font-semibold">Prioridad</span></p>
            </div>
            <div className="text-right ml-auto">
              <p className="text-2xl font-bold text-gray-900">{s.total > 0 ? Math.round(s.prioAll / s.total * 100) : 0}%</p>
              <p className="text-[10px] text-gray-400">del total</p>
            </div>
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Estado de los prioritarios</p>
          <div className="space-y-1.5">
            {[
              { label: 'Aprobados',    val: s.prioAprobados,   color: '#16a34a' },
              { label: 'En revisión',  val: s.prioRevision,    color: '#2563eb' },
              { label: 'Corrección',   val: s.prioCorreccion,  color: '#ea580c' },
              { label: 'No iniciados', val: s.prioNoIniciados, color: '#dc2626' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 w-24 shrink-0">{row.label}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: s.prioAll > 0 ? `${row.val / s.prioAll * 100}%` : '0%', backgroundColor: row.color }} />
                </div>
                <span className="text-[11px] font-bold w-6 text-right" style={{ color: row.color }}>{row.val}</span>
                <span className="text-[10px] text-gray-400 w-8">{s.prioAll > 0 ? Math.round(row.val / s.prioAll * 100) : 0}%</span>
              </div>
            ))}
          </div>
          {s.prioNoIniciados > 0 && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[11px] text-red-600">
              {s.prioNoIniciados} prioritario{s.prioNoIniciados > 1 ? 's' : ''} sin iniciar — requieren atención inmediata
            </div>
          )}
        </Card>

        {/* Prioridades por nivel + avance */}
        <Card title="Prioridades por nivel">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-semibold">Nivel</th>
                  <th className="text-right pb-2 font-semibold">Total</th>
                  <th className="text-right pb-2 font-semibold">Prio.</th>
                  <th className="text-right pb-2 font-semibold">%</th>
                  <th className="text-right pb-2 font-semibold">Sin ini.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {s.prioByNivel.map(row => (
                  <tr key={row.nivel}>
                    <td className="py-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: NIVEL_COLORS[row.nivel] + '18', color: NIVEL_COLORS[row.nivel] }}>
                        {NIVEL_SHORT[row.nivel]}
                      </span>
                    </td>
                    <td className="text-right text-gray-600">{row.total}</td>
                    <td className="text-right text-violet-600 font-bold">{row.prio}</td>
                    <td className="text-right text-gray-400">{row.total > 0 ? Math.round(row.prio / row.total * 100) : 0}%</td>
                    <td className="text-right">
                      <span className={row.sinIniciar > 0 ? 'text-red-600 font-bold' : 'text-gray-300'}>{row.sinIniciar}</span>
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-gray-200 font-bold">
                  <td className="py-1.5 text-gray-700">Total</td>
                  <td className="text-right text-gray-700">{s.total}</td>
                  <td className="text-right text-violet-600">{s.prioAll}</td>
                  <td className="text-right text-gray-400">{s.total > 0 ? Math.round(s.prioAll / s.total * 100) : 0}%</td>
                  <td className="text-right text-red-600">{s.prioByNivel.reduce((a, r) => a + r.sinIniciar, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Estado de avance por nivel (%)</p>
            <div className="space-y-2">
              {s.nivelStats.filter(n => n.total > 0).map(n => (
                <div key={n.nivel} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-20 shrink-0">{NIVEL_SHORT[n.nivel]}</span>
                  <StackedBar aprobado={n.aprobado} enRevision={n.enRevision} correccion={n.correccion} noIniciado={n.noIniciado} total={n.total} />
                </div>
              ))}
              <div className="flex gap-3 mt-2 flex-wrap">
                {[['#22c55e', 'Aprobado'], ['#3b82f6', 'En revisión'], ['#f97316', 'Corrección'], ['#e5e7eb', 'No iniciado']].map(([c, l]) => (
                  <div key={l} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm border border-gray-200" style={{ backgroundColor: c }} />
                    <span className="text-[9px] text-gray-400">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Embudo del pipeline */}
        <Card title="Embudo del pipeline — % de avance">
          <div className="space-y-2">
            {pipelineSteps.map(step => {
              const pct = s.total > 0 ? Math.round(step.value / s.total * 100) : 0;
              return (
                <div key={step.label} className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500 w-20 shrink-0">{step.label}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded-sm overflow-hidden">
                    <div className="h-full rounded-sm flex items-center pl-1.5 transition-all"
                      style={{ width: `${pct}%`, backgroundColor: step.color }}>
                      {pct > 15 && <span className="text-[10px] font-bold text-white">{step.value}</span>}
                    </div>
                  </div>
                  {pct <= 15 && <span className="text-[10px] font-bold text-gray-600 w-6">{step.value}</span>}
                  <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
