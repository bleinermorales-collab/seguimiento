export type Rol = 'Gestor' | 'Diseñador Instruccional' | 'Super Admin';
export type Nivel = 'Pregrado' | 'Especializaciones' | 'Maestrías' | 'Doctorado';

export interface Persona {
  nombre: string;
  email: string;
}

export interface EstadoOption {
  id: string;
  label: string;
  description: string;
  badgeText: string;
  badgeColor: 'blue' | 'orange' | 'green' | 'red';
  registraLabel: string | null;
  updates: Record<string, '__TODAY__' | string>;
  notifyRole?: 'gestor' | 'di';
}

export interface CursoInfo {
  asignatura: string;
  programa: string;
  nivel: Nivel;
  estado?: string;
  estadoCurso?: string;
  gestorResponsable?: string;
  diResponsable?: string;
  inicioGestor?: string;
  finGestor?: string;
  fechaInicioRevisionDI?: string;
  fechaFinRevisionDI?: string;
  fechaFinCorreccionGestor?: string;
}

export interface FormState {
  rol: Rol | '';
  responsable: string;
  nivel: Nivel | '';
  programa: string;
  curso: string;
  estadoSeleccionado: string;
  destinatarios: DestinatarioOption[];
  mensaje: string;
  enviarCopiaAMi: boolean;
}

export interface DestinatarioOption {
  nombre: string;
  email: string;
  rol: string;
  selected: boolean;
}
