'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { ESTADOS_GESTOR } from '@/config/estados';
import { api } from '@/lib/api';
import type { EstadoOption } from '@/types';

interface Curso {
  _nivel: string;
  _programa: string;
  _modalidad?: string;
  Asignatura: string;
  Estado?: string;
  'Estado curso'?: string;
  Semestre?: string;
  Link?: string;
  'Link DI'?: string;
  Prioridad?: string;
  PRIORIDAD?: string;
  'Inicio Gestor'?: string;
  'Fin Gestor'?: string;
  'Fecha de asignación'?: string;
  'Fecha fin revisión DI'?: string;
  'Fecha fin corrección gestor'?: string;
  'Fecha fin corrección docente'?: string;
}

function isPriority(c: Curso): boolean {
  const val = String(c['Prioridad'] ?? c['PRIORIDAD'] ?? '').trim();
  return val !== '' && val !== '0' && val.toUpperCase() !== 'NO' && val !== 'null';
}

// ── Tab definitions ──────────────────────────────────────────
const TABS = [
  { id: 'todos',       label: 'Todos',       },
  { id: 'pendiente',   label: 'Sin iniciar', },
  { id: 'en_proceso',  label: 'En proceso',  },
  { id: 'en_revision', label: 'En revisión', },
  { id: 'correccion',  label: 'Corrección',  },
  { id: 'aprobado',    label: 'Aprobado',    },
  { id: 'producido',   label: 'Producido',   },
  { id: 'otros',       label: 'Otros',       },
] as const;

type TabId = typeof TABS[number]['id'];

// Tabs where the gestor CAN make changes
const EDITABLE_TABS: Set<TabId> = new Set(['pendiente', 'en_proceso', 'correccion']);

const TAB_ACCENT: Record<TabId, string> = {
  todos:       'border-indigo-600 text-indigo-600',
  pendiente:   'border-gray-500 text-gray-600',
  en_proceso:  'border-blue-500 text-blue-600',
  en_revision: 'border-orange-500 text-orange-600',
  correccion:  'border-red-500 text-red-600',
  aprobado:    'border-green-500 text-green-600',
  producido:   'border-purple-500 text-purple-600',
  otros:       'border-pink-500 text-pink-600',
};

const BADGE_COLOR: Record<string, string> = {
  'En proceso':  'bg-blue-100 text-blue-700',
  'En revisión': 'bg-orange-100 text-orange-700',
  'Aprobado DI': 'bg-green-100 text-green-700',
  'Aprobado':    'bg-green-100 text-green-700',
  'Corrección':  'bg-red-100 text-red-700',
  'Producido':   'bg-purple-100 text-purple-700',
  'Cargado':     'bg-gray-100 text-gray-600',
};

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
function getTabDate(c: Curso, tab: TabId): Date | null {
  if (tab === 'pendiente')   return parseDate(c['Fecha de asignación']);
  if (tab === 'en_proceso')  return parseDate(c['Inicio Gestor']);
  if (tab === 'en_revision') return parseDate(c['Fin Gestor']);
  if (tab === 'correccion')  return parseDate(c['Fecha fin revisión DI']);
  if (tab === 'aprobado')    return parseDate(c['Fecha fin revisión DI']);
  return null;
}

function estadoTab(estado: string | null | undefined, estadoCurso?: string | null | undefined, fechaCorreccion?: string | null | undefined): TabId {
  const e = (estado ?? '').trim();
  const ec = (estadoCurso ?? '').trim();
  const corregido = !!(fechaCorreccion ?? '').trim();
  if (!e || e === 'No empezado' || e === 'Sin iniciar') return 'pendiente';
  if (e === 'En proceso') return 'en_proceso';
  if (e === 'Aprobado DI' || e === 'Aprobado') return 'aprobado';
  if (e === 'Producido' || e === 'Cargado') return 'producido';
  if (e === 'Enviado a revisión' || e === 'En revisión') {
    // Si Estado curso = Corrección pero el gestor ya corrigió → en revisión
    if (ec === 'Corrección' && !corregido) return 'correccion';
    return 'en_revision';
  }
  if (e === 'Corrección' || ec === 'Corrección') return 'correccion';
  if (ec === 'Aprobado') return 'aprobado';
  return 'otros';
}

// Only show the relevant action for the current course state
function getOpcionesGestor(tab: TabId): EstadoOption[] {
  if (tab === 'pendiente')  return ESTADOS_GESTOR.filter(e => e.id === 'inicio_contenido');
  if (tab === 'en_proceso') return ESTADOS_GESTOR.filter(e => e.id === 'enviado');
  if (tab === 'correccion') return ESTADOS_GESTOR.filter(e => e.id === 'corregido');
  return [];
}

export default function GestorPage() {
  const { data: session } = useSession();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('todos');
  const [nivelFilter, setNivelFilter] = useState('');
  const [modal, setModal] = useState<{ curso: Curso; tab: TabId; obs: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState<{ id: string; type: 'success' | 'error'; text: string }[]>([]);

  const load = async () => {
    const res = await fetch(api('/api/my-courses')).then(r => r.json());
    setCursos(res.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleConfirm = async () => {
    if (!modal) return;
    const opciones = getOpcionesGestor(modal.tab);
    if (!opciones.length) return;
    setSaving(true);
    try {
      const res = await fetch(api('/api/update'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rol: 'Gestor',
          responsable: session?.user?.name || '',
          nivel: modal.curso._nivel,
          programa: modal.curso._programa,
          curso: modal.curso.Asignatura,
          estadoId: opciones[0].id,
          observaciones: modal.obs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages(m => [...m, { id: Date.now().toString(), type: 'success', text: `Estado actualizado: "${modal.curso.Asignatura}"` }]);
      setModal(null);
      await load();
    } catch (err) {
      setMessages(m => [...m, { id: Date.now().toString(), type: 'error', text: err instanceof Error ? err.message : 'Error inesperado' }]);
    } finally {
      setSaving(false);
    }
  };

  // Count per tab
  const counts: Record<TabId, number> = {
    todos: cursos.length,
    pendiente: 0, en_proceso: 0, en_revision: 0,
    correccion: 0, aprobado: 0, producido: 0, otros: 0,
  };
  const fechaCorreccion = (c: Curso) => String(c['Fecha fin corrección gestor'] ?? c['Fecha fin corrección docente'] ?? '').trim();
  const cursosNivel = nivelFilter ? cursos.filter(c => c._nivel === nivelFilter) : cursos;
  for (const c of cursosNivel) counts[estadoTab(c.Estado, c['Estado curso'], fechaCorreccion(c))]++;

  // Filter by active tab + nivel, then sort priorities first
  const filtered = (activeTab === 'todos' ? cursosNivel : cursosNivel.filter(c => estadoTab(c.Estado, c['Estado curso'], fechaCorreccion(c)) === activeTab));

  const sortByDate = (list: Curso[]) => [...list].sort((a, b) => {
    const ta = estadoTab(a.Estado, a['Estado curso'], fechaCorreccion(a));
    const tb = estadoTab(b.Estado, b['Estado curso'], fechaCorreccion(b));
    return (getTabDate(a, ta)?.getTime() ?? Infinity) - (getTabDate(b, tb)?.getTime() ?? Infinity);
  });
  const visible = [
    ...sortByDate(filtered.filter(isPriority)),
    ...sortByDate(filtered.filter(c => !isPriority(c))),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Mis cursos asignados</h1>
              <p className="text-xs text-gray-500">{session?.user?.name} · Gestor</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: api('/login') })}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>

        {/* Tabs */}
        {!loading && cursos.length > 0 && (
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-2 pt-1">
              <select
                value={nivelFilter}
                onChange={e => { setNivelFilter(e.target.value); setModal(null); }}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">Todos los niveles</option>
                <option value="Pregrado">Pregrado</option>
                <option value="Especializaciones">Especializaciones</option>
                <option value="Maestrías">Maestrías</option>
                <option value="Doctorado">Doctorado</option>
              </select>
            </div>
            <div className="flex gap-0 overflow-x-auto scrollbar-none -mb-px">
              {TABS.map(tab => {
                const active = activeTab === tab.id;
                const count = counts[tab.id];
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setModal(null); }}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                      active
                        ? TAB_ACCENT[tab.id]
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                      active
                        ? 'bg-white/30 text-inherit'
                        : count > 0
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-gray-50 text-gray-300'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-3">
        {/* Notifications */}
        <div className="space-y-2">
          {messages.slice(-3).map(m => (
            <div key={m.id} className={`p-3 rounded-xl border text-sm flex items-center gap-2 ${m.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {m.text}
              <button onClick={() => setMessages(msgs => msgs.filter(x => x.id !== m.id))} className="ml-auto opacity-60 hover:opacity-100">&times;</button>
            </div>
          ))}
        </div>

        {/* Course list */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Cargando cursos...</div>
        ) : cursos.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 text-sm">No tienes cursos asignados.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No hay cursos en esta categoría.
          </div>
        ) : (
          visible.map((curso, i) => {
            const tab = estadoTab(curso.Estado, curso['Estado curso'], fechaCorreccion(curso));
            const editable = EDITABLE_TABS.has(tab);
            const estadoActual = tab === 'correccion'
              ? (String(curso['Estado curso'] ?? '').trim() || 'Corrección')
              : String(curso.Estado ?? '').trim();
            const linkCurso = String(curso.Link ?? '').trim();
            const linkDI = String(curso['Link DI'] ?? '').trim();
            return (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-200 hover:border-gray-300 transition-all"
              >
                {/* Course row */}
                <div className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isPriority(curso) && (
                        <span className="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded bg-red-500 text-white uppercase tracking-wide">
                          Prioridad
                        </span>
                      )}
                      <p className="font-semibold text-gray-900">{curso.Asignatura}</p>
                      {linkCurso && (
                        <a href={linkCurso} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium" onClick={e => e.stopPropagation()}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          Abrir curso
                        </a>
                      )}
                      {linkDI && (
                        <a href={linkDI} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium" onClick={e => e.stopPropagation()}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          Enlace DI
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {curso._nivel} · {curso._programa}
                      {curso._modalidad ? ` · ${curso._modalidad}` : ''}
                      {curso.Semestre ? ` · Semestre ${curso.Semestre}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Estado badge */}
                    {tab === 'pendiente' ? (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-400">
                        Sin iniciar
                      </span>
                    ) : (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${BADGE_COLOR[estadoActual] || 'bg-gray-100 text-gray-600'}`}>
                        {estadoActual}
                      </span>
                    )}

                    {/* Action button / lock */}
                    {editable ? (
                      <button
                        onClick={() => setModal({ curso, tab, obs: '' })}
                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shrink-0"
                      >
                        {tab === 'pendiente' ? 'Iniciar' : tab === 'en_proceso' ? 'Enviar' : 'Corregido'}
                      </button>
                    ) : (
                      <span className="p-1 text-gray-300" title="Solo lectura">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>

              </div>
            );
          })
        )}
      </main>

      {/* Modal acción gestor */}
      {modal && (() => {
        const opciones = getOpcionesGestor(modal.tab);
        const opt = opciones[0];
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
              <h3 className="font-bold text-gray-900 text-base mb-1">{opt?.label}</h3>
              <p className="text-sm font-semibold text-gray-800 mb-0.5 truncate">{modal.curso.Asignatura}</p>
              <p className="text-xs text-gray-400 mb-5">{modal.curso._nivel} · {modal.curso._programa}</p>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Observaciones</label>
                <textarea
                  value={modal.obs}
                  onChange={e => setModal(m => m ? { ...m, obs: e.target.value } : m)}
                  placeholder="Notas adicionales (opcional)..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
