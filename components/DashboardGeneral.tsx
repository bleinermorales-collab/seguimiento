'use client';

import { useMemo, useState } from 'react';

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
  'Nombre electiva'?: string;
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

function isCompletado(c: CourseRow): boolean {
  const e = String(c.Estado ?? '').trim();
  return e === 'Aprobado DI' || e === 'Producido' || e === 'Cargado';
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

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-col items-center text-center gap-0.5 shadow-sm">
      <p className="text-[11px] text-gray-500 font-medium leading-tight">{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p>
    </div>
  );
}

// ── Line chart (pure SVG, no deps) ────────────────────────────────────────────
function LineChart({ data, color = '#2563eb' }: { data: { label: string; value: number }[]; color?: string }) {
  if (!data.length) return <p className="text-xs text-gray-400 text-center py-8">Sin datos</p>;
  const W = 700; const H = 210; const PAD = { t: 30, r: 20, b: 48, l: 44 };
  const gW = W - PAD.l - PAD.r; const gH = H - PAD.t - PAD.b;
  const maxV = Math.max(...data.map(d => d.value), 1);
  const xs = data.map((_, i) => PAD.l + (gW / Math.max(data.length - 1, 1)) * i);
  const ys = data.map(d => PAD.t + gH - (d.value / maxV) * gH);
  const linePath = data.map((_, i) => `${i === 0 ? 'M' : 'L'}${xs[i].toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${xs[xs.length - 1].toFixed(1)},${(PAD.t + gH).toFixed(1)} L${PAD.l},${(PAD.t + gH).toFixed(1)} Z`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => ({ v: Math.round(r * maxV), y: PAD.t + gH - r * gH }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {yTicks.map(t => (
        <g key={t.v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="#f3f4f6" strokeWidth="1" />
          <text x={PAD.l - 6} y={t.y + 3.5} textAnchor="end" fontSize="8.5" fill="#9ca3af">{t.v}</text>
        </g>
      ))}
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#areaFill)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={i}>
          {d.value > 0 && (
            <text x={xs[i]} y={ys[i] - 8} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={color}>{d.value}</text>
          )}
          <circle cx={xs[i]} cy={ys[i]} r="3.5" fill="white" stroke={color} strokeWidth="2" />
          <text x={xs[i]} y={H - 8} textAnchor="middle" fontSize="7.5" fill="#6b7280">{d.label}</text>
        </g>
      ))}
    </svg>
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
  const [showPrioModal, setShowPrioModal] = useState(false);
  const [trendMode, setTrendMode] = useState<'semanal' | 'mensual'>('semanal');
  const [avanceModal, setAvanceModal] = useState<null | 'pendiente' | 'proceso' | 'aprobado' | 'cargado'>(null);
  const [avanceNivel, setAvanceNivel] = useState('');
  const [avanceSearch, setAvanceSearch] = useState('');
  const [nivelAvanceModal, setNivelAvanceModal] = useState<string | null>(null);
  const s = useMemo(() => {
    const total = courses.length;
    const aprobados = courses.filter(isAprobado).length;
    const aprobadosDI = courses.filter(c => String(c.Estado ?? '').trim() === 'Aprobado DI').length;
    const enProceso = courses.filter(c => String(c.Estado ?? '').trim() === 'En proceso').length;
    const enRevision = courses.filter(isEnRevision).length;
    const enCorreccion = courses.filter(c => String(c.Estado ?? '').trim() === 'Corrección').length;
    const noIniciados = courses.filter(isNoIniciado).length;
    const producidos = courses.filter(c => String(c.Estado ?? '').trim() === 'Producido').length;
    const cargados = courses.filter(c => String(c.Estado ?? '').trim() === 'Cargado').length;
    const devueltosCorreccion = courses.filter(c => String(c['Estado curso'] ?? '').trim() === 'Corrección').length;

    // Pipeline
    const asignados = courses.filter(c => !!getGestor(c)).length;
    const iniciados = courses.filter(c => !!parseDate(c['Inicio Gestor'])).length;
    const conDI = courses.filter(c => !!(c['DI responsable'] || '').toString().trim()).length;

    // Times
    const tAsigIni: number[] = [], tGestor: number[] = [], tFinDI: number[] = [], tRevDI: number[] = [], tCorr: number[] = [], tTotal: number[] = [];
    for (const c of courses) {
      const asig = parseDate(c['Fecha de asignación']);
      const ini = parseDate(c['Inicio Gestor']);
      const fin = parseDate(c['Fin Gestor']);
      const iniDI = parseDate(c['Fecha inicio revisión DI']);
      const finDI = parseDate(c['Fecha fin revisión DI']);
      const finCorr = parseDate(c['Fecha fin corrección gestor']);
      const hasVal = (v: unknown) => { const s = String(v ?? '').trim(); return !!s && s !== 'null' && s !== 'undefined' && s !== '0'; };
      const d1 = diffDays(asig, ini);    if (d1 !== null && d1 > 0 && d1 < 90 && hasVal(c['Fecha de asignación']) && hasVal(c['Inicio Gestor'])) tAsigIni.push(d1);
      const dg = diffDays(ini, fin);     if (dg !== null && dg >= 0 && dg < 365 && hasVal(c['Inicio Gestor']) && hasVal(c['Fin Gestor'])) tGestor.push(Math.max(1, dg));
      const d2 = diffDays(fin, iniDI);   if (d2 !== null && d2 > 0 && d2 < 90 && hasVal(c['Fin Gestor']) && hasVal(c['Fecha inicio revisión DI'])) tFinDI.push(d2);
      const d3 = diffDays(iniDI, finDI); if (d3 !== null && d3 >= 0 && d3 < 90 && hasVal(c['Fecha inicio revisión DI']) && hasVal(c['Fecha fin revisión DI'])) tRevDI.push(Math.max(1, d3));
      const d4 = diffDays(finDI, finCorr); if (d4 !== null && d4 > 0 && d4 < 90 && hasVal(c['Fecha fin revisión DI']) && hasVal(c['Fecha fin corrección gestor'])) tCorr.push(d4);
      const cicloStart = asig ?? ini;
      if (cicloStart && finDI && hasVal(c['Fecha fin revisión DI'])) { const tot = diffDays(cicloStart, finDI); if (tot !== null && tot > 0 && tot < 365) tTotal.push(tot); }
    }

    // Aprobaciones por mes (desde enero del año actual, solo Estado === 'Aprobado DI')
    const now = new Date();
    const currentYear = now.getFullYear();
    const numMonths = now.getMonth() + 1;
    const monthCounts = Array(numMonths).fill(0);
    const monthLabels: string[] = [];
    for (let m = 0; m < numMonths; m++) monthLabels.push(MONTHS_ES[m]);
    for (const c of courses) {
      if (String(c.Estado ?? '').trim() !== 'Aprobado DI') continue;
      const d = parseDate(c['Fecha fin revisión DI']);
      if (!d || d.getFullYear() !== currentYear) continue;
      const m = d.getMonth();
      if (m < numMonths) monthCounts[m]++;
    }

    // Tendencia mensual (valores reales por mes)
    const monthlyTrend: { label: string; value: number }[] = [];
    for (let m = 0; m < numMonths; m++) {
      monthlyTrend.push({ label: MONTHS_ES[m], value: monthCounts[m] });
    }

    // Tendencia semanal (valores reales por semana, año actual)
    const MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const getWeekOfYear = (d: Date): number =>
      Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / (7 * 86400000));
    const weekRangeLabel = (year: number, wk: number): string => {
      const jan1 = new Date(year, 0, 1);
      const start = new Date(jan1.getTime() + wk * 7 * 86400000);
      const end   = new Date(jan1.getTime() + wk * 7 * 86400000 + 6 * 86400000);
      const sd = start.getDate(), sm = MES_CORTO[start.getMonth()];
      const ed = end.getDate(),   em = MES_CORTO[end.getMonth()];
      return start.getMonth() === end.getMonth()
        ? `${sd}-${ed} ${sm}`
        : `${sd} ${sm}-${ed} ${em}`;
    };
    const currentWeek = getWeekOfYear(now);
    const weekBuckets: number[] = Array(currentWeek + 1).fill(0);
    for (const c of courses) {
      const e = String(c.Estado ?? '').trim();
      if (e !== 'Aprobado DI' && e !== 'Aprobado') continue;
      const d = parseDate(c['Fecha fin revisión DI']);
      if (!d || d.getFullYear() !== currentYear) continue;
      const wk = getWeekOfYear(d);
      if (wk >= 0 && wk <= currentWeek) weekBuckets[wk]++;
    }
    const firstNonZero = weekBuckets.findIndex(v => v > 0);
    const weeklyTrend: { label: string; value: number }[] = [];
    for (let i = firstNonZero; firstNonZero >= 0 && i <= currentWeek; i++) {
      weeklyTrend.push({ label: weekRangeLabel(currentYear, i), value: weekBuckets[i] });
    }

    // Nivel stats
    const nivelStats = NIVELES.map(n => {
      const nc = courses.filter(c => c._nivel === n);
      const aprobado = nc.filter(isAprobado).length;
      const enRevision = nc.filter(isEnRevision).length;
      const correccion = nc.filter(c => String(c.Estado ?? '').trim() === 'Corrección').length;
      const noIniciado = nc.filter(isNoIniciado).length;
      const total = nc.length;
      const enProceso = nc.filter(c => String(c.Estado ?? '').trim() === 'En proceso').length;
      const producido = nc.filter(c => String(c.Estado ?? '').trim() === 'Producido').length;
      const cargado   = nc.filter(c => String(c.Estado ?? '').trim() === 'Cargado').length;
      const revision  = enRevision + correccion;
      const noCategorizado = Math.max(0, total - noIniciado - enProceso - revision - aprobado - producido - cargado);
      return { nivel: n, total, noCategorizado, noIniciado, enProceso, revision, aprobado, producido, cargado, enRevision, correccion };
    });

    // Avance por nivel (consolidado) + desglose por programa
    const nivelAvance = NIVELES.map(n => {
      const nc = courses.filter(c => c._nivel === n);
      const total = nc.length;
      const completado = nc.filter(isCompletado).length;
      const pct = total > 0 ? Math.round(completado / total * 100) : 0;

      const programMap = new Map<string, { total: number; completado: number }>();
      for (const c of nc) {
        const prog = String(c._programa ?? '').trim() || 'Sin programa';
        const entry = programMap.get(prog) ?? { total: 0, completado: 0 };
        entry.total += 1;
        if (isCompletado(c)) entry.completado += 1;
        programMap.set(prog, entry);
      }
      const programas = Array.from(programMap.entries())
        .map(([programa, v]) => ({ programa, total: v.total, completado: v.completado, pct: v.total > 0 ? Math.round(v.completado / v.total * 100) : 0 }))
        .sort((a, b) => b.pct - a.pct);

      return { nivel: n, total, completado, pct, programas };
    });

    // Prioritarios
    const prioAll = courses.filter(isPriority);
    const prioAprobados = prioAll.filter(c => String(c.Estado ?? '').trim() === 'Aprobado DI').length;
    const prioRevision = prioAll.filter(isEnRevision).length;
    const prioCorreccion = prioAll.filter(c => String(c['Estado curso'] ?? '').trim() === 'Corrección').length;
    const prioNoIniciadosList = prioAll.filter(isNoIniciado);
    const prioNoIniciados = prioNoIniciadosList.length;

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
    const enviadosDia = (recentEnviados / 30).toFixed(1);
    const isAprobadoCurso = (c: CourseRow) => String(c['Estado curso'] ?? '').trim() === 'Aprobado';
    const approvedCount = courses.filter(isAprobadoCurso).length;
    const approvedDirect = courses.filter(c => isAprobadoCurso(c) && !parseDate(c['Fecha fin corrección gestor'])).length;
    const tasaDirecta = approvedCount > 0 ? Math.round((approvedDirect / approvedCount) * 100) : 0;

    return {
      total, aprobados, aprobadosDI, enProceso, enRevision, enCorreccion, noIniciados, producidos, cargados, devueltosCorreccion,
      asignados, iniciados, conDI,
      tAsigIni: avg(tAsigIni).toFixed(1),
      tGestor: avg(tGestor).toFixed(1),
      tFinDI: avg(tFinDI).toFixed(1),
      tRevDI: avg(tRevDI).toFixed(1),
      tCorr: avg(tCorr).toFixed(1),
      tTotal: avg(tTotal).toFixed(1),
      monthCounts, monthLabels, monthlyTrend, weeklyTrend,
      nivelStats,
      nivelAvance,
      prioAll: prioAll.length, prioAprobados, prioRevision, prioCorreccion, prioNoIniciados, prioNoIniciadosList,
      prioByNivel,
      aprobadosSemana, aprobadosDia, tasaDirecta, enviadosSemana, enviadosDia,

      // Metodología: por modalidad, desglosado por etapa del flujo
      metodologia: (() => {
        const map: Record<string, { noIniciado: number; enTramite: number; producidoCargado: number }> = {};
        for (const c of courses) {
          const mod = String(c._modalidad ?? '—').trim() || '—';
          if (!map[mod]) map[mod] = { noIniciado: 0, enTramite: 0, producidoCargado: 0 };
          const e = String(c.Estado ?? '').trim();
          if (e === 'Cargado' || e === 'Producido') map[mod].producidoCargado++;
          else if (e === 'Aprobado DI' || e === 'En proceso' || isEnRevision(c)) map[mod].enTramite++;
          else map[mod].noIniciado++;
        }
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
          .map(([mod, v]) => ({ mod, ...v, total: v.noIniciado + v.enTramite + v.producidoCargado }));
      })(),
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
    { color: '#dc2626', value: s.noIniciados },
    { color: '#f59e0b', value: s.enProceso },
    { color: '#2563eb', value: s.enRevision },
    { color: '#16a34a', value: s.aprobadosDI },
    { color: '#9333ea', value: s.producidos },
    { color: '#0891b2', value: s.cargados },
  ];

  return (
    <>
    <div className="bg-gray-50 rounded-2xl p-5 space-y-4">

      {/* ── KPIs ── */}
      <div className="grid grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard label="Total cursos"   value={s.total}        color="#111827" />
        <KpiCard label="No iniciados"   value={s.noIniciados}  color="#dc2626" />
        <KpiCard label="En proceso"     value={s.enProceso}    color="#f59e0b" />
        <KpiCard label="En revisión"    value={s.enRevision}   color="#2563eb" />
        <KpiCard label="Aprobados"      value={s.aprobadosDI} color="#16a34a" />
        <KpiCard label="Producidos"     value={s.producidos}   color="#9333ea" />
        <KpiCard label="Cargados"       value={s.cargados}     color="#0891b2" />
      </div>

      {/* ── Row 2: Avance general | Vista rápida | Aprobaciones ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Avance general */}
        <Card title="Avance general">
          <div className="grid grid-cols-2 gap-4">
            {([
              { key: 'pendiente', label: 'Pendiente',  desc: 'No iniciados',               pct: s.total > 0 ? Math.round(s.noIniciados / s.total * 100) : 0,                      color: '#dc2626', track: '#fee2e2', val: s.noIniciados },
              { key: 'proceso',   label: 'En virtualización', desc: 'En proceso + en revisión',    pct: s.total > 0 ? Math.round((s.enProceso + s.enRevision) / s.total * 100) : 0,   color: '#2563eb', track: '#dbeafe', val: s.enProceso + s.enRevision },
              { key: 'aprobado',  label: 'Aprobado',   desc: 'Aprobados + Producidos',      pct: s.total > 0 ? Math.round((s.aprobadosDI + s.producidos) / s.total * 100) : 0,        color: '#16a34a', track: '#dcfce7', val: s.aprobadosDI + s.producidos },
              { key: 'cargado',   label: 'Cargado',    desc: 'Cargados al LMS',             pct: s.total > 0 ? Math.round(s.cargados / s.total * 100) : 0,                         color: '#0891b2', track: '#cffafe', val: s.cargados },
            ] as { key: 'pendiente'|'proceso'|'aprobado'|'cargado'; label: string; desc: string; pct: number; color: string; track: string; val: number }[]).map(m => {
              const r = 36, cx = 46, cy = 46;
              const circ = 2 * Math.PI * r;
              const dash = (m.pct / 100) * circ;
              return (
                <div key={m.key} className="flex flex-col items-center text-center gap-2">
                  <svg width="92" height="92">
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={m.track} strokeWidth="8" />
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={m.color} strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${dash} ${circ}`}
                      style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }} />
                    <text x={cx} y={cy + 5} textAnchor="middle" fontSize="15" fontWeight="bold" fill={m.color}>{m.pct}%</text>
                  </svg>
                  <p className="text-xs font-bold text-gray-800 leading-tight">{m.label}</p>
                  <p className="text-sm font-bold leading-none" style={{ color: m.color }}>{m.val.toLocaleString('es-CO')}</p>
                  <p className="text-[10px] text-gray-400 leading-tight">{m.desc}</p>
                  <button
                    onClick={() => { setAvanceModal(m.key); setAvanceNivel(''); setAvanceSearch(''); }}
                    className="text-[10px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                  >Ver lista</button>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Vista rápida */}
        <Card title="Vista rápida">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
              <p className="text-2xl font-bold text-orange-600">{s.enviadosDia}</p>
              <p className="text-[10px] text-gray-500 mt-1 leading-tight">Enviados a revisión<br />por día (prom.)</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
              <p className="text-2xl font-bold text-green-600">{s.aprobadosDia}</p>
              <p className="text-[10px] text-gray-500 mt-1 leading-tight">Aprobados<br />por día (prom.)</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
              <p className="text-2xl font-bold text-violet-600">{s.enviadosSemana}</p>
              <p className="text-[10px] text-gray-500 mt-1 leading-tight">Enviados a<br />revisión/semana</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
              <p className="text-2xl font-bold text-cyan-600">{s.aprobadosSemana}</p>
              <p className="text-[10px] text-gray-500 mt-1 leading-tight">Aprobados<br />por semana</p>
            </div>
            <div className="col-span-2 bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
              <p className="text-2xl font-bold text-indigo-600">{s.tasaDirecta}%</p>
              <p className="text-[10px] text-gray-500 mt-1 leading-tight">Tasa aprobación directa</p>
            </div>
          </div>

          {/* Donut */}
          <div className="flex items-center justify-center gap-4">
            <DonutChart segs={donutSegs} total={s.total} />
            <div className="space-y-1 text-[10px]">
              {[
                { color: '#dc2626', label: 'No iniciados', val: s.noIniciados },
                { color: '#f59e0b', label: 'En proceso',   val: s.enProceso },
                { color: '#2563eb', label: 'En revisión',  val: s.enRevision },
                { color: '#16a34a', label: 'Aprobados',    val: s.aprobadosDI },
                { color: '#9333ea', label: 'Producidos',   val: s.producidos },
                { color: '#0891b2', label: 'Cargados',     val: s.cargados },
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
              { label: 'Duración virtualización',     val: s.tGestor,  color: '#0891b2' },
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

          {/* Tasa de corrección */}
          {(() => {
            const base = s.aprobadosDI + s.producidos + s.cargados;
            const pct = base > 0 ? Math.round(s.devueltosCorreccion / base * 100) : 0;
            return (
              <div className="bg-gray-50 rounded-lg p-3 mt-4 border border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-500 leading-tight">Cursos devueltos a corrección</p>
                  <p className="text-[10px] text-gray-400 leading-tight">sobre Aprobados + Producidos + Cargados</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-orange-600 leading-none">{s.devueltosCorreccion}</p>
                  <p className="text-[11px] font-bold text-orange-500 mt-0.5">{pct}%</p>
                </div>
              </div>
            );
          })()}
        </Card>
      </div>

      {/* ── Distribución por nivel y estado (fila completa) ── */}
      <Card title="Distribución por nivel y estado">
        {/* Tabla detallada */}
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-gray-500 font-semibold pb-2 pr-4">Nivel</th>
                <th className="text-right text-gray-700 font-semibold pb-2 px-3">Total</th>
                <th className="text-right font-semibold pb-2 px-3" style={{ color: '#9ca3af' }}>No categ.</th>
                <th className="text-right text-gray-700 font-semibold pb-2 px-3">No iniciado</th>
                <th className="text-right font-semibold pb-2 px-3" style={{ color: '#f59e0b' }}>En proceso</th>
                <th className="text-right font-semibold pb-2 px-3" style={{ color: '#3b82f6' }}>Revisión</th>
                <th className="text-right font-semibold pb-2 px-3" style={{ color: '#16a34a' }}>Aprobado</th>
                <th className="text-right font-semibold pb-2 px-3" style={{ color: '#7c3aed' }}>Producido</th>
                <th className="text-right font-semibold pb-2 pl-3" style={{ color: '#0891b2' }}>Cargado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {s.nivelStats.map(n => (
                <tr key={n.nivel} className="hover:bg-gray-50/60">
                  <td className="py-2 pr-4 text-gray-700 font-medium">{n.nivel}</td>
                  <td className="py-2 px-3 text-right font-bold text-gray-900">{n.total}</td>
                  <td className="py-2 px-3 text-right font-bold" style={{ color: '#9ca3af' }}>{n.noCategorizado}</td>
                  <td className="py-2 px-3 text-right font-bold text-gray-700">{n.noIniciado}</td>
                  <td className="py-2 px-3 text-right font-bold" style={{ color: '#f59e0b' }}>{n.enProceso}</td>
                  <td className="py-2 px-3 text-right font-bold" style={{ color: '#3b82f6' }}>{n.revision}</td>
                  <td className="py-2 px-3 text-right font-bold" style={{ color: '#16a34a' }}>{n.aprobado}</td>
                  <td className="py-2 px-3 text-right font-bold" style={{ color: '#7c3aed' }}>{n.producido}</td>
                  <td className="py-2 pl-3 text-right font-bold" style={{ color: '#0891b2' }}>{n.cargado}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td className="py-2 pr-4 font-bold text-gray-900">Total</td>
                <td className="py-2 px-3 text-right font-bold text-gray-900">{s.total}</td>
                <td className="py-2 px-3 text-right font-bold" style={{ color: '#9ca3af' }}>{s.nivelStats.reduce((a,n) => a+n.noCategorizado, 0)}</td>
                <td className="py-2 px-3 text-right font-bold text-gray-700">{s.nivelStats.reduce((a,n) => a+n.noIniciado, 0)}</td>
                <td className="py-2 px-3 text-right font-bold" style={{ color: '#f59e0b' }}>{s.nivelStats.reduce((a,n) => a+n.enProceso, 0)}</td>
                <td className="py-2 px-3 text-right font-bold" style={{ color: '#3b82f6' }}>{s.nivelStats.reduce((a,n) => a+n.revision, 0)}</td>
                <td className="py-2 px-3 text-right font-bold" style={{ color: '#16a34a' }}>{s.nivelStats.reduce((a,n) => a+n.aprobado, 0)}</td>
                <td className="py-2 px-3 text-right font-bold" style={{ color: '#7c3aed' }}>{s.nivelStats.reduce((a,n) => a+n.producido, 0)}</td>
                <td className="py-2 pl-3 text-right font-bold" style={{ color: '#0891b2' }}>{s.nivelStats.reduce((a,n) => a+n.cargado, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

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
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-red-600">
                {s.prioNoIniciados} prioritario{s.prioNoIniciados > 1 ? 's' : ''} sin iniciar — requieren atención inmediata
              </span>
              <button
                onClick={() => setShowPrioModal(true)}
                className="shrink-0 text-[11px] font-semibold text-red-700 bg-red-100 hover:bg-red-200 border border-red-300 rounded-md px-2.5 py-1 transition"
              >
                Ver lista
              </button>
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
            <div className="grid grid-cols-2 gap-2">
              {s.nivelAvance.map(n => (
                <button
                  key={n.nivel}
                  onClick={() => setNivelAvanceModal(n.nivel)}
                  className="text-left bg-gray-50 hover:bg-gray-100 transition rounded-lg p-3 border border-gray-100"
                >
                  <p className="text-[10px] font-semibold" style={{ color: NIVEL_COLORS[n.nivel] }}>{NIVEL_SHORT[n.nivel]}</p>
                  <p className="text-xl font-bold mt-0.5" style={{ color: NIVEL_COLORS[n.nivel] }}>{n.pct}%</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{n.completado}/{n.total} completados</p>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Metodología */}
        {(() => {
          const data = s.metodologia;
          const maxTotal = Math.max(...data.map(d => d.total), 1);
          const W = 340; const H = 200;
          const PAD = { t: 20, r: 16, b: 44, l: 44 };
          const gW = W - PAD.l - PAD.r; const gH = H - PAD.t - PAD.b;
          const n = data.length;
          const barW = Math.min(48, (gW / Math.max(n, 1)) * 0.6);
          const gap   = gW / Math.max(n, 1);
          const barX  = (i: number) => PAD.l + gap * i + (gap - barW) / 2;
          const yScale = (v: number) => (v / maxTotal) * gH;
          const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => ({ v: Math.round(r * maxTotal), y: PAD.t + gH - r * gH }));
          const SEGS = [
            { key: 'noIniciado'       as const, color: '#dc2626', label: 'No iniciado' },
            { key: 'enTramite'        as const, color: '#2563eb', label: 'En proceso / revisión / aprobado' },
            { key: 'producidoCargado' as const, color: '#0891b2', label: 'Producido / cargado' },
          ];
          return (
            <Card title="Metodología">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                {yTicks.map(t => (
                  <g key={t.v}>
                    <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="#f3f4f6" strokeWidth="1" />
                    <text x={PAD.l - 5} y={t.y + 3.5} textAnchor="end" fontSize="8" fill="#9ca3af">{t.v}</text>
                  </g>
                ))}
                {data.map((d, i) => {
                  const x = barX(i);
                  let yTop = PAD.t + gH;
                  return (
                    <g key={d.mod}>
                      {SEGS.map(seg => {
                        const h = yScale(d[seg.key]);
                        yTop -= h;
                        return h > 0 ? (
                          <g key={seg.key}>
                            <rect x={x} y={yTop} width={barW} height={h} fill={seg.color} rx="2" />
                            {h > 14 && (
                              <text x={x + barW / 2} y={yTop + h / 2 + 3.5} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="white">{d[seg.key]}</text>
                            )}
                          </g>
                        ) : null;
                      })}
                      <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="8.5" fill="#374151" fontWeight="600">{d.mod}</text>
                    </g>
                  );
                })}
              </svg>
              <div className="flex gap-4 mt-1 flex-wrap justify-center">
                {SEGS.map(s => (
                  <div key={s.key} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                    <span className="text-[10px] text-gray-500">{s.label}</span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })()}
      </div>
    </div>

      {/* Tendencia de aprobaciones */}
      <div className="mt-4">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tendencia de aprobaciones</p>
            <div className="flex gap-1">
              {(['semanal', 'mensual'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setTrendMode(m)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${trendMode === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <LineChart
            data={trendMode === 'semanal' ? s.weeklyTrend.slice(-12) : s.monthlyTrend}
            color="#2563eb"
          />
          <p className="text-[10px] text-gray-400 text-center mt-1">
            {trendMode === 'semanal' ? 'Cursos aprobados por semana' : 'Cursos aprobados por mes'}
          </p>
        </Card>
      </div>

      {/* Modal: avance general — listado por programa */}
      {avanceModal && (() => {
        const MODAL_TITLES: Record<string, string> = {
          pendiente: 'Cursos pendientes de iniciar',
          proceso:   'Cursos en virtualización (en proceso + en revisión)',
          aprobado:  'Cursos aprobados y producidos',
          cargado:   'Cursos cargados',
        };
        const NIVELES_FILTER = ['Pregrado', 'Especializaciones', 'Maestrías', 'Doctorado'];
        const filtered = courses.filter(c => {
          const e = String(c.Estado ?? '').trim();
          const match =
            avanceModal === 'pendiente' ? isNoIniciado(c) :
            avanceModal === 'proceso'   ? (e === 'En proceso' || isEnRevision(c)) :
            avanceModal === 'aprobado'  ? (e === 'Aprobado DI' || e === 'Producido') :
            e === 'Cargado';
          if (!match) return false;
          if (avanceNivel && c._nivel !== avanceNivel) return false;
          if (avanceSearch) {
            const q = avanceSearch.toLowerCase();
            const asig = String(c.Asignatura ?? '').toLowerCase();
            const prog = String(c._programa ?? '').toLowerCase();
            if (!asig.includes(q) && !prog.includes(q)) return false;
          }
          return true;
        });
        const byPrograma: Record<string, typeof filtered> = {};
        for (const c of filtered) {
          const p = String(c._programa ?? '—').trim();
          if (!byPrograma[p]) byPrograma[p] = [];
          byPrograma[p].push(c);
        }
        const programas = Object.keys(byPrograma).sort();
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
            onClick={e => { if (e.target === e.currentTarget) setAvanceModal(null); }}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">{MODAL_TITLES[avanceModal]}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{filtered.length} curso{filtered.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setAvanceModal(null)} className="text-gray-400 hover:text-gray-600 transition">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="px-6 pt-3 pb-2 flex flex-col gap-2">
                {/* Filtro nivel */}
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={() => setAvanceNivel('')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition ${avanceNivel === '' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    Todos
                  </button>
                  {NIVELES_FILTER.map(n => (
                    <button key={n} onClick={() => setAvanceNivel(avanceNivel === n ? '' : n)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition ${avanceNivel === n ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {n}
                    </button>
                  ))}
                </div>
                {/* Buscador */}
                <input
                  type="text"
                  placeholder="Buscar asignatura o programa..."
                  value={avanceSearch}
                  onChange={e => setAvanceSearch(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
                />
              </div>
              <div className="overflow-y-auto flex-1 px-6 pb-4">
                {programas.length === 0
                  ? <p className="text-xs text-gray-400 text-center py-8">Sin resultados</p>
                  : programas.map(prog => (
                    <div key={prog} className="mb-4">
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 border-b border-gray-100 pb-1">{prog}</p>
                      <ul className="space-y-1">
                        {byPrograma[prog].map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <span className="text-gray-300 mt-0.5">•</span>
                            <span className="text-gray-800">{String(c.Asignatura ?? '—')}</span>
                            <span className="text-gray-400 ml-auto shrink-0">{c._nivel}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                }
              </div>
              <div className="px-6 py-3 border-t border-gray-100">
                <button onClick={() => setAvanceModal(null)}
                  className="w-full py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: avance por nivel — desglose por programa */}
      {nivelAvanceModal && (() => {
        const n = s.nivelAvance.find(x => x.nivel === nivelAvanceModal);
        if (!n) return null;
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
            onClick={e => { if (e.target === e.currentTarget) setNivelAvanceModal(null); }}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Avance por programa — {NIVEL_SHORT[n.nivel]}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{n.completado}/{n.total} cursos completados · {n.pct}%</p>
                </div>
                <button onClick={() => setNivelAvanceModal(null)} className="text-gray-400 hover:text-gray-600 transition">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-6 py-4">
                {n.programas.length === 0
                  ? <p className="text-xs text-gray-400 text-center py-8">Sin programas</p>
                  : (
                    <ul className="space-y-2.5">
                      {n.programas.map(p => (
                        <li key={p.programa} className="flex items-center gap-3">
                          <span className="text-xs text-gray-700 flex-1">{p.programa}</span>
                          <span className="text-[10px] text-gray-400 shrink-0">{p.completado}/{p.total}</span>
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden shrink-0">
                            <div className="h-full rounded-full" style={{ width: `${p.pct}%`, backgroundColor: NIVEL_COLORS[n.nivel] }} />
                          </div>
                          <span className="text-xs font-bold w-10 text-right shrink-0" style={{ color: NIVEL_COLORS[n.nivel] }}>{p.pct}%</span>
                        </li>
                      ))}
                    </ul>
                  )
                }
              </div>
              <div className="px-6 py-3 border-t border-gray-100">
                <button onClick={() => setNivelAvanceModal(null)}
                  className="w-full py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: prioritarios sin iniciar */}
      {showPrioModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={e => { if (e.target === e.currentTarget) setShowPrioModal(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Cursos prioritarios sin iniciar</h3>
                <p className="text-xs text-gray-400 mt-0.5">{s.prioNoIniciados} curso{s.prioNoIniciados !== 1 ? 's' : ''} requieren atención</p>
              </div>
              <button onClick={() => setShowPrioModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase px-4 py-2.5">Asignatura</th>
                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase px-4 py-2.5">Programa</th>
                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase px-4 py-2.5">Nivel</th>
                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase px-4 py-2.5">Modalidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {s.prioNoIniciadosList.map((c, i) => (
                    <tr key={i} className="hover:bg-red-50/30">
                      <td className="px-4 py-2.5 text-xs">
                        <span className="font-medium text-gray-900">{c.Asignatura}</span>
                        {(() => { const ne = String(c['Nombre electiva'] ?? '').trim(); return ne && ne.toLowerCase() !== 'no aplica' ? <p className="text-indigo-500 mt-0.5">{ne}</p> : null; })()}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{c._programa}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{c._nivel}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{c._modalidad || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-gray-100">
              <button onClick={() => setShowPrioModal(false)} className="w-full py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
