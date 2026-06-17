'use client';

import { useEffect, useState } from 'react';
import type { Rol, Nivel, FormState } from '@/types';

interface Props {
  form: FormState;
  onChange: (updates: Partial<FormState>) => void;
}

const ROLES: Rol[] = ['Gestor', 'Diseñador Instruccional', 'Super Admin'];
const NIVELES: Nivel[] = ['Pregrado', 'Especializaciones', 'Maestrías', 'Doctorado'];

function SelectField({
  label,
  icon,
  value,
  onChange,
  options,
  placeholder,
  required,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          {icon}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition disabled:bg-gray-50 disabled:text-gray-400 ${
            value ? 'text-gray-900' : 'text-gray-400'
          }`}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </span>
      </div>
    </div>
  );
}

const icons = {
  person: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  graduation: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 14l9-5-9-5-9 5 9 5z" />
      <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  ),
  book: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  file: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

export default function InformacionStep({ form, onChange }: Props) {
  const [responsables, setResponsables] = useState<string[]>([]);
  const [programas, setProgramas] = useState<string[]>([]);
  const [cursos, setCursos] = useState<string[]>([]);
  const [loadingProgramas, setLoadingProgramas] = useState(false);
  const [loadingCursos, setLoadingCursos] = useState(false);

  // Load responsables when rol changes
  useEffect(() => {
    if (!form.rol || form.rol === 'Super Admin') {
      setResponsables([]);
      return;
    }
    const type = form.rol === 'Gestor' ? 'gestores' : 'dis';
    const nivel = form.nivel || '';
    fetch(`/api/data?type=${type}&nivel=${encodeURIComponent(nivel)}`)
      .then((r) => r.json())
      .then((d) => setResponsables(d.data || []));
  }, [form.rol, form.nivel]);

  // Load programas when nivel changes
  useEffect(() => {
    if (!form.nivel) {
      setProgramas([]);
      return;
    }
    setLoadingProgramas(true);
    fetch(`/api/data?type=programas&nivel=${encodeURIComponent(form.nivel)}`)
      .then((r) => r.json())
      .then((d) => {
        setProgramas(d.data || []);
        setLoadingProgramas(false);
      });
  }, [form.nivel]);

  // Load cursos when programa changes
  useEffect(() => {
    if (!form.nivel || !form.programa) {
      setCursos([]);
      return;
    }
    setLoadingCursos(true);
    fetch(`/api/data?type=cursos&nivel=${encodeURIComponent(form.nivel)}&programa=${encodeURIComponent(form.programa)}`)
      .then((r) => r.json())
      .then((d) => {
        setCursos(d.data || []);
        setLoadingCursos(false);
      });
  }, [form.nivel, form.programa]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-indigo-600">{icons.person}</span>
        <h2 className="text-base font-semibold text-gray-900">Información básica</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6 ml-6">Selecciona los datos del curso asignado</p>

      <div className="space-y-5">
        <SelectField
          label="Rol"
          icon={icons.person}
          value={form.rol}
          onChange={(v) => onChange({ rol: v as Rol, responsable: '', programa: '', curso: '' })}
          options={ROLES}
          placeholder="Selecciona tu rol"
          required
        />

        {form.rol && form.rol !== 'Super Admin' && (
          <SelectField
            label="Responsable"
            icon={icons.person}
            value={form.responsable}
            onChange={(v) => onChange({ responsable: v })}
            options={responsables}
            placeholder="Selecciona tu nombre"
            required
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Nivel"
            icon={icons.graduation}
            value={form.nivel}
            onChange={(v) => onChange({ nivel: v as Nivel, programa: '', curso: '' })}
            options={NIVELES}
            placeholder="Selecciona el nivel"
            required
          />
          <SelectField
            label="Programa"
            icon={icons.book}
            value={form.programa}
            onChange={(v) => onChange({ programa: v, curso: '' })}
            options={loadingProgramas ? [] : programas}
            placeholder={loadingProgramas ? 'Cargando...' : 'Selecciona el programa'}
            required
            disabled={!form.nivel || loadingProgramas}
          />
        </div>

        <SelectField
          label="Curso"
          icon={icons.file}
          value={form.curso}
          onChange={(v) => onChange({ curso: v })}
          options={loadingCursos ? [] : cursos}
          placeholder={loadingCursos ? 'Cargando...' : 'Selecciona el curso'}
          required
          disabled={!form.programa || loadingCursos}
        />
      </div>
    </div>
  );
}
