'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { api } from '@/lib/api';

interface CourseRow {
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
  Prioridad?: string;
  PRIORIDAD?: string;
  Semestre?: string | number;
  'Nombre electiva'?: string;
}

function isPriority(c: CourseRow): boolean {
  const val = String(c['Prioridad'] ?? c['PRIORIDAD'] ?? '').trim();
  return val !== '' && val !== '0' && val.toUpperCase() !== 'NO' && val !== 'null';
}

function parseDate(s: unknown): Date | null {
  if (!s) return null;
  if (s instanceof Date) return s;
  const str = String(s).trim();
  if (!str || str === 'null' || str === 'undefined') return null;
  // Excel serial number (e.g. 46738)
  const n = Number(str);
  if (!isNaN(n) && n > 40000 && !str.includes('/')) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + n * 86400000);
  }
  // dd/mm/yyyy
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}
function diasDesde(d: Date | null): number | null {
  if (!d) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}
function lastActivity(c: CourseRow): Date | null {
  return parseDate(c['Fecha fin revisión DI']) ?? parseDate(c['Fin Gestor']) ?? parseDate(c['Inicio Gestor']);
}
function sortPriorityDate(list: CourseRow[]): CourseRow[] {
  return [...list].sort((a, b) => {
    const pa = isPriority(a) ? 0 : 1;
    const pb = isPriority(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (lastActivity(a)?.getTime() ?? Infinity) - (lastActivity(b)?.getTime() ?? Infinity);
  });
}

interface UserInfo {
  username: string;
  nombre: string;
  email: string;
  role: string;
  active: boolean;
  hasCustomPassword: boolean;
}

type TabId = 'dashboard' | 'usuarios';

const STATE_COLORS: Record<string, string> = {
  'En proceso': 'bg-blue-100 text-blue-700',
  'En revisión': 'bg-yellow-100 text-yellow-700',
  'Aprobado DI': 'bg-green-100 text-green-700',
  'Aprobado': 'bg-green-100 text-green-700',
  'Corrección': 'bg-red-100 text-red-700',
  'Cargado': 'bg-gray-100 text-gray-600',
  'Producido': 'bg-purple-100 text-purple-700',
  'No empezado': 'bg-gray-100 text-gray-500',
  'Enviado a revisión': 'bg-yellow-100 text-yellow-700',
};

const NIVELES = ['Pregrado', 'Especializaciones', 'Maestrías', 'Doctorado'];
const ESTADOS = ['En proceso', 'En revisión', 'Aprobado DI', 'Corrección', 'Cargado', 'Producido', 'No empezado'];

const ROLE_COLORS: Record<string, string> = {
  'Super Admin': 'bg-amber-100 text-amber-700',
  'Coordinador': 'bg-emerald-100 text-emerald-700',
  'Diseñador Instruccional': 'bg-violet-100 text-violet-700',
  'Gestor': 'bg-blue-100 text-blue-700',
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  // Dashboard
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [filterNivel, setFilterNivel] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterModalidad, setFilterModalidad] = useState('');
  const [filterSemestre, setFilterSemestre] = useState('');

  // Users management
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [userMsg, setUserMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ nombre: string; email: string; role: string }>({ nombre: '', email: '', role: '' });
  const [passwordInputs, setPasswordInputs] = useState<Record<string, string>>({});
  const [confirmAction, setConfirmAction] = useState<{ type: string; username: string; label: string } | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', nombre: '', email: '', role: 'Gestor' });
  const [sendingReport, setSendingReport] = useState(false);
  const [reportMsg, setReportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [detail, setDetail] = useState<CourseRow | null>(null);

  useEffect(() => {
    fetch(api('/api/admin'))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setCourses(d.data || []); setLoading(false); })
      .catch(err => { setFetchError(err.message || 'Error'); setLoading(false); });
  }, []);

  const loadUsers = () => {
    if (usersLoaded) return;
    setLoadingUsers(true);
    fetch(api('/api/admin/users'))
      .then(r => r.json())
      .then(d => { setUsers(d.users || []); setLoadingUsers(false); setUsersLoaded(true); })
      .catch(() => setLoadingUsers(false));
  };
  const reloadUsers = () => { setUsersLoaded(false); setLoadingUsers(true); fetch(api('/api/admin/users')).then(r => r.json()).then(d => { setUsers(d.users || []); setLoadingUsers(false); setUsersLoaded(true); }); };

  async function userAction(body: Record<string, unknown>, successMsg: string) {
    setSaving(String(body.username || ''));
    setUserMsg(null);
    try {
      const res = await fetch(api('/api/admin/users'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUserMsg({ type: 'success', text: successMsg });
      reloadUsers();
    } catch (err) {
      setUserMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error' });
    } finally { setSaving(null); }
  }

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const modalidades = [...new Set(courses.map(c => String(c._modalidad ?? '')).filter(Boolean))].sort();
  const semestres = [...new Set(courses.map(c => String(c.Semestre ?? '')).filter(s => !!s && s !== 'null'))].sort((a, b) => (+a || 0) - (+b || 0));
  const filtered = sortPriorityDate(courses.filter(c => {
    const q = norm(search);
    const matchSearch = !search || norm(String(c.Asignatura || '')).includes(q) || norm(String(c._programa || '')).includes(q);
    return matchSearch &&
      (!filterNivel || c._nivel === filterNivel) &&
      (!filterEstado || c.Estado === filterEstado) &&
      (!filterModalidad || String(c._modalidad ?? '').trim() === filterModalidad) &&
      (!filterSemestre || String(c.Semestre ?? '').trim() === filterSemestre);
  }));

  const gestor = (c: CourseRow) => (c['Gestor responsable '] || c['Gestor responsable'] || '—').toString().trim();

  function fmtDate(val: unknown): string {
    if (!val) return '—';
    const s = String(val);
    if (s === 'null' || s === 'undefined') return '—';
    const n = Number(s);
    if (!isNaN(n) && n > 40000) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      return new Date(epoch.getTime() + n * 86400000).toLocaleDateString('es-CO');
    }
    return s;
  }

  const filteredUsers = users.filter(u => {
    if (!searchUser) return true;
    const q = searchUser.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.nombre.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Panel Super Admin</h1>
              <p className="text-xs text-gray-500">Trayecto completo de virtualización de cursos</p>
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
                    setReportMsg({ type: 'error', text: `${d.count} aprobados pero el correo falló: ${d.error || 'Configura SMTP_USER/SMTP_PASS o REPORT_FROM_EMAIL en .env.local'}` });
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
            <button onClick={() => signOut({ callbackUrl: api('/login') })} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-0 -mb-px">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'dashboard' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
              Dashboard
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === 'dashboard' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                {courses.length}
              </span>
            </button>
            <button
              onClick={() => { setActiveTab('usuarios'); loadUsers(); }}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'usuarios' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Usuarios
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === 'usuarios' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{users.length || ''}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* ── TAB: DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
              {[
                { label: 'Total cursos', value: courses.length, color: 'text-gray-900' },
                { label: 'Cargados', value: courses.filter(c => String(c.Estado ?? '').trim() === 'Cargado').length, color: 'text-purple-600' },
                { label: 'En proceso', value: courses.filter(c => c.Estado === 'En proceso').length, color: 'text-blue-600' },
                { label: 'En revisión', value: courses.filter(c => c.Estado === 'En revisión').length, color: 'text-yellow-600' },
                { label: 'Corrección', value: courses.filter(c => c.Estado === 'Corrección').length, color: 'text-red-600' },
                { label: 'Aprobados', value: courses.filter(c => c.Estado === 'Aprobado DI' || c['Estado curso'] === 'Aprobado').length, color: 'text-green-600' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar curso o programa..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <select value={filterNivel} onChange={e => setFilterNivel(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Todos los niveles</option>
                {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Todos los estados</option>
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select value={filterModalidad} onChange={e => setFilterModalidad(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Todas las modalidades</option>
                {modalidades.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={filterSemestre} onChange={e => setFilterSemestre(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Todos los semestres</option>
                {semestres.map(s => <option key={s} value={s}>Semestre {s}</option>)}
              </select>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-gray-400 text-sm">Cargando cursos...</div>
              ) : fetchError ? (
                <div className="p-12 text-center text-red-500 text-sm">Error al cargar: {fetchError}</div>
              ) : (
                <>
                  <div className="grid grid-cols-[65px_160px_90px_1fr_120px_76px] text-xs font-semibold text-gray-500 uppercase px-5 py-3 border-b border-gray-100 bg-gray-50 gap-3">
                    <span>Nivel</span>
                    <span>Programa</span>
                    <span>Modalidad</span>
                    <span>Asignatura</span>
                    <span>Estado</span>
                    <span></span>
                  </div>
                  <div className="divide-y divide-gray-50">
                  {filtered.slice(0, 200).map((c, i) => {
                      const estado = String(c.Estado ?? '').trim();
                      return (
                        <div key={i} className={`grid grid-cols-[65px_160px_90px_1fr_120px_76px] items-center gap-3 px-5 py-3 hover:bg-gray-50/60 ${isPriority(c) ? 'bg-red-50/20' : ''}`}>
                          <span className="text-xs text-gray-400 truncate">{c._nivel}</span>
                          <span className="text-xs text-gray-500 truncate" title={c._programa}>{c._programa}</span>
                          <span className="text-xs text-gray-400 truncate">{c._modalidad || '—'}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {isPriority(c) && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500 text-white uppercase tracking-wide">P</span>}
                              <span className="text-sm font-medium text-gray-900 truncate">{String(c.Asignatura)}</span>
                            </div>
                            {(() => { const ne = String(c['Nombre electiva'] ?? '').trim(); return ne && ne.toLowerCase() !== 'no aplica' ? <p className="text-xs text-indigo-500 mt-0.5 truncate">{ne}</p> : null; })()}
                          </div>
                          <div>
                            {estado ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATE_COLORS[estado] || 'bg-gray-100 text-gray-600'}`}>{estado}</span> : <span className="text-xs text-gray-300">—</span>}
                          </div>
                          <button
                            onClick={() => setDetail(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all"
                            title="Ver detalle"
                          >
                            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Ver
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {filtered.length > 200 && <p className="text-xs text-gray-400 text-center py-3">Mostrando 200 de {filtered.length} resultados.</p>}
                  {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-10">Sin cursos con estos filtros.</p>}
                </>
              )}
            </div>
          </>
        )}

        {/* Modal detalle de curso */}
        {detail && (() => {
          const dateRows: { label: string; val: unknown; color: string }[] = [
            { label: 'Fecha de asignación',    val: detail['Fecha de asignación'],    color: 'bg-indigo-500' },
            { label: 'Inicio virtualización',  val: detail['Inicio Gestor'],          color: 'bg-blue-500'   },
            { label: 'Fin virtualización',     val: detail['Fin Gestor'],             color: 'bg-orange-500' },
            { label: 'Inicio revisión DI',     val: detail['Fecha inicio revisión DI'], color: 'bg-violet-500' },
            { label: 'Fin revisión DI',        val: detail['Fecha fin revisión DI'],  color: 'bg-green-500'  },
          ];
          const activeDates = dateRows.filter(r => fmtDate(r.val) !== '—');
          const estado = String(detail.Estado ?? '').trim();
          const estCurso = String(detail['Estado curso'] ?? '').trim();
          return (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}>
              <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
                <h3 className="font-bold text-gray-900 text-base mb-0.5">Detalle del curso</h3>
                <p className="text-sm font-semibold text-gray-800 truncate mb-0.5">{String(detail.Asignatura)}</p>
                <p className="text-xs text-gray-400 mb-5">{detail._nivel} · {detail._programa}{detail._modalidad ? ` · ${detail._modalidad}` : ''}</p>

                {/* Estados */}
                <div className="flex gap-2 mb-5 flex-wrap">
                  {estado && <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATE_COLORS[estado] || 'bg-gray-100 text-gray-600'}`}>{estado}</span>}
                  {estCurso && estCurso !== estado && <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border border-gray-200 ${STATE_COLORS[estCurso] || 'bg-gray-100 text-gray-600'}`}>{estCurso}</span>}
                  {isPriority(detail) && <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-red-500 text-white">Prioridad</span>}
                </div>

                {/* Personas */}
                <div className="space-y-2 mb-5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Gestor</span>
                    <span className="font-medium text-gray-800">{gestor(detail)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">DI responsable</span>
                    <span className="font-medium text-gray-800">{String(detail['DI responsable'] || '—')}</span>
                  </div>
                </div>

                {/* Timeline fechas */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Seguimiento</p>
                  {activeDates.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">Sin fechas registradas.</p>
                  ) : (
                    <div className="space-y-0">
                      {activeDates.map((row, idx) => {
                        const d = parseDate(row.val);
                        const prev = idx > 0 ? parseDate(activeDates[idx - 1].val) : null;
                        const diff = d && prev ? Math.max(0, Math.floor((d.getTime() - prev.getTime()) / 86400000)) : null;
                        return (
                          <div key={idx} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${row.color}`} />
                              {idx < activeDates.length - 1 && <div className="w-0.5 bg-gray-200 flex-1 my-1" />}
                            </div>
                            <div className={`min-w-0 ${idx < activeDates.length - 1 ? 'pb-3' : ''}`}>
                              <p className="text-xs font-semibold text-gray-700">{row.label}</p>
                              <p className="text-xs text-gray-400">{fmtDate(row.val)}</p>
                              {diff !== null && (
                                <span className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                  diff <= 3  ? 'bg-green-100 text-green-700' :
                                  diff <= 10 ? 'bg-amber-100 text-amber-700' :
                                  diff <= 20 ? 'bg-orange-100 text-orange-700' :
                                               'bg-red-100 text-red-700'
                                }`}>{diff === 0 ? 'Mismo día' : diff === 1 ? '1 día' : `${diff} días`}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button onClick={() => setDetail(null)} className="w-full mt-5 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                  Cerrar
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── TAB: USUARIOS ── */}
        {activeTab === 'usuarios' && (
          <>
            {userMsg && (
              <div className={`mb-4 p-3 rounded-xl border text-sm flex items-center gap-2 ${userMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                {userMsg.type === 'success' && <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                {userMsg.text}
                <button onClick={() => setUserMsg(null)} className="ml-auto opacity-60 hover:opacity-100">&times;</button>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
              <input type="text" placeholder="Buscar usuario..." value={searchUser} onChange={e => setSearchUser(e.target.value)} className="flex-1 min-w-[200px] px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
              <button onClick={() => setShowAddUser(!showAddUser)} className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                Nuevo usuario
              </button>
            </div>

            {/* Add user form */}
            {showAddUser && (
              <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4 mb-4">
                <h3 className="text-sm font-semibold text-indigo-900 mb-3">Crear nuevo usuario</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input type="text" placeholder="Usuario (login)" value={newUser.username} onChange={e => setNewUser(n => ({ ...n, username: e.target.value }))} className="px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="text" placeholder="Nombre completo" value={newUser.nombre} onChange={e => setNewUser(n => ({ ...n, nombre: e.target.value }))} className="px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="email" placeholder="Email" value={newUser.email} onChange={e => setNewUser(n => ({ ...n, email: e.target.value }))} className="px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <select value={newUser.role} onChange={e => setNewUser(n => ({ ...n, role: e.target.value }))} className="px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    <option value="Gestor">Gestor</option>
                    <option value="Diseñador Instruccional">Diseñador Instruccional</option>
                    <option value="Coordinador">Coordinador</option>
                    <option value="Super Admin">Super Admin</option>
                  </select>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { if (!newUser.username || !newUser.nombre || !newUser.email) { setUserMsg({ type: 'error', text: 'Completa todos los campos' }); return; } userAction({ action: 'create', ...newUser }, `Usuario "${newUser.username}" creado`); setNewUser({ username: '', nombre: '', email: '', role: 'Gestor' }); setShowAddUser(false); }} className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Crear</button>
                  <button onClick={() => setShowAddUser(false)} className="px-4 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {loadingUsers ? (
                <div className="p-12 text-center text-gray-400 text-sm">Cargando usuarios...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Usuario</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Rol</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Contraseña</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.filter(u => { const q = searchUser.toLowerCase(); return !q || u.username.toLowerCase().includes(q) || u.nombre.toLowerCase().includes(q) || u.role.toLowerCase().includes(q); }).map(u => {
                        const isAdmin = u.role === 'Super Admin';
                        const isEditing = editingUser === u.username;
                        const pwdVal = passwordInputs[u.username] || '';
                        return (
                          <tr key={u.username} className={`border-b border-gray-50 ${!u.active ? 'opacity-50 bg-gray-50' : isAdmin ? 'bg-amber-50/30' : 'hover:bg-gray-50'}`}>
                            <td className="px-3 py-3 font-mono text-xs text-gray-700">{u.username}</td>
                            <td className="px-3 py-3">{isEditing ? <input type="text" value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))} className="w-full px-2 py-1 text-sm border border-amber-300 rounded-lg" /> : <span className="text-gray-900 font-medium">{u.nombre}</span>}</td>
                            <td className="px-3 py-3">{isEditing ? <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="w-full px-2 py-1 text-sm border border-amber-300 rounded-lg" /> : <span className="text-xs text-gray-500">{u.email}</span>}</td>
                            <td className="px-3 py-3">{isEditing ? (
                              <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} className="px-2 py-1 text-xs border border-amber-300 rounded-lg bg-white">
                                <option value="Gestor">Gestor</option><option value="Diseñador Instruccional">DI</option><option value="Coordinador">Coordinador</option><option value="Super Admin">Super Admin</option>
                              </select>
                            ) : <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>{u.role}</span>}</td>
                            <td className="px-3 py-3">
                              <div className="flex gap-1">
                                <input type="text" placeholder="Nueva..." value={pwdVal} onChange={e => setPasswordInputs(p => ({ ...p, [u.username]: e.target.value }))} className="w-24 px-2 py-1 text-xs border border-gray-200 rounded-lg" />
                                <button onClick={() => { if (!pwdVal || pwdVal.length < 6) { setUserMsg({ type: 'error', text: 'Min. 6 caracteres' }); return; } if (isAdmin) { setConfirmAction({ type: 'password', username: u.username, label: 'Cambiar contraseña del Admin' }); } else { userAction({ action: 'password', username: u.username, newPassword: pwdVal }, `Contraseña de "${u.nombre}" cambiada`); setPasswordInputs(p => { const n = { ...p }; delete n[u.username]; return n; }); } }} disabled={!pwdVal || saving === u.username} className="px-2 py-1 text-[10px] font-semibold bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 shrink-0">{saving === u.username ? '...' : 'Ok'}</button>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex gap-1.5">
                                {isEditing ? (
                                  <>
                                    <button onClick={() => { userAction({ action: 'update', username: u.username, ...editForm }, `"${u.username}" actualizado`); setEditingUser(null); }} className="px-2 py-1 text-[10px] font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700">Guardar</button>
                                    <button onClick={() => setEditingUser(null)} className="px-2 py-1 text-[10px] text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">X</button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => { setEditingUser(u.username); setEditForm({ nombre: u.nombre, email: u.email, role: u.role }); }} className="px-2 py-1 text-[10px] font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600" title="Editar">Editar</button>
                                    {!isAdmin && (
                                      <>
                                        <button onClick={() => setConfirmAction({ type: 'toggle', username: u.username, label: u.active ? `Suspender a "${u.nombre}"` : `Reactivar a "${u.nombre}"` })} className={`px-2 py-1 text-[10px] font-semibold rounded-lg ${u.active ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>{u.active ? 'Suspender' : 'Activar'}</button>
                                        <button onClick={() => setConfirmAction({ type: 'delete', username: u.username, label: `Eliminar a "${u.nombre}" permanentemente` })} className="px-2 py-1 text-[10px] font-semibold bg-red-100 text-red-700 rounded-lg hover:bg-red-200">Eliminar</button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Confirm modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${confirmAction.type === 'delete' ? 'bg-red-100' : 'bg-amber-100'}`}>
                <svg className={`w-5 h-5 ${confirmAction.type === 'delete' ? 'text-red-600' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              </div>
              <h3 className="font-bold text-gray-900">{confirmAction.label}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">Esta acción no se puede deshacer fácilmente. ¿Estás seguro?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmAction(null)} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={() => {
                const { type, username } = confirmAction;
                setConfirmAction(null);
                if (type === 'toggle') userAction({ action: 'toggle', username }, 'Estado actualizado');
                if (type === 'delete') userAction({ action: 'delete', username }, 'Usuario eliminado');
                if (type === 'password') { const pwd = passwordInputs[username] || ''; userAction({ action: 'password', username, newPassword: pwd }, 'Contraseña cambiada'); setPasswordInputs(p => { const n = { ...p }; delete n[username]; return n; }); }
              }} className={`flex-1 py-2.5 text-sm font-semibold rounded-xl text-white ${confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
