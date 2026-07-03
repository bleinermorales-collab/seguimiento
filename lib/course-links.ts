import fs from 'fs';
import path from 'path';

const LINKS_PATH = path.join(process.cwd(), 'data', 'course-links.json');

type LinksMap = Record<string, { linkDI?: string; linkGC?: string; linkGestor?: string; di?: string; revisionStartedAt?: string }>;

// Normalize a key segment: strip accents, lowercase, trim.
// Used for both storing and looking up keys so mismatches due to
// accent differences or capitalization between the frontend and Excel don't break lookups.
function normSeg(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function readLinks(): LinksMap {
  try {
    if (fs.existsSync(LINKS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(LINKS_PATH, 'utf-8')) as LinksMap;
      // Normalize keys: strip accents, lowercase, trim each segment
      const normalized: LinksMap = {};
      for (const [k, v] of Object.entries(raw)) {
        const clean = k.split('::').map(p => normSeg(p)).join('::');
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

// Values that the sheet uses as "no electiva name" placeholders — treat as empty.
const MEANINGLESS_NE = new Set(['no aplica', 'n/a', 'na', '-', '--', 'no', 'ninguno', 'ninguna']);

function normNE(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function isRealElectivaName(ne: string | undefined): boolean {
  const v = (ne ?? '').trim();
  return v !== '' && !MEANINGLESS_NE.has(normNE(v));
}

// Include nombreElectiva in the key only when it is a real, meaningful name
// (not "No aplica", "N/A", etc.) so that placeholder values in the sheet
// don't break the sidecar lookup for non-electiva courses.
function courseKey(nivel: string, programa: string, asignatura: string, nombreElectiva?: string): string {
  const base = `${normSeg(nivel)}::${normSeg(programa)}::${normSeg(asignatura)}`;
  return isRealElectivaName(nombreElectiva) ? `${base}::${normSeg(nombreElectiva!)}` : base;
}

// Resolve a link entry.
// - If the course has a nombreElectiva: only use the specific key, NO fallback.
//   This prevents the old generic "Electiva II" sidecar entry from being
//   inherited by all electivas in the same program (false positives).
// - If no nombreElectiva: use the base key directly.
function resolveLinks(data: LinksMap, nivel: string, programa: string, asignatura: string, nombreElectiva?: string) {
  const key = courseKey(nivel, programa, asignatura, nombreElectiva);
  return data[key];
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
  data[k] = { ...data[k], linkGestor: link, linkGC: link };
  writeLinks(data);
}

export function setDI(nivel: string, programa: string, asignatura: string, nombre: string, nombreElectiva?: string): void {
  const data = readLinks();
  const k = courseKey(nivel, programa, asignatura, nombreElectiva);
  data[k] = { ...data[k], di: nombre };
  writeLinks(data);
}

// Persists the date the DI clicked "Iniciar revisión" so that the field
// survives across page reloads even when the Google Sheet column is missing
// or the GS write fails (GS is primary read source, so a failed write loses the data).
export function setRevisionStarted(nivel: string, programa: string, asignatura: string, date: string, nombreElectiva?: string): void {
  const data = readLinks();
  const k = courseKey(nivel, programa, asignatura, nombreElectiva);
  data[k] = { ...data[k], revisionStartedAt: date };
  writeLinks(data);
}

export function mergeLinks(courses: Record<string, unknown>[]): Record<string, unknown>[] {
  const data = readLinks();
  return courses.map(c => {
    const nivel = String(c._nivel ?? '').trim();
    const programa = String(c._programa ?? '').trim();
    const asignatura = String(c['Asignatura'] ?? '').trim();
    const rawNE = String(c['Nombre electiva'] ?? '').trim();
    const nombreElectiva = isRealElectivaName(rawNE) ? rawNE : undefined;
    const links = resolveLinks(data, nivel, programa, asignatura, nombreElectiva);
    const patched = { ...c };
    if (links?.linkDI) patched['Link DI'] = links.linkDI;
    // linkGestor is the legacy field (saved before linkGC was added); use it as fallback
    const effectiveLink = links?.linkGC || links?.linkGestor;
    if (effectiveLink) patched['Link'] = effectiveLink;
    if (links?.linkGestor) patched['Link Gestor'] = links.linkGestor;
    // Inject DI name from sidecar if the sheet column is empty
    if (links?.di) {
      const existing = String(patched['DI responsable'] ?? patched['DI Responsable'] ?? patched['DI responsable '] ?? '').trim();
      if (!existing) patched['DI responsable'] = links.di;
    }
    // Inject "Fecha inicio revisión DI" from sidecar when GS/Excel doesn't have the column
    // or the write to GS failed silently (GS is the primary read source, so a failed write
    // means reads return null for this field even though the action succeeded locally).
    if (links?.revisionStartedAt) {
      const existingFecha = String(patched['Fecha inicio revisión DI'] ?? patched['Fecha inicio revision DI'] ?? '').trim();
      if (!existingFecha) patched['Fecha inicio revisión DI'] = links.revisionStartedAt;
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
