import fs from 'fs';
import path from 'path';

const LINKS_PATH = path.join(process.cwd(), 'data', 'course-links.json');

type LinksMap = Record<string, { linkDI?: string; linkGC?: string }>;

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

function courseKey(nivel: string, programa: string, asignatura: string): string {
  return `${nivel.trim()}::${programa.trim()}::${asignatura.trim()}`;
}

export function setLinkDI(nivel: string, programa: string, asignatura: string, link: string): void {
  const data = readLinks();
  const k = courseKey(nivel, programa, asignatura);
  data[k] = { ...data[k], linkDI: link };
  writeLinks(data);
}

export function setLinkGC(nivel: string, programa: string, asignatura: string, link: string): void {
  const data = readLinks();
  const k = courseKey(nivel, programa, asignatura);
  data[k] = { ...data[k], linkGC: link };
  writeLinks(data);
}

export function mergeLinks(courses: Record<string, unknown>[]): Record<string, unknown>[] {
  const data = readLinks();
  return courses.map(c => {
    const nivel = String(c._nivel ?? '').trim();
    const programa = String(c._programa ?? '').trim();
    const asignatura = String(c['Asignatura'] ?? '').trim();
    const k = courseKey(nivel, programa, asignatura);
    const links = data[k];
    const patched = { ...c };
    if (links?.linkDI) patched['Link DI'] = links.linkDI;
    if (links?.linkGC) patched['Link'] = links.linkGC;
    return patched;
  });
}

export function getCourseLinks(nivel: string, programa: string, asignatura: string): { linkGC?: string; linkDI?: string } {
  const data = readLinks();
  return data[courseKey(nivel, programa, asignatura)] ?? {};
}

// Keep backward compat alias
export const mergeLinksDI = mergeLinks;
