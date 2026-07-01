import fs from 'fs';
import path from 'path';

const LINKS_PATH = path.join(process.cwd(), 'data', 'course-links.json');

type LinksMap = Record<string, { linkDI?: string; linkGC?: string; linkGestor?: string; di?: string }>;

function readLinks(): LinksMap {
  try {
    if (fs.existsSync(LINKS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(LINKS_PATH, 'utf-8')) as LinksMap;
      // Normalize keys: trim each segment separated by "::"
      const normalized: LinksMap = {};
      for (const [k, v] of Object.entries(raw)) {
        const clean = k.split('::').map(p => p.trim()).join('::');
        normalized[clean] = v;
      }
      return normalized;
    }
  } catch { /* ignore parse errors */ }
  return {};
}

function writeLinks(data: LinksMap): void {
  fs.writeFileSync(LINKS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// Include nombreElectiva in the key when present so electivas with the same
// asignatura name in the same programa are stored as distinct entries.
function courseKey(nivel: string, programa: string, asignatura: string, nombreElectiva?: string): string {
  const base = `${nivel.trim()}::${programa.trim()}::${asignatura.trim()}`;
  return nombreElectiva?.trim() ? `${base}::${nombreElectiva.trim()}` : base;
}

// Resolve a link entry: try the full key (with nombreElectiva) first,
// then fall back to the base key (backward compat with old sidecar entries).
function resolveLinks(data: LinksMap, nivel: string, programa: string, asignatura: string, nombreElectiva?: string) {
  const full = courseKey(nivel, programa, asignatura, nombreElectiva);
  const base = courseKey(nivel, programa, asignatura);
  return data[full] ?? (full !== base ? data[base] : undefined);
}

export function setLinkDI(nivel: string, programa: string, asignatura: string, link: string, nombreElectiva?: string): void {
  const data = readLinks();
  const k = courseKey(nivel, programa, asignatura, nombreElectiva);
  data[k] = { ...data[k], linkDI: link };
  writeLinks(data);
}

export function setLinkGC(nivel: string, programa: string, asignatura: string, link: string, nombreElectiva?: string): void {
  const data = readLinks();
  const k = courseKey(nivel, programa, asignatura, nombreElectiva);
  data[k] = { ...data[k], linkGC: link };
  writeLinks(data);
}

export function setLinkGestor(nivel: string, programa: string, asignatura: string, link: string, nombreElectiva?: string): void {
  const data = readLinks();
  const k = courseKey(nivel, programa, asignatura, nombreElectiva);
  data[k] = { ...data[k], linkGestor: link };
  writeLinks(data);
}

export function setDI(nivel: string, programa: string, asignatura: string, nombre: string, nombreElectiva?: string): void {
  const data = readLinks();
  const k = courseKey(nivel, programa, asignatura, nombreElectiva);
  data[k] = { ...data[k], di: nombre };
  writeLinks(data);
}

export function mergeLinks(courses: Record<string, unknown>[]): Record<string, unknown>[] {
  const data = readLinks();
  return courses.map(c => {
    const nivel = String(c._nivel ?? '').trim();
    const programa = String(c._programa ?? '').trim();
    const asignatura = String(c['Asignatura'] ?? '').trim();
    const nombreElectiva = String(c['Nombre electiva'] ?? '').trim() || undefined;
    const links = resolveLinks(data, nivel, programa, asignatura, nombreElectiva);
    const patched = { ...c };
    if (links?.linkDI) patched['Link DI'] = links.linkDI;
    if (links?.linkGC) patched['Link'] = links.linkGC;
    if (links?.linkGestor) patched['Link Gestor'] = links.linkGestor;
    // Inject DI name from sidecar if the sheet column is empty
    if (links?.di) {
      const existing = String(patched['DI responsable'] ?? patched['DI Responsable'] ?? patched['DI responsable '] ?? '').trim();
      if (!existing) patched['DI responsable'] = links.di;
    }
    return patched;
  });
}

export function getCourseLinks(nivel: string, programa: string, asignatura: string, nombreElectiva?: string): { linkGC?: string; linkDI?: string; linkGestor?: string } {
  const data = readLinks();
  return resolveLinks(data, nivel, programa, asignatura, nombreElectiva) ?? {};
}

// Keep backward compat alias
export const mergeLinksDI = mergeLinks;
