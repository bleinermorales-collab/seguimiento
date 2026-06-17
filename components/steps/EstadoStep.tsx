'use client';

import type { FormState } from '@/types';
import type { EstadoOption } from '@/types';
import { ESTADOS_GESTOR, ESTADOS_DI } from '@/config/estados';

interface Props {
  form: FormState;
  onChange: (updates: Partial<FormState>) => void;
}

const BADGE_COLORS = {
  blue: 'bg-blue-50 text-blue-700',
  orange: 'bg-orange-50 text-orange-700',
  green: 'bg-green-50 text-green-700',
  red: 'bg-red-50 text-red-700',
};

const ICONS: Record<string, React.ReactNode> = {
  inicio_contenido: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
  enviado: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  corregido: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  inicio_revision: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  aprobado: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  devuelto: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  ),
};

const ICON_BG: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600',
  orange: 'bg-orange-100 text-orange-600',
  green: 'bg-green-100 text-green-600',
  red: 'bg-red-100 text-red-600',
};

function EstadoCard({
  option,
  selected,
  onSelect,
}: {
  option: EstadoOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
        selected
          ? 'border-indigo-500 bg-indigo-50'
          : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-center w-5 h-5 shrink-0">
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            selected ? 'border-indigo-600' : 'border-gray-300'
          }`}
        >
          {selected && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
        </div>
      </div>

      <div className={`p-2 rounded-lg shrink-0 ${ICON_BG[option.badgeColor]}`}>
        {ICONS[option.id]}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">{option.label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
      </div>

      <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${BADGE_COLORS[option.badgeColor]}`}>
        {option.badgeText}
      </span>
    </button>
  );
}

export default function EstadoStep({ form, onChange }: Props) {
  const opciones = form.rol === 'Gestor' ? ESTADOS_GESTOR : ESTADOS_DI;
  const rolDesc =
    form.rol === 'Gestor'
      ? 'Los gestores gestionan el contenido y lo envían para revisión.'
      : 'Los diseñadores instruccionales revisan y aprueban el contenido.';

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
        <h2 className="text-base font-semibold text-gray-900">Estado del proceso</h2>
      </div>
      <p className="text-sm text-gray-500 mb-5 ml-6">Selecciona el estado actual del curso según tu rol.</p>

      <div className="mb-5 p-3 rounded-lg bg-indigo-50 border border-indigo-100 flex gap-2">
        <svg className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <p className="text-sm text-indigo-800">
          <span className="font-semibold">Rol seleccionado: {form.rol}</span>
          <br />
          <span className="text-indigo-700 text-xs">{rolDesc}</span>
        </p>
      </div>

      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Selecciona el estado</p>

      <div className="space-y-3">
        {opciones.map((op) => (
          <EstadoCard
            key={op.id}
            option={op}
            selected={form.estadoSeleccionado === op.id}
            onSelect={() => onChange({ estadoSeleccionado: op.id })}
          />
        ))}
      </div>
    </div>
  );
}
