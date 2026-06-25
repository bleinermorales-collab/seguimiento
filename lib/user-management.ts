import fs from 'fs';
import path from 'path';

export type UserRole = 'Gestor' | 'Diseñador Instruccional' | 'Coordinador' | 'Super Admin';

export interface DynamicUser {
  username: string;
  nombre: string;
  email: string;
  role: UserRole;
  active: boolean;
}

const USERS_PATH = path.join(process.cwd(), 'data', 'users.json');

// Seed users — used to initialize data/users.json on first run
const SEED_USERS: DynamicUser[] = [
  { username: 'spalencia',    nombre: 'Samir Palencia Gerónimo',           email: 'palenciasamir_adm@americana.edu.co',  role: 'Gestor', active: true },
  { username: 'hojeda',       nombre: 'Hillary Ojeda Durango',             email: 'ojedahillary_adm@americana.edu.co',   role: 'Gestor', active: true },
  { username: 'kmunoz',       nombre: 'Karina Muñoz Sierra',               email: 'munozkarina_adm@americana.edu.co',    role: 'Gestor', active: true },
  { username: 'anunez',       nombre: 'Andrea Nuñez Fonseca',              email: 'andreanunez_adm@americana.edu.co',    role: 'Gestor', active: true },
  { username: 'mjortega',     nombre: 'María José Ortega Martínez',        email: 'mariaortega@americana.edu.co',        role: 'Gestor', active: true },
  { username: 'yromero',      nombre: 'Yelitza Romero',                    email: 'yelitzaromero_doc@americana.edu.co',   role: 'Gestor', active: true },
  { username: 'aarrieta',     nombre: 'Alexandra Arrieta',                 email: 'arrietaalexandra@americana.edu.co',   role: 'Gestor', active: true },
  { username: 'jadie',        nombre: 'Jamer Adie',                        email: 'adiejamer@americana.edu.co',          role: 'Gestor', active: true },
  { username: 'mmantilla',    nombre: 'Milena Mantilla',                   email: 'milenamantilla@americana.edu.co',     role: 'Gestor', active: true },
  { username: 'cnavarro',     nombre: 'Claudia Navarro',                   email: 'navarroclaudia@americana.edu.co',     role: 'Gestor', active: true },
  { username: 'molaciregui',  nombre: 'Martha Olaciregui',                 email: 'molaciregui@americana.edu.co',        role: 'Gestor', active: true },
  { username: 'mpimienta',    nombre: 'Martha Pimienta',                   email: 'mpimienta@americana.edu.co',          role: 'Gestor', active: true },
  { username: 'amendoza',     nombre: 'Aimar Mendoza Torres',              email: 'aimarmendoza_adm@americana.edu.co',   role: 'Gestor', active: true },
  { username: 'nsalas',       nombre: 'Nayerlis Salas Medina',             email: 'salasnayerlis_adm@americana.edu.co',  role: 'Gestor', active: true },
  { username: 'cavendano',    nombre: 'Caroll Tatiana Avendaño Peña',      email: 'avendanocaroll_adm@americana.edu.co', role: 'Gestor', active: true },

  { username: 'adelariveros', nombre: 'Adela Del Rosario Riveros Flores',  email: 'adelariveros@americana.edu.co',       role: 'Diseñador Instruccional', active: true },
  { username: 'avelandia',    nombre: 'Andrés Felipe Velandia Espitia',    email: 'velandiaandres@americana.edu.co',     role: 'Diseñador Instruccional', active: true },
  { username: 'julianvargas', nombre: 'Julián Efrén Vargas Galvis',        email: 'julianvargas@americana.edu.co',       role: 'Diseñador Instruccional', active: true },
  { username: 'luztinoco',    nombre: 'Luz Nelly Tinoco Torres',           email: 'Luztinoco@americana.edu.co',          role: 'Diseñador Instruccional', active: true },
  { username: 'yazminmoreno', nombre: 'Yazmín Moreno Ibáñez',              email: 'YazminMoreno@americana.edu.co',       role: 'Diseñador Instruccional', active: true },
  { username: 'luiscortes',   nombre: 'Luis Enrique Cortes Lasso',         email: 'luiscortes_adm@americana.edu.co',     role: 'Diseñador Instruccional', active: true },
  { username: 'diegopatino',  nombre: 'Diego Alejandro Patiño Roja',       email: 'diegopatino_adm@americana.edu.co',    role: 'Diseñador Instruccional', active: true },
  { username: 'juanrubio',    nombre: 'Juan Jesús Rubio Castellar',        email: 'juanrubio_adm@americana.edu.co',      role: 'Diseñador Instruccional', active: true },
  { username: 'kerenpadilla', nombre: 'Keren Esther Padilla Martinez',     email: 'kerenpadilla_adm@americana.edu.co',   role: 'Diseñador Instruccional', active: true },

  { username: 'maescobar',    nombre: 'María Escobar',                     email: 'coordinacion_gc@americana.edu.co',    role: 'Coordinador', active: true },
  { username: 'karamirez',    nombre: 'Karina Ramirez',                    email: 'coordinacion_di@americana.edu.co',    role: 'Coordinador', active: true },

  { username: 'admin',        nombre: 'Yule',                              email: 'innovacioneducativa@americana.edu.co', role: 'Super Admin', active: true },
];

function readUsers(): DynamicUser[] {
  try {
    if (fs.existsSync(USERS_PATH)) {
      const data = JSON.parse(fs.readFileSync(USERS_PATH, 'utf-8'));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch { /* ignore */ }
  // Seed on first run
  writeUsers(SEED_USERS);
  return SEED_USERS;
}

function writeUsers(users: DynamicUser[]): void {
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf-8');
}

export function getAllUsers(): DynamicUser[] {
  return readUsers();
}

export function getActiveUsers(): DynamicUser[] {
  return readUsers().filter(u => u.active);
}

export function getUserByUsername(username: string): DynamicUser | undefined {
  return readUsers().find(u => u.username === username && u.active);
}

export function getGestores(): { nombre: string; email: string }[] {
  return getActiveUsers().filter(u => u.role === 'Gestor').map(u => ({ nombre: u.nombre, email: u.email }));
}

export function getDIs(): { nombre: string; email: string }[] {
  return getActiveUsers().filter(u => u.role === 'Diseñador Instruccional').map(u => ({ nombre: u.nombre, email: u.email }));
}

export function addUser(user: DynamicUser): { success: boolean; error?: string } {
  const users = readUsers();
  if (users.find(u => u.username === user.username)) {
    return { success: false, error: 'El usuario ya existe' };
  }
  users.push(user);
  writeUsers(users);
  return { success: true };
}

export function updateUser(username: string, updates: Partial<Omit<DynamicUser, 'username'>>): { success: boolean; error?: string } {
  const users = readUsers();
  const idx = users.findIndex(u => u.username === username);
  if (idx === -1) return { success: false, error: 'Usuario no encontrado' };
  users[idx] = { ...users[idx], ...updates };
  writeUsers(users);
  return { success: true };
}

export function deleteUser(username: string): { success: boolean; error?: string } {
  const users = readUsers();
  if (username === 'admin') return { success: false, error: 'No se puede eliminar al Super Admin' };
  const filtered = users.filter(u => u.username !== username);
  if (filtered.length === users.length) return { success: false, error: 'Usuario no encontrado' };
  writeUsers(filtered);
  return { success: true };
}

export function toggleUserActive(username: string): { success: boolean; active?: boolean; error?: string } {
  const users = readUsers();
  if (username === 'admin') return { success: false, error: 'No se puede suspender al Super Admin' };
  const user = users.find(u => u.username === username);
  if (!user) return { success: false, error: 'Usuario no encontrado' };
  user.active = !user.active;
  writeUsers(users);
  return { success: true, active: user.active };
}
