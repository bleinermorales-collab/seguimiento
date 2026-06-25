'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { api } from '@/lib/api';
import ObservacionesEditor from '@/components/ObservacionesEditor';

interface Curso {
  _nivel: string;
  _programa: string;
  _modalidad?: string;
  Asignatura: string;
  Estado?: string;
  'Estado curso'?: string;
  'Estado de la revalidación DI'?: string;
  Semestre?: string;
  Link?: string;
  'Link DI'?: string;
  'Link Gestor'?: string;
  'Gestor responsable '?: string;
  'Gestor responsable'?: string;
  'DI asignado'?: string;
  'DI responsable'?: string;
  'DI Responsable'?: string;
  'DI responsable '?: string;
  'Fin Gestor'?: string;
  'Fecha de asignación'?: string;
  'Fecha fin revisión DI'?: string;
}

type TabId = 'por_asignar' | 'asignados' | 'devueltos' | 'aprobados';

const ESTADO_BADGE: Record<string, string> = {
  'En revisión':        'bg-orange-100 text-orange-700',
  'Enviado a revisión': 'bg-blue-100 text-blue-700',
  'Corrección':         'bg-red-100 text-red-700',
  'Aprobado DI':        'bg-green-100 text-green-700',
  'Aprobado':           'bg-green-100 text-green-700',
};

function diActual(c: Curso): string {
  return String(c['DI asignado'] ?? c['DI responsable'] ?? c['DI Responsable'] ?? c['DI responsable '] ?? '').trim();
}
function gestorActual(c: Curso): string {
  return String(c['Gestor responsable '] ?? c['Gestor responsable'] ?? '').trim();
}
function linkDI(c: Curso): string {
  return String(c['Link DI'] ?? '').trim();
}
function linkGestor(c: Curso): string {
  return String(c['Link Gestor'] ?? c['Link'] ?? '').trim();
}
function parseDate(s: unknown): Date | null {
  if (!s) return null;
  if (s instanceof Date) return s;
  const str = String(s).trim();
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}
function diasDesde(d: Date | null): number | null {
  if (!d) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}
function diasBadge(dias: number | null): string {
  if (dias === null) return '—';
  if (dias === 0) return 'Hoy';
  return dias === 1 ? '1 día' : `${dias} días`;
}
function diasClass(dias: number | null): string {
  if (dias === null) return 'text-gray-300';
  if (dias <= 3)  return 'text-green-600 font-semibold';
  if (dias <= 10) return 'text-amber-600 font-semibold';
  if (dias <= 20) return 'text-orange-700 font-semibold';
  return 'text-red-700 font-semibold';
}

export default function CoordinadorDIPage() {
  const { data: session } = useSession();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('por_asignar');
  const [search, setSearch] = useState('');
  const [nivelFilter, setNivelFilter] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterModalidad, setFilterModalidad] = useState('');
  const [filterSemestre, setFilterSemestre] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [sendingReport, setSendingReport] = useState(false);
  const [reportMsg, setReportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [messages, setMessages] = useState<{ id: string; type: 'success' | 'error'; text: string }[]>([]);
  const [modal, setModal] = useState<{ curso: Curso; di: string; link: string; obs: string } | null>(null);

  useEffect(() => {
    fetch(api('/api/admin'))
      .then(r => r.json())
      .then(d => { setCursos(d.data || []); setLoading(false); });
  }, []);

  const key = (c: Curso) => `${c._nivel}::${c._programa}::${c.Asignatura}`;

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const applyFilters = (list: Curso[]) => list.filter(c => {
    if (nivelFilter && c._nivel !== nivelFilter) return false;
    if (filterEstado && String(c.Estado ?? '').trim() !== filterEstado) return false;
    if (filterModalidad && String(c._modalidad ?? '').trim() !== filterModalidad) return false;
    if (filterSemestre && String(c.Semestre ?? '').trim() !== filterSemestre) return false;
    const q = norm(search);
    if (q && !norm(c.Asignatura ?? '').includes(q) && !norm(c._programa ?? '').includes(q)) return false;
    return true;
  });
  const modalidades = [...new Set(cursos.map(c => String(c._modalidad ?? '')).filter(Boolean))].sort();
  const semestres = [...new Set(cursos.map(c => String(c.Semestre ?? '')).filter(s => !!s && s !== 'null'))].sort((a, b) => (+a || 0) - (+b || 0));

  const sortByDate = (list: Curso[], getDate: (c: Curso) => Date | null): Curso[] =>
    [...list].sort((a, b) => (getDate(a)?.getTime() ?? Infinity) - (getDate(b)?.getTime() ?? Infinity));
  const isParaRevisar = (c: Curso) => { const e = String(c.Estado ?? '').trim(); return e === 'En revisión' || e === 'Enviado a revisión'; };
  const isDevuelto = (c: Curso) => {
    const estado = String(c.Estado ?? '').trim();
    if (estado === 'Aprobado DI' || estado === 'Aprobado') return false;
    const estadoCurso = String(c['Estado curso'] ?? '').trim();
    const revalidacion = String(c['Estado de la revalidación DI'] ?? '').trim();
    return estado === 'Corrección' || (estadoCurso === 'Corrección' && revalidacion === 'En revalidación');
  };
  const enRevision = cursos.filter(isParaRevisar);
  const porAsignar = sortByDate(applyFilters(enRevision.filter(c => !diActual(c))), c => parseDate(c['Fin Gestor']));
  const asignados  = sortByDate(applyFilters(enRevision.filter(c => !!diActual(c))), c => parseDate(c['Fecha de asignación']));
  const devueltos  = sortByDate(applyFilters(cursos.filter(isDevuelto)), c => parseDate(c['Fecha fin revisión DI']));
  const aprobados  = sortByDate(applyFilters(cursos.filter(c => {
    const e = String(c.Estado ?? '').trim();
    return e === 'Aprobado DI' || e === 'Aprobado';
  })), c => parseDate(c['Fecha fin revisión DI']));

  const porAsignarTotal = enRevision.filter(c => !diActual(c)).length;
  const asignadosTotal = enRevision.filter(c => !!diActual(c)).length;
  const devueltosTotal = cursos.filter(isDevuelto).length;
  const aprobadosTotal = cursos.filter(c => { const e = String(c.Estado ?? '').trim(); return e === 'Aprobado DI' || e === 'Aprobado'; }).length;

  const handleModalConfirm = async () => {
    if (!modal || !modal.di) return;
    const k = key(modal.curso);
    setSaving(k);
    try {
      const res = await fetch(api('/api/assign-di'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nivel: modal.curso._nivel,
          programa: modal.curso._programa,
          curso: modal.curso.Asignatura,
          di: modal.di,
          link: modal.link,
          observaciones: modal.obs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCursos(prev => prev.map(c =>
        key(c) === k ? { ...c, 'DI asignado': modal.di, 'Link DI': modal.link || c['Link DI'] } : c
      ));
      const action = diActual(modal.curso) ? 'Reasignado' : 'Asignado';
      setMessages(m => [...m, { id: Date.now().toString(), type: 'success', text: `${action} "${modal.curso.Asignatura}" → ${modal.di}` }]);
      setModal(null);
    } catch (err) {
      setMessages(m => [...m, { id: Date.now().toString(), type: 'error', text: err instanceof Error ? err.message : 'Error' }]);
    } finally {
      setSaving(null);
    }
  };

  const niveles = ['Pregrado', 'Especializaciones', 'Maestrías', 'Doctorado'];
  const [dis, setDis] = useState<string[]>([]);
  useEffect(() => {
    fetch(api('/api/data?type=dis')).then(r => r.json()).then(d => setDis(d.data || []));
  }, []);

  const tabs: { id: TabId; label: string; count: number; color: string; activeColor: string }[] = [
    { id: 'por_asignar', label: 'Por asignar', count: porAsignarTotal, color: 'bg-orange-100 text-orange-700', activeColor: 'border-orange-500 text-orange-600' },
    { id: 'asignados', label: 'Asignados', count: asignadosTotal, color: 'bg-blue-100 text-blue-700', activeColor: 'border-blue-500 text-blue-600' },
    { id: 'devueltos', label: 'Devueltos', count: devueltosTotal, color: 'bg-red-100 text-red-700', activeColor: 'border-red-500 text-red-600' },
    { id: 'aprobados', label: 'Aprobados', count: aprobadosTotal, color: 'bg-green-100 text-green-700', activeColor: 'border-green-500 text-green-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Coordinación DI</h1>
              <p className="text-xs text-gray-500">{session?.user?.name} · Coordinador de Diseño Instruccional</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {reportMsg && (
              <span className={`text-xs px-2 py-1 rounded-lg font-medium ${reportMsg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {reportMsg.text}
              </span>
            )}
            <button
              onClick={async () => {
                setSendingReport(true);
                setReportMsg(null);
                try {
                  const res = await fetch(api('/api/report/approved'), { method: 'POST' });
                  const d = await res.json();
                  if (!res.ok) throw new Error(d.error);
                  if (d.count === 0) {
                    setReportMsg({ type: 'success', text: 'Sin aprobaciones hoy.' });
                  } else if (!d.ok) {
                    setReportMsg({ type: 'error', text: `${d.count} aprobados pero el correo falló: ${d.error || ''}` });
                  } else {
                    setReportMsg({ type: 'success', text: `Reporte enviado — ${d.count} cursos aprobados hoy.` });
                  }
                } catch (err) {
                  setReportMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error' });
                } finally {
                  setSendingReport(false);
                }
              }}
              disabled={sendingReport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {sendingReport ? 'Enviando...' : 'Reporte aprobados'}
            </button>
            <button onClick={() => signOut({ callbackUrl: api('/login') })} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-0 -mb-px overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? tab.activeColor
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === tab.id ? tab.color : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Por asignar', value: porAsignarTotal, color: 'text-orange-600' },
            { label: 'Asignados', value: asignadosTotal, color: 'text-blue-600' },
            { label: 'Devueltos', value: devueltosTotal, color: 'text-red-600' },
            { label: 'Aprobados', value: aprobadosTotal, color: 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Toasts */}
        <div className="space-y-2 mb-4">
          {messages.slice(-3).map(m => (
            <div key={m.id} className={`p-3 rounded-xl border text-sm flex items-center gap-2 ${m.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {m.text}
              <button onClick={() => setMessages(msgs => msgs.filter(x => x.id !== m.id))} className="ml-auto opacity-60 hover:opacity-100">&times;</button>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Buscar curso o programa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <select
            value={nivelFilter}
            onChange={e => setNivelFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          >
            <option value="">Todos los niveles</option>
            {niveles.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          >
            <option value="">Todos los estados</option>
            {['En proceso', 'En revisión', 'Aprobado DI', 'Corrección', 'Cargado', 'Producido', 'No empezado'].map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <select
            value={filterModalidad}
            onChange={e => setFilterModalidad(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          >
            <option value="">Todas las modalidades</option>
            {modalidades.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={filterSemestre}
            onChange={e => setFilterSemestre(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          >
            <option value="">Todos los semestres</option>
            {semestres.map(s => <option key={s} value={s}>Semestre {s}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Cargando cursos...</div>
        ) : (
          <>
            {/* TAB: POR ASIGNAR */}
            {activeTab === 'por_asignar' && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[700px]">
                    <div className="grid grid-cols-[65px_150px_1fr_130px_70px_110px] text-xs font-semibold text-gray-500 uppercase px-5 py-3 border-b border-gray-100 bg-gray-50 gap-3">
                      <span>Nivel</span>
                      <span>Programa</span>
                      <span>Asignatura</span>
                      <span>Gestor</span>
                      <span>Días</span>
                      <span>Acción</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {porAsignar.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">
                          No hay cursos en revisión pendientes de asignar DI.
                        </div>
                      ) : porAsignar.map((c, i) => {
                        const dPA = diasDesde(parseDate(c['Fin Gestor']));
                        return (
                          <div key={i} className="grid grid-cols-[65px_150px_1fr_130px_70px_110px] items-center gap-3 px-5 py-3 hover:bg-gray-50/50">
                            <span className="text-xs text-gray-400 truncate">{c._nivel}</span>
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500 truncate">{c._programa}</p>
                              {c._modalidad && <p className="text-xs text-gray-400 truncate italic">{c._modalidad}</p>}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{c.Asignatura}</p>
                              {linkGestor(c) && (
                                <a href={linkGestor(c)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-0.5" onClick={e => e.stopPropagation()}>
                                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                  Ver curso
                                </a>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 truncate">{gestorActual(c) || '—'}</span>
                            <span className={`text-xs ${diasClass(dPA)}`}>{diasBadge(dPA)}</span>
                            <button
                              onClick={() => setModal({ curso: c, di: diActual(c), link: linkDI(c), obs: '' })}
                              className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition"
                            >
                              Asignar
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: ASIGNADOS (en revisión con DI asignado) */}
            {activeTab === 'asignados' && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[750px]">
                    <div className="grid grid-cols-[65px_140px_1fr_130px_70px_150px_110px] text-xs font-semibold text-gray-500 uppercase px-5 py-3 border-b border-gray-100 bg-gray-50 gap-3">
                      <span>Nivel</span>
                      <span>Programa</span>
                      <span>Asignatura</span>
                      <span>Gestor</span>
                      <span>Días</span>
                      <span>DI asignado</span>
                      <span>Acción</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {asignados.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">
                          No hay cursos en revisión con DI asignado.
                        </div>
                      ) : asignados.map((c, i) => {
                        const dAS = diasDesde(parseDate(c['Fecha de asignación']));
                        return (
                          <div key={i} className="grid grid-cols-[65px_140px_1fr_130px_70px_150px_110px] items-center gap-3 px-5 py-3 hover:bg-gray-50/50">
                            <span className="text-xs text-gray-400 truncate">{c._nivel}</span>
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500 truncate">{c._programa}</p>
                              {c._modalidad && <p className="text-xs text-gray-400 truncate italic">{c._modalidad}</p>}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{c.Asignatura}</p>
                              {linkGestor(c) && (
                                <a href={linkGestor(c)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-0.5" onClick={e => e.stopPropagation()}>
                                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                  Ver curso
                                </a>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 truncate">{gestorActual(c) || '—'}</span>
                            <span className={`text-xs ${diasClass(dAS)}`}>{diasBadge(dAS)}</span>
                            <span className="text-xs font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full truncate border border-violet-200" title={diActual(c)}>
                              {diActual(c)}
                            </span>
                            <button
                              onClick={() => setModal({ curso: c, di: diActual(c), link: linkDI(c), obs: '' })}
                              className="px-3 py-1.5 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                            >
                              Reasignar
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: DEVUELTOS */}
            {activeTab === 'devueltos' && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[870px]">
                    <div className="grid grid-cols-[65px_150px_1fr_130px_70px_150px_100px] text-xs font-semibold text-gray-500 uppercase px-5 py-3 border-b border-gray-100 bg-gray-50 gap-3">
                      <span>Nivel</span>
                      <span>Programa</span>
                      <span>Asignatura</span>
                      <span>Gestor</span>
                      <span>Días</span>
                      <span>DI que devolvió</span>
                      <span>Estado</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {devueltos.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">
                          No hay cursos devueltos para corrección.
                        </div>
                      ) : devueltos.map((c, i) => {
                        const dDV = diasDesde(parseDate(c['Fecha fin revisión DI']));
                        return (
                        <div key={i} className="grid grid-cols-[65px_150px_1fr_130px_70px_150px_100px] items-center gap-3 px-5 py-3 hover:bg-gray-50/50">
                          <span className="text-xs text-gray-400 truncate">{c._nivel}</span>
                          <span className="text-xs text-gray-500 truncate">{c._programa}</span>
                          <span className="text-sm font-medium text-gray-900 truncate">{c.Asignatura}</span>
                          <span className="text-xs text-gray-500 truncate">{gestorActual(c) || '—'}</span>
                          <span className={`text-xs ${diasClass(dDV)}`}>{diasBadge(dDV)}</span>
                          <span className="text-xs text-gray-500 truncate">{diActual(c) || '—'}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Corrección</span>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: APROBADOS */}
            {activeTab === 'aprobados' && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[870px]">
                    <div className="grid grid-cols-[65px_150px_1fr_130px_70px_150px_100px] text-xs font-semibold text-gray-500 uppercase px-5 py-3 border-b border-gray-100 bg-gray-50 gap-3">
                      <span>Nivel</span>
                      <span>Programa</span>
                      <span>Asignatura</span>
                      <span>Gestor</span>
                      <span>Días</span>
                      <span>DI que aprobó</span>
                      <span>Estado</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {aprobados.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">
                          No hay cursos aprobados.
                        </div>
                      ) : aprobados.map((c, i) => {
                        const dAP = diasDesde(parseDate(c['Fecha fin revisión DI']));
                        return (
                        <div key={i} className="grid grid-cols-[65px_150px_1fr_130px_70px_150px_100px] items-center gap-3 px-5 py-3 hover:bg-gray-50/50">
                          <span className="text-xs text-gray-400 truncate">{c._nivel}</span>
                          <span className="text-xs text-gray-500 truncate">{c._programa}</span>
                          <span className="text-sm font-medium text-gray-900 truncate">{c.Asignatura}</span>
                          <span className="text-xs text-gray-500 truncate">{gestorActual(c) || '—'}</span>
                          <span className={`text-xs ${diasClass(dAP)}`}>{diasBadge(dAP)}</span>
                          <span className="text-xs text-gray-500 truncate">{diActual(c) || '—'}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Aprobado</span>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal asignación DI */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full">
            <h3 className="font-bold text-gray-900 text-base mb-1">
              {diActual(modal.curso) ? 'Reasignar DI' : 'Asignar DI'}
            </h3>
            <p className="text-sm font-semibold text-gray-800 mb-0.5 truncate">{modal.curso.Asignatura}</p>
            <p className="text-xs text-gray-400 mb-5">{modal.curso._nivel} · {modal.curso._programa}</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">DI a asignar *</label>
                <select
                  value={modal.di}
                  onChange={e => setModal(m => m ? { ...m, di: e.target.value } : m)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">Seleccionar DI...</option>
                  {dis.map((d: string) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Link para el DI</label>
                <input
                  type="url"
                  value={modal.link}
                  onChange={e => setModal(m => m ? { ...m, link: e.target.value } : m)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Observaciones</label>
                <ObservacionesEditor
                  value={modal.obs}
                  onChange={val => setModal(m => m ? { ...m, obs: val } : m)}
                  placeholder="Notas adicionales..."
                  ringColor="focus:ring-violet-500"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handleModalConfirm}
                disabled={!modal.di || saving === key(modal.curso)}
                className="flex-1 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving === key(modal.curso) ? 'Guardando...' : diActual(modal.curso) ? 'Reasignar' : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
