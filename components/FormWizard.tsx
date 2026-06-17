'use client';

import { useState } from 'react';
import StepIndicator from './StepIndicator';
import InformacionStep from './steps/InformacionStep';
import EstadoStep from './steps/EstadoStep';
import ConfirmarStep from './steps/ConfirmarStep';
import type { FormState } from '@/types';
import { ESTADOS_GESTOR, ESTADOS_DI } from '@/config/estados';

const INITIAL_FORM: FormState = {
  rol: '',
  responsable: '',
  nivel: '',
  programa: '',
  curso: '',
  estadoSeleccionado: '',
  destinatarios: [],
  mensaje: '',
  enviarCopiaAMi: false,
};

function isStep1Valid(form: FormState): boolean {
  if (!form.rol || !form.nivel || !form.programa || !form.curso) return false;
  if (form.rol !== 'Super Admin' && !form.responsable) return false;
  return true;
}

function isStep2Valid(form: FormState): boolean {
  return !!form.estadoSeleccionado;
}

export default function FormWizard() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const updateForm = (updates: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (step === 1 && form.rol === 'Super Admin') {
      window.location.href = '/admin';
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setStep((s) => s - 1);
    setError('');
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');

    try {
      // 1. Update Excel
      const updateRes = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rol: form.rol,
          responsable: form.responsable,
          nivel: form.nivel,
          programa: form.programa,
          curso: form.curso,
          estadoId: form.estadoSeleccionado,
        }),
      });

      const updateData = await updateRes.json();
      if (!updateRes.ok) {
        throw new Error(updateData.error || 'Error al actualizar el registro');
      }

      // 2. Send emails
      const selectedDestinatarios = form.destinatarios.filter((d) => d.selected);
      const emailList = selectedDestinatarios.map((d) => d.email).filter(Boolean);

      if (form.enviarCopiaAMi) {
        emailList.push(process.env.NEXT_PUBLIC_MY_EMAIL || '');
      }

      const uniqueEmails = Array.from(new Set(emailList.filter(Boolean)));

      if (uniqueEmails.length > 0) {
        const opciones = form.rol === 'Gestor' ? ESTADOS_GESTOR : ESTADOS_DI;
        const opcion = opciones.find((o) => o.id === form.estadoSeleccionado);

        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destinatarios: uniqueEmails,
            asunto: `Actualización de estado: ${opcion?.label} — ${form.curso}`,
            accion: opcion?.label || form.estadoSeleccionado,
            gestor: form.rol === 'Gestor' ? form.responsable : '',
            di: form.rol === 'Diseñador Instruccional' ? form.responsable : undefined,
            nivel: form.nivel,
            programa: form.programa,
            curso: form.curso,
            mensaje: form.mensaje,
          }),
        });
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm(INITIAL_FORM);
    setStep(1);
    setSuccess(false);
    setError('');
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Registro exitoso</h2>
          <p className="text-sm text-gray-500 mb-6">
            El estado del curso <span className="font-semibold text-gray-700">{form.curso}</span> ha sido
            actualizado correctamente.
          </p>
          <button
            onClick={handleReset}
            className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition"
          >
            Registrar otro curso
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Seguimiento de Virtualización</h1>
              <p className="text-xs text-gray-500">Registra y actualiza el estado del proceso de virtualización de cursos</p>
            </div>
          </div>
          {step === 1 ? (
            <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Ayuda
            </button>
          ) : (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
              </svg>
              Salir
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <StepIndicator current={step} />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
          {step === 1 && <InformacionStep form={form} onChange={updateForm} />}
          {step === 2 && <EstadoStep form={form} onChange={updateForm} />}
          {step === 3 && <ConfirmarStep form={form} onChange={updateForm} />}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8">
            {step > 1 ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Anterior
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                onClick={handleNext}
                disabled={step === 1 ? !isStep1Valid(form) : !isStep2Valid(form)}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {step === 1 && form.rol === 'Super Admin' ? 'Ir al panel' : 'Siguiente'}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Confirmar y registrar
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          La información se guardará en el archivo Excel de forma segura.
        </div>
      </main>
    </div>
  );
}
