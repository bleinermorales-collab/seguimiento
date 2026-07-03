import type { EstadoOption } from '@/types';

export const ESTADOS_GESTOR: EstadoOption[] = [
  {
    id: 'inicio_contenido',
    label: 'Inicio contenido',
    description: 'Comienzo de la elaboración del contenido del curso.',
    badgeText: 'Se registrará: Fecha inicio gestor',
    badgeColor: 'blue',
    registraLabel: 'Fecha inicio gestor',
    updates: {
      'Estado': 'En proceso',
      'Gestor responsable': '__RESPONSABLE__',
      'Inicio Gestor': '__TODAY__',
    },
  },
  {
    id: 'enviado',
    label: 'Enviado',
    description: 'El contenido ha sido enviado para revisión.',
    badgeText: 'Se registrará: Fecha fin gestor',
    badgeColor: 'orange',
    registraLabel: 'Fecha fin gestor',
    updates: {
      'Estado': 'Enviado a revisión',
      'Fin Gestor': '__TODAY__',
    },
    notifyRole: 'di',
  },
  {
    id: 'corregido',
    label: 'Corregido',
    description: 'El contenido ha sido corregido según las observaciones.',
    badgeText: 'Se registrará: Fecha fin corrección gestor',
    badgeColor: 'green',
    registraLabel: 'Fecha fin corrección gestor',
    updates: {
      'Fecha fin corrección gestor': '__TODAY__',
      'Estado': 'En revisión',
      'Estado de la revalidación DI': 'En revalidación',
    },
    notifyRole: 'di',
  },
];

export const ESTADOS_DI: EstadoOption[] = [
  {
    id: 'inicio_revision',
    label: 'Inicio revisión',
    description: 'Inicio del proceso de revisión del curso.',
    badgeText: 'Se registrará: Fecha inicio revisión DI',
    badgeColor: 'blue',
    registraLabel: 'Fecha inicio revisión DI',
    updates: {
      'Estado': 'En revisión',
      'DI responsable': '__RESPONSABLE__',
      'Fecha inicio revisión DI': '__TODAY__',
    },
  },
  {
    id: 'aprobado',
    label: 'Aprobado',
    description: 'El contenido del curso ha sido revisado y aprobado.',
    badgeText: 'Se registrará: Fecha fin revisión DI',
    badgeColor: 'green',
    registraLabel: 'Fecha fin revisión DI',
    updates: {
      'Estado': 'Aprobado DI',
      'Estado curso': 'Aprobado',
      'Fecha fin revisión DI': '__TODAY__',
    },
    notifyRole: 'gestor',
  },
  {
    id: 'devuelto',
    label: 'Devuelto para corrección',
    description: 'El contenido ha sido devuelto al gestor para correcciones.',
    badgeText: 'Se notificará al gestor',
    badgeColor: 'red',
    registraLabel: null,
    updates: {
      'Estado': 'Corrección',
      'Estado curso': 'Corrección',
      'Fecha fin revisión DI': '__TODAY__',
      // Estado de la revalidación DI NO se establece aquí — solo el 'corregido'
      // del gestor lo marca como 'En revalidación' cuando efectivamente corrige.
    },
    notifyRole: 'gestor',
  },
];

export const NIVELES = ['Pregrado', 'Especializaciones', 'Maestrías', 'Doctorado'] as const;

export const SHEET_MAP: Record<string, string> = {
  'Pregrado': 'Pregrado',
  'Especializaciones': 'Especializaciones',
  'Maestrías': 'Maestrías',
  'Doctorado': 'Doctorado',
};
