export type UserRole = 'Gestor' | 'Diseñador Instruccional' | 'Coordinador' | 'Super Admin';

export interface AppUser {
  username: string;
  nombre: string;
  email: string;
  role: UserRole;
  passwordEnvKey: string;
}

export const USERS: AppUser[] = [
  // ── Gestores de contenido ──────────────────────────────────────────────────
  { username: 'spalencia',    nombre: 'Samir Palencia Gerónimo',     email: 'palenciasamir_adm@americana.edu.co',  role: 'Gestor', passwordEnvKey: 'PASS_SPALENCIA' },
  { username: 'hojeda',       nombre: 'Hillary Ojeda Durango',        email: 'ojedahillary_adm@americana.edu.co',   role: 'Gestor', passwordEnvKey: 'PASS_HOJEDA' },
  { username: 'kmunoz',       nombre: 'Karina Muñoz Sierra',          email: 'munozkarina_adm@americana.edu.co',    role: 'Gestor', passwordEnvKey: 'PASS_KMUNOZ' },
  { username: 'anunez',       nombre: 'Andrea Nuñez Fonseca',         email: 'andreanunez_adm@americana.edu.co',    role: 'Gestor', passwordEnvKey: 'PASS_ANUNEZ' },
  { username: 'mjortega',     nombre: 'María José Ortega Martínez',   email: 'mariaortega@americana.edu.co',        role: 'Gestor', passwordEnvKey: 'PASS_MJORTEGA' },
  { username: 'yromero',      nombre: 'Yelitza Romero',               email: 'yelitzaromero_doc@americana.edu.co',  role: 'Gestor', passwordEnvKey: 'PASS_YROMERO' },
  { username: 'aarrieta',     nombre: 'Alexandra Arrieta',            email: 'arrietaalexandra@americana.edu.co',   role: 'Gestor', passwordEnvKey: 'PASS_AARRIETA' },
  { username: 'jadie',        nombre: 'Jamer Adie',                   email: 'adiejamer@americana.edu.co',          role: 'Gestor', passwordEnvKey: 'PASS_JADIE' },
  { username: 'mmantilla',    nombre: 'Milena Mantilla',              email: 'milenamantilla@americana.edu.co',     role: 'Gestor', passwordEnvKey: 'PASS_MMANTILLA' },
  { username: 'cnavarro',     nombre: 'Claudia Navarro',              email: 'navarroclaudia@americana.edu.co',     role: 'Gestor', passwordEnvKey: 'PASS_CNAVARRO' },
  { username: 'molaciregui',  nombre: 'Martha Olaciregui',            email: 'molaciregui@americana.edu.co',        role: 'Gestor', passwordEnvKey: 'PASS_MOLACIREGUI' },
  { username: 'mpimienta',    nombre: 'Martha Pimienta',              email: 'mpimienta@americana.edu.co',          role: 'Gestor', passwordEnvKey: 'PASS_MPIMIENTA' },

  // ── Diseñadores Instruccionales ────────────────────────────────────────────
  { username: 'adelariveros', nombre: 'Adela Del Rosario Riveros Flores', email: 'adelariveros@americana.edu.co',  role: 'Diseñador Instruccional', passwordEnvKey: 'PASS_ADELARIVEROS' },
  { username: 'avelandia',    nombre: 'Andrés Felipe Velandia Espitia',   email: 'velandiaandres@americana.edu.co', role: 'Diseñador Instruccional', passwordEnvKey: 'PASS_AVELANDIA' },
  { username: 'julianvargas', nombre: 'Julián Efrén Vargas Galvis',       email: 'julianvargas@americana.edu.co',   role: 'Diseñador Instruccional', passwordEnvKey: 'PASS_JULIANVARGAS' },
  { username: 'luztinoco',    nombre: 'Luz Nelly Tinoco Torres',           email: 'Luztinoco@americana.edu.co',     role: 'Diseñador Instruccional', passwordEnvKey: 'PASS_LUZTINOCO' },
  { username: 'yazminmoreno', nombre: 'Yazmín Moreno Ibáñez',             email: 'YazminMoreno@americana.edu.co',   role: 'Diseñador Instruccional', passwordEnvKey: 'PASS_YAZMINMORENO' },
  { username: 'luiscortes',   nombre: 'Luis Enrique Cortes Lasso',         email: 'luiscortes_adm@americana.edu.co', role: 'Diseñador Instruccional', passwordEnvKey: 'PASS_LUISCORTES' },
  { username: 'diegopatino',  nombre: 'Diego Alejandro Patiño Roja',       email: 'diegopatino_adm@americana.edu.co', role: 'Diseñador Instruccional', passwordEnvKey: 'PASS_DIEGOPATINO' },

  // ── Coordinadoras ──────────────────────────────────────────────────────────
  { username: 'maescobar',    nombre: 'María Escobar',   email: 'coordinacion_gc@americana.edu.co', role: 'Coordinador', passwordEnvKey: 'PASS_MAESCOBAR' },
  { username: 'karamirez',   nombre: 'Karina Ramirez',  email: 'coordinacion_di@americana.edu.co', role: 'Coordinador', passwordEnvKey: 'PASS_KARAMIREZ' },

  // ── Super Admin ────────────────────────────────────────────────────────────
  { username: 'admin',        nombre: 'Yule',            email: 'yuleicygamero@americana.edu.co',   role: 'Super Admin', passwordEnvKey: 'PASS_ADMIN' },
];

export function getUserByUsername(username: string): AppUser | undefined {
  return USERS.find(u => u.username === username);
}
