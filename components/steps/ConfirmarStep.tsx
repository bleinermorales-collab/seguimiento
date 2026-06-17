'use client';

import { useEffect, useState } from 'react';
import type { FormState, DestinatarioOption } from '@/types';
import { ESTADOS_GESTOR, ESTADOS_DI } from '@/config/estados';
import personasData from '@/config/personas.json';

interface Props {
  form: FormState;
  onChange: (updates: Partial<FormState>) => void;
  myEmail?: string;
}

const SUMMARY_ROW = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
    <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
    <span className="text-sm text-gray-500 w-32 shrink-0">{label}</span>
    <span className="text-sm text-gray-900 font-medium">{value}</span>
  </div>
);

const icons = {
  person: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  graduation: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>,
  book: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  file: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  status: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  calendar: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  info: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

function getPersonaEmail(nombre: string, rol: string): string {
  if (rol === 'Gestor') {
    return personasData.gestores.find((g) => g.nombre === nombre)?.email || '';
  }
  return personasData.dis.find((d) => d.nombre === nombre)?.email || '';
}

export default function ConfirmarStep({ form, onChange, myEmail }: Props) {
  const opciones = form.rol === 'Gestor' ? ESTADOS_GESTOR : ESTADOS_DI;
  const opcion = opciones.find((o) => o.id === form.estadoSeleccionado);
  const now = new Date();
  const fechaDisplay = now.toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const [availableDestinatarios, setAvailableDestinatarios] = useState<DestinatarioOption[]>([]);

  useEffect(() => {
    const destinatarios: DestinatarioOption[] = [];

    // Always add the current user
    if (form.responsable) {
      destinatarios.push({
        nombre: form.responsable,
        email: getPersonaEmail(form.responsable, form.rol),
        rol: form.rol,
        selected: true,
      });
    }

    // If the action involves notifying another role, add them
    if (opcion?.notifyRole === 'gestor' && form.curso) {
      // Try to add the gestor of this course
      // We'll add all gestores as options; in a real scenario you'd look up the specific one
      personasData.gestores.forEach((g) => {
        if (!destinatarios.find((d) => d.nombre === g.nombre)) {
          destinatarios.push({ nombre: g.nombre, email: g.email, rol: 'Gestor', selected: true });
        }
      });
    } else if (opcion?.notifyRole === 'di') {
      personasData.dis.forEach((d) => {
        if (!destinatarios.find((dest) => dest.nombre === d.nombre)) {
          destinatarios.push({ nombre: d.nombre, email: d.email, rol: 'Diseñador Instruccional', selected: true });
        }
      });
    }

    setAvailableDestinatarios(destinatarios);
    onChange({ destinatarios: destinatarios });

    // Default message
    if (opcion) {
      const msg = `Se ha registrado el estado "${opcion.label}" para el curso ${form.curso}.\n\nFecha: ${fechaDisplay}`;
      onChange({ mensaje: msg });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.estadoSeleccionado, form.responsable]);

  const toggleDestinatario = (idx: number) => {
    const updated = availableDestinatarios.map((d, i) =>
      i === idx ? { ...d, selected: !d.selected } : d
    );
    setAvailableDestinatarios(updated);
    onChange({ destinatarios: updated });
  };

  const removeDestinatario = (idx: number) => {
    const updated = availableDestinatarios.filter((_, i) => i !== idx);
    setAvailableDestinatarios(updated);
    onChange({ destinatarios: updated });
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Resumen de la actualización</h2>
            <p className="text-xs text-gray-500">Revisa la información antes de confirmar el registro.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="px-5 py-1">
            <SUMMARY_ROW icon={icons.person} label="Rol" value={form.rol} />
            <SUMMARY_ROW icon={icons.person} label="Responsable" value={form.responsable || '—'} />
            <SUMMARY_ROW icon={icons.graduation} label="Nivel" value={form.nivel} />
            <SUMMARY_ROW icon={icons.book} label="Programa" value={form.programa} />
            <SUMMARY_ROW icon={icons.file} label="Curso" value={form.curso} />
          </div>
          <div className="px-5 py-1 border-t md:border-t-0 md:border-l border-gray-100">
            <SUMMARY_ROW
              icon={icons.status}
              label="Estado"
              value={
                opcion ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                    {opcion.label}
                  </span>
                ) : '—'
              }
            />
            <SUMMARY_ROW icon={icons.calendar} label="Fecha del registro" value={fechaDisplay} />
            {opcion?.registraLabel && (
              <div className="mt-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                <p className="text-xs text-indigo-700 font-medium flex items-center gap-1">
                  {icons.info}
                  Con este estado se registrará:
                </p>
                <p className="text-xs text-indigo-900 font-semibold mt-1">
                  {opcion.registraLabel}{' '}
                  <span className="font-normal">{now.toLocaleDateString('es-CO')}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Enviar confirmación por correo</h2>
            <p className="text-xs text-gray-500">Notifica a las personas correspondientes sobre esta actualización.</p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Destinatarios</label>
            <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-lg min-h-[48px]">
              {availableDestinatarios.filter((d) => d.selected).map((d, i) => (
                <span key={i} className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  {d.nombre} ({d.rol})
                  <button
                    type="button"
                    onClick={() => removeDestinatario(availableDestinatarios.indexOf(d))}
                    className="text-indigo-400 hover:text-indigo-700 ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
              {availableDestinatarios.filter((d) => !d.selected).length > 0 && (
                <div className="relative">
                  <select
                    className="text-xs text-gray-400 border-none outline-none bg-transparent cursor-pointer"
                    value=""
                    onChange={(e) => {
                      const idx = parseInt(e.target.value);
                      if (!isNaN(idx)) {
                        const updated = availableDestinatarios.map((d, i) =>
                          i === idx ? { ...d, selected: true } : d
                        );
                        setAvailableDestinatarios(updated);
                        onChange({ destinatarios: updated });
                      }
                    }}
                  >
                    <option value="">+ Agregar destinatario</option>
                    {availableDestinatarios
                      .filter((d) => !d.selected)
                      .map((d, i) => (
                        <option key={i} value={availableDestinatarios.indexOf(d)}>
                          {d.nombre} ({d.rol})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Mensaje (opcional)
              </label>
              <textarea
                value={form.mensaje}
                onChange={(e) => onChange({ mensaje: e.target.value })}
                rows={4}
                maxLength={250}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Escribe un mensaje opcional..."
              />
              <p className="text-xs text-gray-400 text-right mt-1">{form.mensaje.length}/250</p>
            </div>
            <div className="flex flex-col justify-end gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enviarCopiaAMi}
                  onChange={(e) => onChange({ enviarCopiaAMi: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Enviar copia de este correo a mí</span>
              </label>
              {myEmail && (
                <p className="text-xs text-gray-400 ml-6">({myEmail})</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
