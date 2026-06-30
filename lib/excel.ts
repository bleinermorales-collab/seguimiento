import * as XLSX from 'xlsx';
import path from 'path';

const EXCEL_PATH = path.join(process.cwd(), 'data', 'cursos.xlsx');

const SHEET_MAP: Record<string, string> = {
  Pregrado: 'Pregrado',
  Especializaciones: 'Especializaciones',
  'Maestrías': 'Maestrías',
  Doctorado: 'Doctorado',
};

// Column aliases for inconsistent naming across sheets
const COL_ALIASES: Record<string, string[]> = {
  'Estado':                      ['Estado', 'Estado '],
  'Estado curso':                ['Estado curso', 'Estado Curso', 'Estado curso '],
  'Inicio Gestor':               ['Inicio Gestor', 'Inicio gestor', 'Inicio Gestor '],
  'Fin Gestor':                  ['Fin Gestor', 'Fin gestor', 'Fin Gestor '],
  'Gestor responsable':          ['Gestor responsable ', 'Gestor responsable', 'Gestor Responsable'],
  'Gestor asignado':             ['Gestor asignado', 'Gestor Asignado', 'Gestor asignado '],
  'Fecha fin corrección gestor': ['Fecha fin corrección gestor', 'Fecha fin corrección docente', 'Fecha fin correccion gestor'],
  'Fecha inicio revisión DI':    ['Fecha inicio revisión DI', 'Fecha inicio revision DI', 'Fecha inicio revisión DI '],
  'Fecha fin revisión DI':       ['Fecha fin revisión DI', 'Fecha fin revision DI', 'Fecha fin revisión DI '],
  'DI responsable':              ['DI responsable', 'DI Responsable', 'DI responsable '],
  'DI asignado':                 ['DI asignado', 'DI Asignado', 'DI asignado '],
  'Fecha de asignación':         ['Fecha de asignación', 'Fecha de asignacion', 'Fecha asignación', 'Fecha asignacion'],
  'Estado de la asignación':     ['Estado de la asignación', 'Estado de la asignacion', 'Estado asignación'],
  'Estado de la revalidación DI':['Estado de la revalidación DI', 'Estado de la revalidacion DI', 'Estado revalidación DI'],
  'Fecha revalidación de DI':    ['Fecha revalidación de DI', 'Fecha revalidacion de DI', 'Fecha Revalidación DI', 'Fecha revalidacion DI'],
  'Link':                        ['Link', 'Link ', 'Enlace', 'Enlace curso', 'link'],
  'Link DI':                     ['Link DI', 'Link DI ', 'Link di', 'Enlace DI'],
};

function normalizeColName(name: string): string {
  return String(name)
    .replace(/ | | |​| | | | |﻿/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function getWorkbook(): XLSX.WorkBook {
  return XLSX.readFile(EXCEL_PATH, { cellDates: true, cellNF: true, cellStyles: true });
}

function buildHeaderMap(ws: XLSX.WorkSheet, range: XLSX.Range): Map<string, number> {
  const map = new Map<string, number>();
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
    if (cell?.v != null) {
      const raw = String(cell.v);
      map.set(raw, c);
      map.set(raw.trim(), c);
      map.set(normalizeColName(raw), c);
    }
  }
  return map;
}

function findCol(headerMap: Map<string, number>, name: string): number | undefined {
  // Direct match
  let idx = headerMap.get(name);
  if (idx !== undefined) return idx;
  idx = headerMap.get(normalizeColName(name));
  if (idx !== undefined) return idx;
  // Check aliases
  const aliases = COL_ALIASES[name] || [];
  for (const alias of aliases) {
    idx = headerMap.get(alias) ?? headerMap.get(normalizeColName(alias));
    if (idx !== undefined) return idx;
  }
  return undefined;
}

// Build reverse alias map: raw variant → canonical name
const ALIAS_REVERSE: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [canonical, variants] of Object.entries(COL_ALIASES)) {
    for (const v of variants) {
      m.set(v, canonical);
      m.set(normalizeColName(v), canonical);
    }
  }
  return m;
})();

function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    const canonical = ALIAS_REVERSE.get(key) ?? ALIAS_REVERSE.get(normalizeColName(key)) ?? key;
    // Only remap if not already set by a canonical key
    if (!(canonical in out)) out[canonical] = val;
    else out[key] = val;
  }
  return out;
}

export function readSheet(nivel: string): Record<string, unknown>[] {
  const wb = getWorkbook();
  const sheetName = SHEET_MAP[nivel] || nivel;
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

  let lastPrograma = '';
  let lastModalidad = '';

  return data.map((row) => {
    const r = normalizeRowKeys(row);
    if (r['Programa'] != null) lastPrograma = String(r['Programa']);
    if (r['Modalidad'] != null) lastModalidad = String(r['Modalidad']);
    return { ...r, _programa: lastPrograma, _modalidad: lastModalidad };
  });
}

export function getProgramas(nivel: string): string[] {
  const data = readSheet(nivel);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of data) {
    const p = row._programa as string;
    if (p && !seen.has(p.trim())) {
      seen.add(p.trim());
      result.push(p.trim());
    }
  }
  return result.sort();
}

export function getCursos(nivel: string, programa: string): string[] {
  const data = readSheet(nivel);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of data) {
    const p = (row._programa as string)?.trim();
    const a = row['Asignatura'];
    if (p === programa.trim() && a != null) {
      const name = String(a).trim();
      if (!seen.has(name)) {
        seen.add(name);
        result.push(name);
      }
    }
  }
  return result.sort();
}

export function getGestores(nivel: string): string[] {
  const data = readSheet(nivel);
  const seen = new Set<string>();
  for (const row of data) {
    const g = (row['Gestor responsable '] || row['Gestor responsable']) as string;
    if (g) seen.add(String(g).trim());
  }
  return Array.from(seen).filter(Boolean).sort();
}

export function getCourseInfo(nivel: string, programa: string, asignatura: string): Record<string, unknown> | null {
  const data = readSheet(nivel);
  return (
    data.find(
      (r) =>
        (r._programa as string)?.trim() === programa.trim() &&
        String(r['Asignatura'] ?? '').trim() === asignatura.trim()
    ) ?? null
  );
}

export function updateCourse(nivel: string, asignatura: string, updates: Record<string, unknown>, programa?: string, nombreElectiva?: string): boolean {
  // Use sheet_to_json (same path as readSheet) to find the matching logical row index
  const data = readSheet(nivel);
  const normAsig = normalizeColName(asignatura);
  const normProg = programa ? normalizeColName(programa) : null;
  const normNE = nombreElectiva ? normalizeColName(nombreElectiva) : null;

  let logicalIdx = data.findIndex((r) => {
    const rowAsig = normalizeColName(String(r['Asignatura'] ?? ''));
    const rowProg = normalizeColName(String(r._programa ?? ''));
    if (rowAsig !== normAsig) return false;
    if (normProg && rowProg !== normProg) return false;
    if (normNE) {
      const rowNE = normalizeColName(String(r['Nombre electiva'] ?? ''));
      return rowNE === normNE;
    }
    return true;
  });

  // Fallback: si no encontró con filtro de programa, buscar solo por asignatura
  if (logicalIdx === -1 && normProg) {
    logicalIdx = data.findIndex((r) => {
      const rowAsig = normalizeColName(String(r['Asignatura'] ?? ''));
      if (rowAsig !== normAsig) return false;
      if (normNE) {
        const rowNE = normalizeColName(String(r['Nombre electiva'] ?? ''));
        return rowNE === normNE;
      }
      return true;
    });
  }

  if (logicalIdx === -1) return false;

  // Open workbook for writing
  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  const sheetName = SHEET_MAP[nivel] || nivel;
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) return false;

  const range = XLSX.utils.decode_range(ws['!ref']);
  const headerMap = buildHeaderMap(ws, range);

  // sheet_to_json skips the header row, so worksheet row = logicalIdx + 1 (header) + range.s.r
  const targetRow = range.s.r + 1 + logicalIdx;

  for (const [colName, value] of Object.entries(updates)) {
    const colIdx = findCol(headerMap, colName);
    if (colIdx === undefined) continue;

    const cellAddr = XLSX.utils.encode_cell({ r: targetRow, c: colIdx });

    if (value === null) {
      delete ws[cellAddr];
    } else if (value instanceof Date) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const serial = (value.getTime() - epoch.getTime()) / (24 * 60 * 60 * 1000);
      ws[cellAddr] = { t: 'n', v: serial, w: formatDate(value), z: 'dd/mm/yyyy' };
    } else {
      ws[cellAddr] = { t: 's', v: String(value) };
    }
  }

  XLSX.writeFile(wb, EXCEL_PATH);
  return true;
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function appendCourse(nivel: string, fields: Record<string, string | number>): boolean {
  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  const sheetName = SHEET_MAP[nivel] || nivel;
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) return false;

  const range = XLSX.utils.decode_range(ws['!ref']);
  const headerMap = buildHeaderMap(ws, range);
  const newRow = range.e.r + 1;

  for (const [colName, value] of Object.entries(fields)) {
    if (value === '' || value === undefined) continue;
    const colIdx = headerMap.get(colName) ?? headerMap.get(normalizeColName(colName));
    if (colIdx === undefined) continue;
    const addr = XLSX.utils.encode_cell({ r: newRow, c: colIdx });
    ws[addr] = typeof value === 'number' ? { t: 'n', v: value } : { t: 's', v: String(value) };
  }

  ws['!ref'] = XLSX.utils.encode_range({ s: range.s, e: { r: newRow, c: range.e.c } });
  XLSX.writeFile(wb, EXCEL_PATH);
  return true;
}

export function getSheetNames(): string[] {
  const wb = getWorkbook();
  return wb.SheetNames.filter((n) => n !== 'Resumen x Semestre');
}

export function readAllCourses(): Record<string, unknown>[] {
  const niveles = ['Pregrado', 'Especializaciones', 'Maestrías', 'Doctorado'];
  const all: Record<string, unknown>[] = [];
  for (const nivel of niveles) {
    const data = readSheet(nivel);
    for (const row of data) {
      if (row['Asignatura']) {
        all.push({ ...row, _nivel: nivel });
      }
    }
  }
  return all;
}
