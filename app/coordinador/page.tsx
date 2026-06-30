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
  Semestre?: string;
  Link?: string;
  Prioridad?: string;
  PRIORIDAD?: string;
  'Gestor asignado'?: string;
  'Gestor responsable '?: string;
  'Gestor responsable'?: string;
  'Fecha de asignación'?: string;
  'Inicio Gestor'?: string;
  'Fin Gestor'?: string;
  'Fecha inicio revisión DI'?: string;
  'Fecha fin revisión DI'?: string;
  'Estado de la revalidación DI'?: string;
  'DI asignado'?: string;
  'DI responsable'?: string;
  'DI Responsable'?: string;
  'DI responsable '?: string;
  'Nombre electiva'?: string;
}

type TabId = 'todos' | 'asignar' | 'asignados' | 'aprobados' | 'devueltos';

function isPriority(c: Curso): boolean {
  const val = String(c['Prioridad'] ?? c['PRIORIDAD'] ?? '').trim();
  return val !== '' && val !== '0' && val.toUpperCase() !== 'NO' && val !== 'null';
}

function isSinIniciar(c: Curso): boolean {
  const e = String(c.Estado ?? '').trim();
  return !e || e === 'No empezado' || e === 'Sin iniciar';
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
function formatDate(d: Date | null): string {
  if (!d) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function getLastStateDate(c: Curso): Date | null {
  const e = String(c.Estado ?? '').trim();
  if (!e || e === 'Sin iniciar' || e === 'No empezado') return parseDate(c['Fecha de asignación']);
  if (e === 'En proceso') return parseDate(c['Inicio Gestor']);
  if (e === 'En revisión' || e === 'Enviado a revisión') return parseDate(c['Fin Gestor']);
  if (e === 'Corrección') return parseDate(c['Fecha fin revisión DI']) ?? parseDate(c['Fin Gestor']);
  if (e === 'Aprobado DI' || e === 'Aprobado') return parseDate(c['Fecha fin revisión DI']);
  if (e === 'Producido' || e === 'Cargado') return parseDate(c['Fin Gestor']);
  return parseDate(c['Fecha de asignación']) ?? parseDate(c['Inicio Gestor']);
}

type TimelineStep = { label: string; date: Date; dias: number | null; color: string };
function buildTimeline(c: Curso): TimelineStep[] {
  const diff = (a: Date | null, b: Date | null) =>
    a && b ? Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000)) : null;

  const steps: { label: string; date: Date | null; prev: Date | null; color: string }[] = [
    { label: 'Asignado a gestor',         date: parseDate(c['Fecha de asignación']),     prev: null,                              color: 'bg-indigo-500' },
    { label: 'Inicio virtualización',      date: parseDate(c['Inicio Gestor']),           prev: parseDate(c['Fecha de asignación']), color: 'bg-blue-500'   },
    { label: 'Enviado a revisión DI',      date: parseDate(c['Fin Gestor']),              prev: parseDate(c['Inicio Gestor']),      color: 'bg-orange-500' },
    { label: 'Inicio revisión DI',         date: parseDate(c['Fecha inicio revisión DI']),prev: parseDate(c['Fin Gestor']),         color: 'bg-violet-500' },
    { label: 'Revisión completada',        date: parseDate(c['Fecha fin revisión DI']),   prev: parseDate(c['Fecha inicio revisión DI']) ?? parseDate(c['Fin Gestor']), color: 'bg-green-500' },
  ];
  return steps
    .filter(s => s.date !== null)
    .map(s => ({ label: s.label, date: s.date!, dias: diff(s.prev, s.date), color: s.color }));
}

function diActual(c: Curso): string {
  return String(c['DI asignado'] ?? c['DI responsable'] ?? c['DI Responsable'] ?? c['DI responsable '] ?? '').trim();
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
function isDevuelto(c: Curso): boolean {
  const estado = String(c.Estado ?? '').trim();
  if (estado === 'Aprobado DI' || estado === 'Aprobado') return false;
  const estadoCurso = String(c['Estado curso'] ?? '').trim();
  const revalidacion = String(c['Estado de la revalidación DI'] ?? '').trim();
  return estado === 'Corrección' || (estadoCurso === 'Corrección' && revalidacion === 'En revalidación');
}

const ESTADO_BADGE: Record<string, string> = {
  'En proceso':  'bg-blue-100 text-blue-700',
  'En revisión': 'bg-orange-100 text-orange-700',
  'Aprobado DI': 'bg-green-100 text-green-700',
  'Aprobado':    'bg-green-100 text-green-700',
  'Corrección':  'bg-red-100 text-red-700',
  'Producido':   'bg-purple-100 text-purple-700',
  'Cargado':     'bg-gray-100 text-gray-600',
};

export default function CoordinadorPage() {
  const { data: session } = useSession();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('todos');
  const [search, setSearch] = useState('');
  const [nivelFilter, setNivelFilter] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterModalidad, setFilterModalidad] = useState('');
  const [filterSemestre, setFilterSemestre] = useState('');
  const [filterGestor, setFilterGestor] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ id: string; type: 'success' | 'error'; text: string }[]>([]);
  const [modal, setModal] = useState<{ curso: Curso; gestor: string; link: string; obs: string } | null>(null);
  const [tracking, setTracking] = useState<Curso | null>(null);
  const EMPTY_ADD = {
    nivel: '', modalidad: '', programa: '', asignatura: '',
    nombreElectiva: '', tipoAsignatura: '', prioridad: '',
    semestre: '', proyecto: '', codigoPensum: '', codigoPrograma: '',
    codigoAsignatura: '', facultad: '', mallaCurricular: '',
    troncoComun: '', fechaProduccion: '',
  };
  const [addModal, setAddModal] = useState<typeof EMPTY_ADD | null>(null);
  const [addPrograms, setAddPrograms] = useState<string[]>([]);
  const [addSaving, setAddSaving] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkModal, setBulkModal] = useState<{ gestor: string; link: string; obs: string } | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => {
    fetch(api('/api/admin'))
      .then(r => r.json())
      .then(d => { setCursos(d.data || []); setLoading(false); });
  }, []);

  const gestorActual = (c: Curso) =>
    String(c['Gestor asignado'] ?? c['Gestor responsable '] ?? c['Gestor responsable'] ?? '').trim();
  const linkActual = (c: Curso) => String(c['Link'] ?? '').trim();
  const nombreElectiva = (c: Curso) => {
    const ne = String(c['Nombre electiva'] ?? '').trim();
    return ne && ne.toLowerCase() !== 'no aplica' ? ne : '';
  };
  const key = (c: Curso) => {
    const ne = nombreElectiva(c);
    return ne ? `${c._nivel}::${c._programa}::${c.Asignatura}::${ne}` : `${c._nivel}::${c._programa}::${c.Asignatura}`;
  };

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const applyFilters = (list: Curso[]) => list.filter(c => {
    if (nivelFilter && c._nivel !== nivelFilter) return false;
    if (filterEstado && String(c.Estado ?? '').trim() !== filterEstado) return false;
    if (filterModalidad && String(c._modalidad ?? '').trim() !== filterModalidad) return false;
    if (filterSemestre && String(c.Semestre ?? '').trim() !== filterSemestre) return false;
    if (filterGestor && gestorActual(c) !== filterGestor) return false;
    const q = norm(search);
    if (q && !norm(c.Asignatura ?? '').includes(q) && !norm(c._programa ?? '').includes(q)) return false;
    return true;
  });
  const modalidades = [...new Set(cursos.map(c => String(c._modalidad ?? '')).filter(Boolean))].sort();
  const semestres = [...new Set(cursos.map(c => String(c.Semestre ?? '')).filter(s => !!s && s !== 'null'))].sort((a, b) => (+a || 0) - (+b || 0));

  const sortAZ = (l: Curso[]) => [...l].sort((a, b) => String(a.Asignatura ?? '').localeCompare(String(b.Asignatura ?? ''), 'es'));
  const sortByDate = (list: Curso[], getDate: (c: Curso) => Date | null) => [...list].sort((a, b) => {
    const pa = isPriority(a) ? 0 : 1;
    const pb = isPriority(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (getDate(a)?.getTime() ?? Infinity) - (getDate(b)?.getTime() ?? Infinity);
  });

  // Tab "Todos": oldest state change first
  const todosFiltered = sortByDate(applyFilters(cursos), getLastStateDate);

  // Tab "Por asignar": sin iniciar Y sin gestor asignado
  const sinIniciar = [
    ...sortAZ(applyFilters(cursos.filter(c => isSinIniciar(c) && !gestorActual(c))).filter(isPriority)),
    ...sortAZ(applyFilters(cursos.filter(c => isSinIniciar(c) && !gestorActual(c))).filter(c => !isPriority(c))),
  ];
  const sinAsignarCount = cursos.filter(c => isSinIniciar(c) && !gestorActual(c)).length;
  const devueltos = sortByDate(applyFilters(cursos.filter(isDevuelto)), getLastStateDate);
  const devueltosTotal = cursos.filter(isDevuelto).length;
  const isAprobadoFinal = (c: Curso) => { const e = String(c.Estado ?? '').trim(); return e === 'Aprobado DI' || e === 'Aprobado' || e === 'Producido' || e === 'Cargado'; };
  // Tab "Asignados": cursos con gestor, no aprobados/producidos/cargados aún
  const asignados = sortByDate(
    applyFilters(cursos.filter(c => Boolean(gestorActual(c)) && !isAprobadoFinal(c))),
    getLastStateDate
  );
  const asignadosTotal = cursos.filter(c => Boolean(gestorActual(c)) && !isAprobadoFinal(c)).length;
  // Tab "Aprobados": cursos en estado Aprobado DI / Aprobado / Producido / Cargado
  const aprobadosTab = sortByDate(applyFilters(cursos.filter(isAprobadoFinal)), c => parseDate(c['Fecha fin revisión DI']));
  const aprobadosTotal = cursos.filter(isAprobadoFinal).length;


  const handleModalConfirm = async () => {
    if (!modal || !modal.gestor) return;
    const k = key(modal.curso);
    setSaving(k);
    try {
      const res = await fetch(api('/api/assign'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nivel: modal.curso._nivel,
          programa: modal.curso._programa,
          curso: modal.curso.Asignatura,
          gestor: modal.gestor,
          link: modal.link,
          observaciones: modal.obs,
          nombreElectiva: nombreElectiva(modal.curso) || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCursos(prev => prev.map(c =>
        key(c) === k ? { ...c, 'Gestor asignado': modal.gestor, Link: modal.link || c.Link } : c
      ));
      const action = gestorActual(modal.curso) ? 'Reasignado' : 'Asignado';
      setMessages(m => [...m, { id: Date.now().toString(), type: 'success', text: `${action} "${modal.curso.Asignatura}" → ${modal.gestor}` }]);
      setModal(null);
      setActiveTab('asignados');
    } catch (err) {
      setMessages(m => [...m, { id: Date.now().toString(), type: 'error', text: err instanceof Error ? err.message : 'Error' }]);
    } finally {
      setSaving(null);
    }
  };

  const toggleSelect = (k: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === sinIniciar.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(sinIniciar.map(c => key(c))));
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkModal || !bulkModal.gestor) return;
    setBulkSaving(true);
    const keys = [...selectedKeys];
    let ok = 0, fail = 0;
    for (const k of keys) {
      const curso = cursos.find(c => key(c) === k);
      if (!curso) continue;
      try {
        const res = await fetch(api('/api/assign'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nivel: curso._nivel,
            programa: curso._programa,
            curso: curso.Asignatura,
            gestor: bulkModal.gestor,
            link: bulkModal.link,
            observaciones: bulkModal.obs,
            nombreElectiva: nombreElectiva(curso) || undefined,
          }),
        });
        if (res.ok) {
          ok++;
          setCursos(prev => prev.map(c =>
            key(c) === k ? { ...c, 'Gestor asignado': bulkModal.gestor, Link: bulkModal.link || c.Link } : c
          ));
        } else { fail++; }
      } catch { fail++; }
    }
    if (ok > 0) setMessages(m => [...m, { id: Date.now().toString(), type: 'success', text: `${ok} curso(s) asignado(s) a ${bulkModal.gestor}.` }]);
    if (fail > 0) setMessages(m => [...m, { id: Date.now().toString(), type: 'error', text: `${fail} curso(s) no pudieron asignarse.` }]);
    setSelectedKeys(new Set());
    setBulkModal(null);
    setBulkSaving(false);
    if (ok > 0) setActiveTab('asignados');
  };

  const niveles = ['Pregrado', 'Especializaciones', 'Maestrías', 'Doctorado'];
  const opcionesModalidad = ['Presencial', 'Virtual', 'Ambas'];

  const [gestores, setGestores] = useState<string[]>([]);
  useEffect(() => {
    fetch(api('/api/data?type=gestores')).then(r => r.json()).then(d => setGestores(d.data || []));
  }, []);

  const handleAddNivelChange = async (nivel: string) => {
    setAddModal(m => m ? { ...m, nivel, programa: '' } : m);
    setAddPrograms([]);
    if (!nivel) return;
    const r = await fetch(api(`/api/data?type=programas&nivel=${encodeURIComponent(nivel)}`));
    const d = await r.json();
    setAddPrograms(d.data || []);
  };

  const setAdd = (key: string, value: string) =>
    setAddModal(m => m ? { ...m, [key]: value } : m);

  const handleAddCourse = async () => {
    if (!addModal || !addModal.nivel || !addModal.programa || !addModal.asignatura.trim()) return;
    setAddSaving(true);
    try {
      const res = await fetch(api('/api/courses'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addModal, asignatura: addModal.asignatura.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const newCourse: Curso = {
        _nivel: addModal.nivel,
        _programa: addModal.programa,
        _modalidad: addModal.modalidad || undefined,
        Asignatura: addModal.asignatura.trim(),
        Semestre: addModal.semestre || undefined,
        Estado: 'No empezado',
        Prioridad: addModal.prioridad || undefined,
      };
      setCursos(prev => [...prev, newCourse]);
      setMessages(m => [...m, { id: Date.now().toString(), type: 'success', text: `Curso "${addModal.asignatura.trim()}" agregado.` }]);
      setAddModal(null);
    } catch (err) {
      setMessages(m => [...m, { id: Date.now().toString(), type: 'error', text: err instanceof Error ? err.message : 'Error' }]);
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Coordinación de gestión de contenido</h1>
              <p className="text-xs text-gray-500">{session?.user?.name} · Coordinador</p>
            </div>
          </div>
          <button onClick={() => signOut({ callbackUrl: api('/login') })} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-0 -mb-px">
            <button
              onClick={() => setActiveTab('todos')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'todos'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Todos los cursos
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === 'todos' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {cursos.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('asignar')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'asignar'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Por asignar
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === 'asignar' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                {sinAsignarCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('asignados')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'asignados'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Asignados
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === 'asignados' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {asignadosTotal}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('aprobados')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'aprobados'
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              Aprobados
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === 'aprobados' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {aprobadosTotal}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('devueltos')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'devueltos'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Devueltos
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === 'devueltos' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                {devueltosTotal}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Total', value: cursos.length, color: 'text-gray-900' },
            { label: 'Sin iniciar', value: cursos.filter(isSinIniciar).length, color: 'text-gray-500' },
            { label: 'En proceso', value: cursos.filter(c => String(c.Estado ?? '').trim() === 'En proceso').length, color: 'text-blue-600' },
            { label: 'En revisión', value: cursos.filter(c => String(c.Estado ?? '').trim() === 'En revisión').length, color: 'text-orange-600' },
            { label: 'Corrección', value: devueltosTotal, color: 'text-red-600' },
            { label: 'Aprobados', value: cursos.filter(c => { const e = String(c.Estado ?? '').trim(); return e === 'Aprobado DI' || e === 'Aprobado'; }).length, color: 'text-green-600' },
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
              <button onClick={() => setMessages(msgs => msgs.filter(x => x.id !== m.id))} className="ml-auto opacity-60 hover:opacity-100">×</button>
            </div>
          ))}
        </div>

        {addModal ? (
          /* ── Vista: Agregar nuevo curso ── */
          <div className="bg-white rounded-2xl border border-gray-200">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Agregar nuevo curso</h2>
                <p className="text-xs text-gray-400 mt-0.5">Se guardará con estado &quot;No empezado&quot;. Campos con * son obligatorios.</p>
              </div>
              <button
                onClick={() => setAddModal(null)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Volver
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">

              {/* Identificación */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Identificación</p>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Nivel *</label>
                    <select value={addModal.nivel} onChange={e => handleAddNivelChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                      <option value="">Seleccionar...</option>
                      {niveles.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Modalidad</label>
                    <select value={addModal.modalidad} onChange={e => setAdd('modalidad', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                      <option value="">Sin especificar</option>
                      {opcionesModalidad.map(md => <option key={md} value={md}>{md}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Semestre</label>
                    <input type="number" min={1} max={12} value={addModal.semestre} onChange={e => setAdd('semestre', e.target.value)}
                      placeholder="Ej. 3"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Programa *</label>
                    {addPrograms.length > 0 ? (
                      <select value={addModal.programa} onChange={e => setAdd('programa', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                        <option value="">Seleccionar programa...</option>
                        {addPrograms.map(p => <option key={p} value={p}>{p}</option>)}
                        <option value="__nuevo__">Otro (escribir manualmente)</option>
                      </select>
                    ) : (
                      <input type="text" value={addModal.programa} onChange={e => setAdd('programa', e.target.value)}
                        placeholder={addModal.nivel ? 'Nombre del programa' : 'Selecciona el nivel primero'}
                        disabled={!addModal.nivel}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-400" />
                    )}
                    {addModal.programa === '__nuevo__' && (
                      <input type="text" autoFocus placeholder="Nombre del nuevo programa"
                        onChange={e => setAdd('programa', e.target.value)}
                        className="w-full mt-2 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Asignatura *</label>
                    <input type="text" value={addModal.asignatura} onChange={e => setAdd('asignatura', e.target.value)}
                      placeholder="Nombre de la asignatura"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
              </div>

              {/* Clasificación */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Clasificación</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Tipo de asignatura</label>
                    <select value={addModal.tipoAsignatura} onChange={e => setAdd('tipoAsignatura', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                      <option value="">Seleccionar...</option>
                      <option value="Disciplinar">Disciplinar</option>
                      <option value="Electiva">Electiva</option>
                    </select>
                  </div>
                  {addModal.tipoAsignatura === 'Electiva' && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Nombre electiva</label>
                      <input type="text" value={addModal.nombreElectiva} onChange={e => setAdd('nombreElectiva', e.target.value)}
                        placeholder="Nombre de la electiva"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Prioridad</label>
                    <select value={addModal.prioridad} onChange={e => setAdd('prioridad', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                      <option value="">Sin especificar</option>
                      <option value="Prioridad">Prioridad</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Proyecto</label>
                    <input type="text" value={addModal.proyecto} onChange={e => setAdd('proyecto', e.target.value)}
                      placeholder="Ej. NOA 2025"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
              </div>

              {/* Datos académicos */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Datos académicos</p>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Facultad</label>
                    <input type="text" value={addModal.facultad} onChange={e => setAdd('facultad', e.target.value)}
                      placeholder="Facultad"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Malla curricular</label>
                    <select value={addModal.mallaCurricular} onChange={e => setAdd('mallaCurricular', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                      <option value="">Sin especificar</option>
                      <option value="Nueva">Nueva</option>
                      <option value="Actual">Actual</option>
                      <option value="Ambas">Ambas</option>
                      <option value="Antigua">Antigua</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">¿Tronco común?</label>
                    <select value={addModal.troncoComun} onChange={e => setAdd('troncoComun', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                      <option value="">Sin especificar</option>
                      <option value="Sí">Sí</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Fecha prog. producción</label>
                    <input type="month" value={addModal.fechaProduccion} onChange={e => setAdd('fechaProduccion', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
              </div>

              {/* Códigos */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Códigos</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Cód. Pensum</label>
                    <input type="text" value={addModal.codigoPensum} onChange={e => setAdd('codigoPensum', e.target.value)}
                      placeholder="Código"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Cód. Programa</label>
                    <input type="text" value={addModal.codigoPrograma} onChange={e => setAdd('codigoPrograma', e.target.value)}
                      placeholder="Código"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Cód. Asignatura</label>
                    <input type="text" value={addModal.codigoAsignatura} onChange={e => setAdd('codigoAsignatura', e.target.value)}
                      placeholder="Código"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setAddModal(null)} className="px-5 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handleAddCourse}
                disabled={addSaving || !addModal.nivel || !addModal.programa || addModal.programa === '__nuevo__' || !addModal.asignatura.trim()}
                className="px-6 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {addSaving ? 'Guardando...' : 'Agregar curso'}
              </button>
            </div>
          </div>
        ) : (
        <>
        {/* Filters (shared between tabs) */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Buscar curso o programa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <select
            value={nivelFilter}
            onChange={e => setNivelFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="">Todos los niveles</option>
            {niveles.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="">Todos los estados</option>
            {['En proceso', 'En revisión', 'Aprobado DI', 'Corrección', 'Cargado', 'Producido', 'No empezado'].map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <select
            value={filterModalidad}
            onChange={e => setFilterModalidad(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="">Todas las modalidades</option>
            {modalidades.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={filterSemestre}
            onChange={e => setFilterSemestre(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="">Todos los semestres</option>
            {semestres.map(s => <option key={s} value={s}>Semestre {s}</option>)}
          </select>
          <select
            value={filterGestor}
            onChange={e => setFilterGestor(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="">Todos los gestores</option>
            {gestores.map((g: string) => <option key={g} value={g}>{g}</option>)}
          </select>
          <span className="text-xs text-gray-400">
            {activeTab === 'todos' ? `${todosFiltered.length} cursos`
              : activeTab === 'asignar' ? `${sinIniciar.length} sin iniciar`
              : activeTab === 'asignados' ? `${asignados.length} asignados`
              : activeTab === 'aprobados' ? `${aprobadosTab.length} aprobados`
              : `${devueltos.length} devueltos`}
          </span>
          <button
            onClick={() => { setAddPrograms([]); setAddModal({ ...EMPTY_ADD }); }}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Agregar curso
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Cargando cursos...</div>
        ) : (
          <>
            {/* ── TAB: TODOS LOS CURSOS ── */}
            {activeTab === 'todos' && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[1200px]">
                    <div className="grid grid-cols-[160px_280px_90px_1fr_38px_110px_115px_140px] text-xs font-semibold text-gray-500 uppercase px-5 py-3 border-b border-gray-100 bg-gray-50 gap-3">
                      <span>Nivel</span>
                      <span>Programa</span>
                      <span>Modalidad</span>
                      <span>Asignatura</span>
                      <span>Sem.</span>
                      <span>Fechas</span>
                      <span>Estado</span>
                      <span>Gestor asignado</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {todosFiltered.map((c, i) => {
                        const actual = gestorActual(c);
                        const isAssigned = Boolean(actual);
                        const priority = isPriority(c);
                        const estado = String(c.Estado ?? '').trim();
                        const isNoEmpezado = isSinIniciar(c);

                        return (
                          <div
                            key={i}
                            className={`grid grid-cols-[160px_280px_90px_1fr_38px_110px_115px_140px] items-center gap-3 px-5 py-3 hover:bg-gray-50/50 ${priority ? 'bg-red-50/30' : ''}`}
                          >
                            <span className="text-xs text-gray-400">{c._nivel}</span>
                            <span className="text-xs text-gray-500">{c._programa}</span>
                            <span className="text-xs text-gray-400 truncate">{c._modalidad || '—'}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {priority && (
                                  <span className="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded bg-red-500 text-white uppercase tracking-wide">
                                    Prioridad
                                  </span>
                                )}
                                <span className="text-sm font-medium text-gray-900 truncate">{c.Asignatura}</span>
                              </div>
                              {nombreElectiva(c) && (
                                <p className="text-xs text-indigo-500 mt-0.5 truncate">{nombreElectiva(c)}</p>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 text-center">{c.Semestre || '—'}</span>
                            {/* Botón seguimiento */}
                            <button
                              onClick={() => setTracking(c)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition whitespace-nowrap"
                            >
                              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Fechas
                            </button>
                            {/* Estado */}
                            {isNoEmpezado ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium whitespace-nowrap">Sin iniciar</span>
                            ) : (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${ESTADO_BADGE[estado] || 'bg-gray-100 text-gray-600'}`}>
                                {estado}
                              </span>
                            )}
                            {/* Gestor */}
                            {isAssigned ? (
                              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full truncate border border-emerald-200" title={actual}>
                                {actual}
                              </span>
                            ) : (
                              <span className="text-xs italic text-gray-300">Sin asignar</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: POR ASIGNAR ── */}
            {activeTab === 'asignar' && (
              <>
                {/* Bulk action bar */}
                {selectedKeys.size > 0 && (
                  <div className="flex items-center gap-3 mb-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-semibold text-indigo-700">
                      {selectedKeys.size} curso{selectedKeys.size !== 1 ? 's' : ''} seleccionado{selectedKeys.size !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => setBulkModal({ gestor: '', link: '', obs: '' })}
                      className="ml-2 flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Asignar en bloque
                    </button>
                    <button
                      onClick={() => setSelectedKeys(new Set())}
                      className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 transition"
                    >
                      Deseleccionar todo
                    </button>
                  </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <div className="min-w-[1220px]">
                      <div className="grid grid-cols-[32px_160px_280px_85px_1fr_38px_130px_100px] text-xs font-semibold text-gray-500 uppercase px-5 py-3 border-b border-gray-100 bg-gray-50 gap-3 items-center">
                        <input
                          type="checkbox"
                          checked={sinIniciar.length > 0 && selectedKeys.size === sinIniciar.length}
                          onChange={toggleSelectAll}
                          className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer"
                          title="Seleccionar todos"
                        />
                        <span>Nivel</span>
                        <span>Programa</span>
                        <span>Modalidad</span>
                        <span>Asignatura</span>
                        <span>Sem.</span>
                        <span>Gestor actual</span>
                        <span>Acción</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {sinIniciar.length === 0 ? (
                          <div className="text-center py-12 text-gray-400 text-sm">
                            No hay cursos sin iniciar con los filtros actuales.
                          </div>
                        ) : sinIniciar.map((c, i) => {
                          const actual = gestorActual(c);
                          const priority = isPriority(c);
                          const k = key(c);
                          const checked = selectedKeys.has(k);
                          return (
                            <div
                              key={i}
                              onClick={() => toggleSelect(k)}
                              className={`grid grid-cols-[32px_160px_280px_85px_1fr_38px_130px_100px] items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                                checked ? 'bg-indigo-50/60' : priority ? 'bg-red-50/40 hover:bg-gray-50/50' : 'hover:bg-gray-50/50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelect(k)}
                                onClick={e => e.stopPropagation()}
                                className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer"
                              />
                              <span className="text-xs text-gray-400">{c._nivel}</span>
                              <span className="text-xs text-gray-500">{c._programa}</span>
                              <span className="text-xs text-gray-400 truncate">{c._modalidad || '—'}</span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {priority && <span className="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded bg-red-500 text-white uppercase tracking-wide">Prioridad</span>}
                                  <span className="text-sm font-medium text-gray-900 truncate">{c.Asignatura}</span>
                                </div>
                                {nombreElectiva(c) && (
                                  <p className="text-xs text-indigo-500 mt-0.5 truncate">{nombreElectiva(c)}</p>
                                )}
                              </div>
                              <span className="text-xs text-gray-400 text-center">{c.Semestre || '—'}</span>
                              {actual ? (
                                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full truncate border border-emerald-200" title={actual}>{actual}</span>
                              ) : (
                                <span className="text-xs italic text-gray-300">Sin asignar</span>
                              )}
                              <button
                                onClick={e => { e.stopPropagation(); setModal({ curso: c, gestor: actual, link: linkActual(c), obs: '' }); }}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition shrink-0 ${
                                  actual ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                              >
                                {actual ? 'Reasignar' : 'Asignar'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── TAB: ASIGNADOS ── */}
            {activeTab === 'asignados' && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[1200px]">
                    <div className="grid grid-cols-[160px_280px_1fr_160px_110px_70px_180px] text-xs font-semibold text-gray-500 uppercase px-5 py-3 border-b border-gray-100 bg-gray-50 gap-3">
                      <span>Nivel</span>
                      <span>Programa</span>
                      <span>Asignatura</span>
                      <span>Gestor</span>
                      <span>Estado</span>
                      <span>Días</span>
                      <span>Acción</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {asignados.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">
                          No hay cursos asignados con los filtros actuales.
                        </div>
                      ) : asignados.map((c, i) => {
                        const actual = gestorActual(c);
                        const priority = isPriority(c);
                        const estado = String(c.Estado ?? '').trim();
                        const dias = diasDesde(getLastStateDate(c));
                        return (
                          <div key={i} className={`grid grid-cols-[160px_280px_1fr_160px_110px_70px_180px] items-center gap-3 px-5 py-3 hover:bg-gray-50/50 ${priority ? 'bg-red-50/30' : ''}`}>
                            <span className="text-xs text-gray-400">{c._nivel}</span>
                            <span className="text-xs text-gray-500 truncate">{c._programa}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {priority && (
                                  <span className="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded bg-red-500 text-white uppercase tracking-wide">Prioridad</span>
                                )}
                                <span className="text-sm font-medium text-gray-900 truncate">{c.Asignatura}</span>
                              </div>
                              {nombreElectiva(c) && <p className="text-xs text-indigo-500 mt-0.5 truncate">{nombreElectiva(c)}</p>}
                            </div>
                            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full truncate border border-emerald-200" title={actual}>{actual}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${ESTADO_BADGE[estado] || 'bg-gray-100 text-gray-600'}`}>{estado}</span>
                            <span className={`text-xs font-semibold ${diasClass(dias)}`}>{diasBadge(dias)}</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setTracking(c)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition whitespace-nowrap"
                              >
                                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Fechas
                              </button>
                              <button
                                onClick={() => setModal({ curso: c, gestor: actual, link: linkActual(c), obs: '' })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition whitespace-nowrap"
                              >
                                Reasignar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: APROBADOS ── */}
            {activeTab === 'aprobados' && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[1200px]">
                    <div className="grid grid-cols-[160px_260px_1fr_160px_120px_120px_100px] text-xs font-semibold text-gray-500 uppercase px-5 py-3 border-b border-gray-100 bg-gray-50 gap-3">
                      <span>Nivel</span>
                      <span>Programa</span>
                      <span>Asignatura</span>
                      <span>Gestor</span>
                      <span>Estado</span>
                      <span>Fecha aprobación</span>
                      <span>Acción</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {aprobadosTab.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">No hay cursos aprobados con los filtros actuales.</div>
                      ) : aprobadosTab.map((c, i) => {
                        const actual = gestorActual(c);
                        const estado = String(c.Estado ?? '').trim();
                        const priority = isPriority(c);
                        const fechaAprobacion = parseDate(c['Fecha fin revisión DI']);
                        const estadoBadge: Record<string, string> = {
                          'Aprobado DI': 'bg-green-100 text-green-700',
                          'Aprobado':    'bg-green-100 text-green-700',
                          'Producido':   'bg-purple-100 text-purple-700',
                          'Cargado':     'bg-gray-100 text-gray-600',
                        };
                        return (
                          <div key={i} className={`grid grid-cols-[160px_260px_1fr_160px_120px_120px_100px] items-center gap-3 px-5 py-3 hover:bg-gray-50/50 ${priority ? 'bg-green-50/20' : ''}`}>
                            <span className="text-xs text-gray-400">{c._nivel}</span>
                            <span className="text-xs text-gray-500 truncate">{c._programa}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {priority && <span className="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded bg-red-500 text-white uppercase tracking-wide">Prioridad</span>}
                                <span className="text-sm font-medium text-gray-900 truncate">{c.Asignatura}</span>
                              </div>
                              {nombreElectiva(c) && <p className="text-xs text-indigo-500 mt-0.5 truncate">{nombreElectiva(c)}</p>}
                            </div>
                            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full truncate border border-emerald-200" title={actual}>{actual || '—'}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${estadoBadge[estado] || 'bg-gray-100 text-gray-600'}`}>{estado}</span>
                            <span className="text-xs text-gray-500">{formatDate(fechaAprobacion)}</span>
                            <button
                              onClick={() => setTracking(c)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition whitespace-nowrap"
                            >
                              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Fechas
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: DEVUELTOS ── */}
            {activeTab === 'devueltos' && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[1150px]">
                    <div className="grid grid-cols-[160px_280px_1fr_130px_70px_150px_100px] text-xs font-semibold text-gray-500 uppercase px-5 py-3 border-b border-gray-100 bg-gray-50 gap-3">
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
                          <div key={i} className="grid grid-cols-[160px_280px_1fr_130px_70px_150px_100px] items-center gap-3 px-5 py-3 hover:bg-gray-50/50">
                            <span className="text-xs text-gray-400">{c._nivel}</span>
                            <span className="text-xs text-gray-500">{c._programa}</span>
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-gray-900 truncate block">{c.Asignatura}</span>
                              {nombreElectiva(c) && <p className="text-xs text-indigo-500 mt-0.5 truncate">{nombreElectiva(c)}</p>}
                            </div>
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
          </>
        )}
        </>
        )}
      </main>

      {/* Modal asignación */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full">
            <h3 className="font-bold text-gray-900 text-base mb-1">
              {gestorActual(modal.curso) ? 'Reasignar gestor' : 'Asignar gestor'}
            </h3>
            <p className="text-sm font-semibold text-gray-800 mb-0.5 truncate">{modal.curso.Asignatura}</p>
            <p className="text-xs text-gray-400 mb-5">{modal.curso._nivel} · {modal.curso._programa}</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Gestor a asignar *</label>
                <select
                  value={modal.gestor}
                  onChange={e => setModal(m => m ? { ...m, gestor: e.target.value } : m)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">Seleccionar gestor...</option>
                  {gestores.map((g: string) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Link del curso</label>
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
                  ringColor="focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handleModalConfirm}
                disabled={!modal.gestor || saving === key(modal.curso)}
                className="flex-1 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving === key(modal.curso) ? 'Guardando...' : gestorActual(modal.curso) ? 'Reasignar' : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Modal asignación en bloque */}
      {bulkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={e => { if (e.target === e.currentTarget) setBulkModal(null); }}>
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full">
            <h3 className="font-bold text-gray-900 text-base mb-1">Asignación en bloque</h3>
            <p className="text-sm text-gray-500 mb-5">
              Se asignará el mismo gestor a <span className="font-semibold text-indigo-600">{selectedKeys.size} curso{selectedKeys.size !== 1 ? 's' : ''}</span>.
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Gestor a asignar *</label>
                <select
                  value={bulkModal.gestor}
                  onChange={e => setBulkModal(m => m ? { ...m, gestor: e.target.value } : m)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">Seleccionar gestor...</option>
                  {gestores.map((g: string) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Link del curso (opcional)</label>
                <input
                  type="url"
                  value={bulkModal.link}
                  onChange={e => setBulkModal(m => m ? { ...m, link: e.target.value } : m)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Observaciones (opcional)</label>
                <ObservacionesEditor
                  value={bulkModal.obs}
                  onChange={val => setBulkModal(m => m ? { ...m, obs: val } : m)}
                  placeholder="Notas adicionales..."
                  ringColor="focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setBulkModal(null)} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handleBulkAssign}
                disabled={bulkSaving || !bulkModal.gestor}
                className="flex-1 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {bulkSaving ? `Asignando (${selectedKeys.size})...` : `Asignar ${selectedKeys.size} curso${selectedKeys.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal seguimiento */}
      {tracking && (() => {
        const steps = buildTimeline(tracking);
        const estado = String(tracking.Estado ?? '').trim();
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={e => { if (e.target === e.currentTarget) setTracking(null); }}>
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full">
              <h3 className="font-bold text-gray-900 text-base mb-0.5">Seguimiento del curso</h3>
              <p className="text-sm font-semibold text-gray-800 truncate mb-0.5">{tracking.Asignatura}</p>
              <p className="text-xs text-gray-400 mb-5">{tracking._nivel} · {tracking._programa}{tracking._modalidad ? ` · ${tracking._modalidad}` : ''}</p>

              {steps.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Sin fechas registradas aún.</p>
              ) : (
                <div className="space-y-0">
                  {steps.map((s, idx) => (
                    <div key={idx} className="flex gap-3">
                      {/* Línea de tiempo */}
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full shrink-0 mt-0.5 ${s.color}`} />
                        {idx < steps.length - 1 && <div className="w-0.5 bg-gray-200 flex-1 my-1" />}
                      </div>
                      {/* Contenido */}
                      <div className={`pb-4 min-w-0 ${idx === steps.length - 1 ? 'pb-0' : ''}`}>
                        <p className="text-sm font-semibold text-gray-800">{s.label}</p>
                        <p className="text-xs text-gray-500">{formatDate(s.date)}</p>
                        {s.dias !== null && (
                          <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            s.dias <= 3  ? 'bg-green-100 text-green-700' :
                            s.dias <= 10 ? 'bg-amber-100 text-amber-700' :
                            s.dias <= 20 ? 'bg-orange-100 text-orange-700' :
                                           'bg-red-100 text-red-700'
                          }`}>
                            {s.dias === 0 ? 'Mismo día' : s.dias === 1 ? '1 día después' : `${s.dias} días después`}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Estado actual */}
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">Estado actual</span>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  isSinIniciar(tracking) ? 'bg-gray-100 text-gray-400' :
                  (ESTADO_BADGE[estado] || 'bg-gray-100 text-gray-600')
                }`}>
                  {isSinIniciar(tracking) ? 'Sin iniciar' : estado || '—'}
                </span>
              </div>

              <button onClick={() => setTracking(null)} className="w-full mt-4 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                Cerrar
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
