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
  'Gestor responsable '?: string;
  'Gestor responsable'?: string;
  'Link DI'?: string;
  Link?: string;
  Prioridad?: string;
  PRIORIDAD?: string;
  'Fecha inicio revisión DI'?: string;
  'Fecha inicio revision DI'?: string;
  'Fecha fin corrección gestor'?: string;
  'Fecha fin corrección docente'?: string;
  'Estado de la revalidación DI'?: string;
  'Fin Gestor'?: string;
  'Fecha fin revisión DI'?: string;
  Semestre?: string | number;
  'Nombre electiva'?: string;
}

type TabId = 'pendientes' | 'aprobados' | 'devueltos';
type ActionId = 'inicio_revision' | 'aprobado' | 'devuelto';

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

const ESTADO_BADGE: Record<string, string> = {
  'En revisión':        'bg-orange-100 text-orange-700',
  'Enviado a revisión': 'bg-blue-100 text-blue-700',
  'Aprobado DI':        'bg-green-100 text-green-700',
  'Aprobado':           'bg-green-100 text-green-700',
  'Corrección':         'bg-red-100 text-red-700',
};

export default function DIPage() {
  const { data: session } = useSession();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('pendientes');
  const [nivelFilter, setNivelFilter] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterModalidad, setFilterModalidad] = useState('');
  const [filterSemestre, setFilterSemestre] = useState('');
  const [search, setSearch] = useState('');
  const [pendingAction, setPendingAction] = useState<{ curso: Curso; actionId: ActionId; obs: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState<{ id: string; type: 'success' | 'error'; text: string }[]>([]);

  const load = async () => {
    const res = await fetch(api('/api/my-courses')).then(r => r.json());
    setCursos(res.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    const interval = setInterval(load, 60_000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, []);

  const handleDirectAction = async (curso: Curso, actionId: ActionId) => {
    setSaving(true);
    try {
      const res = await fetch(api('/api/update'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rol: 'Diseñador Instruccional',
          responsable: session?.user?.name || '',
          nivel: curso._nivel,
          programa: curso._programa,
          curso: curso.Asignatura,
          estadoId: actionId,
          observaciones: '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages(m => [...m, { id: Date.now().toString(), type: 'success', text: `Revisión iniciada: "${curso.Asignatura}"` }]);
      await load();
    } catch (err) {
      setMessages(m => [...m, { id: Date.now().toString(), type: 'error', text: err instanceof Error ? err.message : 'Error al iniciar revisión' }]);
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async () => {
    if (!pendingAction) return;
    const { curso, actionId } = pendingAction;
    setSaving(true);
    try {
      const res = await fetch(api('/api/update'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rol: 'Diseñador Instruccional',
          responsable: session?.user?.name || '',
          nivel: curso._nivel,
          programa: curso._programa,
          curso: curso.Asignatura,
          estadoId: actionId,
          observaciones: pendingAction.obs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const label = actionId === 'aprobado' ? 'Aprobado' : actionId === 'devuelto' ? 'Devuelto' : 'Revisión iniciada';
      setMessages(m => [...m, { id: Date.now().toString(), type: 'success', text: `${label}: "${curso.Asignatura}"` }]);
      setPendingAction(null);
      await load();
    } catch (err) {
      setMessages(m => [...m, { id: Date.now().toString(), type: 'error', text: err instanceof Error ? err.message : 'Error' }]);
    } finally {
      setSaving(false);
    }
  };

  const gestor = (c: Curso) => String(c['Gestor responsable '] ?? c['Gestor responsable'] ?? '—').trim();
  const getLinkDI = (c: Curso) => String(c['Link DI'] ?? '').trim();
  const getLinkGC = (c: Curso) => String(c['Link'] ?? '').trim();

  function isPriority(c: Curso): boolean {
    const val = String(c['Prioridad'] ?? c['PRIORIDAD'] ?? '').trim();
    return val !== '' && val !== '0' && val.toUpperCase() !== 'NO' && val !== 'null';
  }

  function sortByDate(list: Curso[], getDate: (c: Curso) => Date | null): Curso[] {
    return [...list].sort((a, b) => {
      const pa = isPriority(a) ? 0 : 1;
      const pb = isPriority(b) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (getDate(b)?.getTime() ?? -Infinity) - (getDate(a)?.getTime() ?? -Infinity);
    });
  }

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const cursosNivel = cursos
    .filter(c => !nivelFilter || c._nivel === nivelFilter)
    .filter(c => !filterModalidad || String(c._modalidad ?? '').trim() === filterModalidad)
    .filter(c => !filterSemestre || String(c.Semestre ?? '').trim() === filterSemestre)
    .filter(c => {
      if (!search) return true;
      const q = norm(search);
      return norm(c.Asignatura ?? '').includes(q) || norm(c._programa ?? '').includes(q);
    });
  const modalidades = [...new Set(cursos.map(c => String(c._modalidad ?? '')).filter(Boolean))].sort();
  const semestres = [...new Set(cursos.map(c => String(c.Semestre ?? '')).filter(s => !!s && s !== 'null'))].sort((a, b) => (+a || 0) - (+b || 0));
  const pendientes = sortByDate(cursosNivel.filter(c => {
    const estado = String(c.Estado ?? '').trim();
    const revalidacion = String(c['Estado de la revalidación DI'] ?? '').trim();
    return (estado === 'En revisión' || estado === 'Enviado a revisión') && revalidacion !== 'En revalidación';
  }), c => parseDate(c['Fin Gestor']));
  const aprobados = sortByDate(cursosNivel.filter(c => { const e = String(c.Estado ?? '').trim(); return e === 'Aprobado DI' || e === 'Aprobado'; }), c => parseDate(c['Fecha fin revisión DI']));
  const devueltos = sortByDate(cursosNivel.filter(c => {
    const estado = String(c.Estado ?? '').trim();
    const revalidacion = String(c['Estado de la revalidación DI'] ?? '').trim();
    return estado === 'Corrección' || revalidacion === 'En revalidación';
  }), c => parseDate(c['Fecha fin revisión DI']));

  const tabs: { id: TabId; label: string; count: number; color: string; activeColor: string }[] = [
    { id: 'pendientes', label: 'Pendientes', count: pendientes.length, color: 'bg-orange-100 text-orange-700', activeColor: 'border-violet-600 text-violet-600' },
    { id: 'aprobados', label: 'Aprobados', count: aprobados.length, color: 'bg-green-100 text-green-700', activeColor: 'border-green-500 text-green-600' },
    { id: 'devueltos', label: 'Devueltos', count: devueltos.length, color: 'bg-red-100 text-red-700', activeColor: 'border-red-500 text-red-600' },
  ];

  const rawList = activeTab === 'pendientes' ? pendientes : activeTab === 'aprobados' ? aprobados : devueltos;
  const currentList = filterEstado ? rawList.filter(c => String(c.Estado ?? '').trim() === filterEstado) : rawList;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Mis cursos</h1>
              <p className="text-xs text-gray-500">{session?.user?.name} · Diseñador Instruccional</p>
            </div>
          </div>
          <button onClick={() => signOut({ callbackUrl: api('/login') })} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Cerrar sesión
          </button>
        </div>

        {/* Filters + Tabs */}
        <div className="max-w-5xl mx-auto px-4">
          {/* Search bar */}
          <div className="relative pt-2 pb-1">
            <svg className="absolute left-3 top-1/2 -translate-y-0.5 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por asignatura o programa..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>
          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <select
              value={nivelFilter}
              onChange={e => setNivelFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value="">Todos los niveles</option>
              <option value="Pregrado">Pregrado</option>
              <option value="Especializaciones">Especializaciones</option>
              <option value="Maestrías">Maestrías</option>
              <option value="Doctorado">Doctorado</option>
            </select>
            <select
              value={filterEstado}
              onChange={e => setFilterEstado(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value="">Todos los estados</option>
              {['En proceso', 'En revisión', 'Aprobado DI', 'Corrección', 'Cargado', 'Producido', 'No empezado'].map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
            <select
              value={filterModalidad}
              onChange={e => setFilterModalidad(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value="">Todas las modalidades</option>
              {modalidades.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              value={filterSemestre}
              onChange={e => setFilterSemestre(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value="">Todos los semestres</option>
              {semestres.map(s => <option key={s} value={s}>Semestre {s}</option>)}
            </select>
          </div>
          {/* Tabs */}
          <div className="flex gap-0 overflow-x-auto scrollbar-none -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id ? tab.activeColor : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Toasts */}
        <div className="space-y-2 mb-4">
          {messages.slice(-3).map(m => (
            <div key={m.id} className={`p-3 rounded-xl border text-sm flex items-center gap-2 ${m.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {m.text}
              <button onClick={() => setMessages(msgs => msgs.filter(x => x.id !== m.id))} className="ml-auto opacity-60 hover:opacity-100">&times;</button>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Cargando cursos...</div>
        ) : currentList.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-gray-500 text-sm">
              {activeTab === 'pendientes' && 'No hay cursos pendientes de revisión.'}
              {activeTab === 'aprobados' && 'No has aprobado cursos aún.'}
              {activeTab === 'devueltos' && 'No hay cursos devueltos.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="grid gap-0 text-xs font-semibold text-gray-500 uppercase px-5 py-3 border-b border-gray-100 bg-gray-50 grid-cols-[1fr_1fr_2fr_auto]">
              <span>Nivel</span>
              <span>Programa</span>
              <span>Asignatura</span>
              <span>{activeTab === 'aprobados' ? 'Estado' : 'Acciones'}</span>
            </div>
            {currentList.map((c, i) => {
              const estado = String(c.Estado ?? '').trim();
              const estadoCurso = String(c['Estado curso'] ?? '').trim();
              const revalidacion = String(c['Estado de la revalidación DI'] ?? '').trim();
              const fechaCorreccion = String(c['Fecha fin corrección gestor'] ?? c['Fecha fin corrección docente'] ?? '').trim();
              return (
                <div key={i} className="grid gap-0 items-center px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 grid-cols-[1fr_1fr_2fr_auto]">
                  <span className="text-sm text-gray-500">{c._nivel}</span>
                  <div className="min-w-0 pr-4">
                    <p className="text-sm text-gray-600 truncate">{c._programa}</p>
                    {c._modalidad && <p className="text-xs text-gray-400 truncate italic">{c._modalidad}</p>}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {isPriority(c) && <span className="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded bg-red-500 text-white uppercase tracking-wide">Prioridad</span>}
                      <p className="text-sm font-medium text-gray-900">{c.Asignatura}</p>
                      {(() => { const ne = String(c['Nombre electiva'] ?? '').trim(); return ne && ne.toLowerCase() !== 'no aplica' ? <p className="text-xs text-indigo-500 mt-0.5">{ne}</p> : null; })()}
                      </div>
                    <p className="text-xs text-gray-400 mt-0.5">Gestor: {gestor(c)}</p>
                    <div className="flex gap-3 mt-1">
                      {getLinkDI(c) && (
                        <a href={getLinkDI(c)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          Enlace DI
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Pendientes: botones inicio revisión o aprobar/devolver */}
                  {activeTab === 'pendientes' && (() => {
                    const iniciado = !!(
                      String(c['Fecha inicio revisión DI'] ?? c['Fecha inicio revision DI'] ?? '').trim()
                    );
                    return iniciado ? (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleDirectAction(c, 'aprobado')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          Aprobar
                        </button>
                        <button
                          onClick={() => setPendingAction({ curso: c, actionId: 'devuelto', obs: '' })}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                          Devolver
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDirectAction(c, 'inicio_revision')}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition shrink-0 disabled:opacity-60"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Iniciar revisión
                      </button>
                    );
                  })()}

                  {/* Aprobados: badge de estado */}
                  {activeTab === 'aprobados' && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap w-fit ${ESTADO_BADGE[estado] || 'bg-gray-100 text-gray-600'}`}>
                      {estado === 'Aprobado DI' ? 'Aprobado' : estado}
                    </span>
                  )}

                  {/* Devueltos: botones si gestor ya corrigió, badge si aún espera */}
                  {activeTab === 'devueltos' && (
                    revalidacion === 'En revalidación' && !!fechaCorreccion ? (
                      <div className="flex gap-2 shrink-0">
                        <span className="self-center text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full mr-1">Revalidación</span>
                        <button
                          onClick={() => handleDirectAction(c, 'aprobado')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          Aprobar
                        </button>
                        <button
                          onClick={() => setPendingAction({ curso: c, actionId: 'devuelto', obs: '' })}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                          Devolver
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap w-fit bg-red-100 text-red-700">
                        {estadoCurso === 'Corrección' || estado === 'Corrección' ? 'Esperando gestor' : estado}
                      </span>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Confirm modal */}
      {pendingAction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full">
            <h3 className="font-bold text-gray-900 text-base mb-2">
              {pendingAction.actionId === 'aprobado' ? 'Aprobar curso' :
               pendingAction.actionId === 'devuelto' ? 'Devolver para corrección' :
               'Iniciar revisión'}
            </h3>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">{pendingAction.curso.Asignatura}</span>
            </p>
            <p className="text-xs text-gray-400 mb-4">{pendingAction.curso._nivel} · {pendingAction.curso._programa}</p>
            <div className="mb-5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Observaciones</label>
              <ObservacionesEditor
                value={pendingAction.obs}
                onChange={val => setPendingAction(p => p ? { ...p, obs: val } : p)}
                placeholder="Notas adicionales (opcional)..."
                ringColor="focus:ring-violet-500"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPendingAction(null)} className="flex-1 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button
                onClick={handleAction}
                disabled={saving}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl text-white transition disabled:opacity-60 ${
                  pendingAction.actionId === 'aprobado' ? 'bg-green-600 hover:bg-green-700' :
                  pendingAction.actionId === 'inicio_revision' ? 'bg-violet-600 hover:bg-violet-700' :
                  'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {saving ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
