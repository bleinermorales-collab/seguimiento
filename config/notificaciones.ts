// Emails institucionales fijos
export const CDI_EMAIL = 'coordinacion_di@americana.edu.co';   // Coord. Diseño Instruccional
export const CGC_EMAIL = 'coordinacion_gc@americana.edu.co';   // Coord. Gestión de Contenido
export const IE_EMAIL  = 'innovacioneducativa@americana.edu.co'; // Innovación Educativa

// Destinatarios institucionales por evento (sin los responsables del curso)
// El gestor/DI del curso se agrega dinámicamente en cada ruta.
export const NOTIF_BASE: Record<string, string[]> = {
  // Gestor
  enviado:   [CGC_EMAIL, CDI_EMAIL, IE_EMAIL],
  corregido: [CGC_EMAIL, CDI_EMAIL, IE_EMAIL], // + DI responsable del curso
  // DI
  aprobado:  [CGC_EMAIL, CDI_EMAIL, IE_EMAIL], // + Gestor responsable del curso
  devuelto:  [CGC_EMAIL, CDI_EMAIL, IE_EMAIL], // + Gestor responsable del curso
  // Asignaciones (coordinador)
  asignacion_gestor: [CGC_EMAIL, IE_EMAIL], // + Gestor asignado
  asignacion_di:     [IE_EMAIL],               // + DI asignado
};
