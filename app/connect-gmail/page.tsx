'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { api } from '@/lib/api';
import personas from '@/config/personas.json';

const IE     = { nombre: 'Lizney Rodriguez Movilla', email: 'innovacioneducativa@americana.edu.co' };
const COORD  = { nombre: 'María Escobar (CGC)',   email: 'coordinacion_gc@americana.edu.co' };
const COORD2 = { nombre: 'Karina Ramirez (CDI)',  email: 'coordinacion_di@americana.edu.co' };
const YULE   = { nombre: 'Yule (Admin)',           email: 'yuleicygamero@americana.edu.co' };

const TODOS = [
  { grupo: 'Coordinación', personas: [COORD, COORD2, IE, YULE] },
  { grupo: 'Gestores de contenido', personas: personas.gestores },
  { grupo: 'Diseñadores Instruccionales', personas: personas.dis },
];

function ConnectGmailContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [connected, setConnected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch(api('/api/auth/gmail-status'))
      .then(r => r.json())
      .then(d => { setConnected(d.connected || []); setLoading(false); });
  }, []);

  useEffect(() => {
    const success = searchParams.get('success');
    const error   = searchParams.get('error');
    const next = success
      ? { type: 'success' as const, text: `✅ ${decodeURIComponent(success)} conectado correctamente` }
      : error
        ? { type: 'error' as const, text: `❌ Error: ${decodeURIComponent(error)}` }
        : null;
    if (next) setToast(next);
  }, [searchParams]);

  const handleConnect = (email: string) => {
    window.location.href = `${api('/api/auth/gmail')}?email=${encodeURIComponent(email)}`;
  };

  const handleDisconnect = async (email: string) => {
    await fetch(api('/api/auth/gmail-status'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setConnected(c => c.filter(e => e !== email));
    setToast({ type: 'success', text: `Desconectado: ${email}` });
  };

  const role = (session?.user as { role?: string })?.role;
  if (role && !['Super Admin', 'Coordinador'].includes(role)) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Sin acceso</div>;
  }

  const total = TODOS.flatMap(g => g.personas).length;
  const connectedCount = connected.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900">Conexión de correos Gmail</h1>
            <p className="text-xs text-gray-500">Cada usuario autoriza su correo una sola vez</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{connectedCount}/{total} conectados</span>
            <a href={api('/admin')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
              </svg>
              Volver al admin
            </a>
            <button onClick={() => signOut({ callbackUrl: api('/login') })} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {toast && (
          <div className={`p-3 rounded-xl border text-sm flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {toast.text}
            <button onClick={() => setToast(null)} className="ml-auto opacity-60 hover:opacity-100">×</button>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
          <strong>¿Cómo funciona?</strong> Haz clic en &ldquo;Conectar&rdquo; junto al correo de cada persona. Se abrirá la página de Google &mdash; la persona debe iniciar sesión con SU cuenta y hacer clic en &ldquo;Permitir&rdquo;. Después de eso, el sistema enviará correos FROM ese correo automáticamente.
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Cargando...</div>
        ) : (
          TODOS.map(grupo => (
            <div key={grupo.grupo} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700">{grupo.grupo}</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {grupo.personas.map((p) => {
                  const isConnected = connected.includes(p.email);
                  return (
                    <div key={p.email} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                        <p className="text-xs text-gray-400">{p.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {isConnected ? (
                          <>
                            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              Conectado
                            </span>
                            <button
                              onClick={() => handleDisconnect(p.email)}
                              className="text-xs text-red-400 hover:text-red-600"
                            >
                              Desconectar
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleConnect(p.email)}
                            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                          >
                            Conectar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}

export default function ConnectGmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>}>
      <ConnectGmailContent />
    </Suspense>
  );
}
