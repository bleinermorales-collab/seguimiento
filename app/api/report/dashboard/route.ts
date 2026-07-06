import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readAllCourses } from '@/lib/sheets';
import ExcelJS from 'exceljs';
import { normalizarNombre } from '@/lib/nombre-aliases';

type Curso = Record<string, unknown>;
type EstadoCat = 'sinIniciar' | 'proceso' | 'revision' | 'correccion' | 'aprobado';

// ── Paleta (ARGB) ─────────────────────────────────────────────────────────────
const C = {
  headerBg:    'FF1E3A8A',
  headerFg:    'FFFFFFFF',
  titleBg:     'FF0F2460',
  nivelBg:     'FFE0E7FF',
  nivelFg:     'FF1E3A8A',
  altRow:      'FFF0F6FF',
  white:       'FFFFFFFF',
  totalBg:     'FFEFF6FF',
  totalFg:     'FF1E3A8A',
  greenBg:     'FFD1FAE5',
  greenFg:     'FF065F46',
  yellowBg:    'FFFEF3C7',
  yellowFg:    'FF92400E',
  redBg:       'FFFEE2E2',
  redFg:       'FF991B1B',
  grayBg:      'FFF3F4F6',
  border:      'FFD1D5DB',
  subheaderBg: 'FF1D4ED8',
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function pctNum(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

function pctColors(pctValue: number) {
  if (pctValue >= 80) return { bg: C.greenBg, fg: C.greenFg };
  if (pctValue >= 50) return { bg: C.yellowBg, fg: C.yellowFg };
  return { bg: C.redBg, fg: C.redFg };
}

function applyHeaderStyle(cell: ExcelJS.Cell, bg = C.headerBg) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.font = { bold: true, color: { argb: C.headerFg }, size: 10 };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = {
    bottom: { style: 'medium', color: { argb: C.border } },
    right:  { style: 'thin',   color: { argb: C.border } },
  };
}

function applyDataCell(cell: ExcelJS.Cell, rowIdx: number, center = false) {
  const bg = rowIdx % 2 === 0 ? C.white : C.altRow;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.font = { size: 10 };
  cell.alignment = { vertical: 'middle', horizontal: center ? 'center' : 'left' };
  cell.border = {
    bottom: { style: 'thin', color: { argb: C.border } },
    right:  { style: 'thin', color: { argb: C.border } },
  };
}

function applyPctCell(cell: ExcelJS.Cell, pctValue: number) {
  const cols = pctColors(pctValue);
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cols.bg } };
  cell.font = { bold: true, color: { argb: cols.fg }, size: 10 };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  cell.border = {
    bottom: { style: 'thin', color: { argb: C.border } },
    right:  { style: 'thin', color: { argb: C.border } },
  };
  cell.value = `${pctValue}%`;
}

function addTitle(ws: ExcelJS.Worksheet, text: string, colCount: number) {
  ws.addRow([text]);
  const titleRow = ws.lastRow!;
  titleRow.height = 32;
  const cell = titleRow.getCell(1);
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.titleBg } };
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.mergeCells(titleRow.number, 1, titleRow.number, colCount);
  // Subtitle
  ws.addRow([`Generado: ${new Date().toLocaleDateString('es-CO', { dateStyle: 'full' })}`]);
  const subRow = ws.lastRow!;
  subRow.height = 18;
  const sub = subRow.getCell(1);
  sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.subheaderBg } };
  sub.font = { italic: true, color: { argb: 'FFBFDBFE' }, size: 9 };
  sub.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.mergeCells(subRow.number, 1, subRow.number, colCount);
  ws.addRow([]); // blank spacer
}

function categorize(c: Curso): EstadoCat {
  const e = String(c.Estado ?? '').trim();
  const rev = String(c['Estado de la revalidación DI'] ?? '').trim();
  if (e === 'Aprobado DI' || e === 'Aprobado' || rev === 'Aprobado') return 'aprobado';
  if (e === 'En revisión') return 'revision';
  const ec = String(c['Estado curso'] ?? '').trim();
  if (e === 'Corrección' || ec === 'Corrección') return 'correccion';
  if (e === 'En proceso') return 'proceso';
  return 'sinIniciar';
}

function getGestor(c: Curso): string {
  return String(c['Gestor responsable'] ?? c['Gestor responsable '] ?? c['Gestor asignado'] ?? '').trim();
}
function getDI(c: Curso): string {
  return String(c['DI responsable'] ?? '').trim();
}

interface ProgramaStats {
  nivel: string; programa: string;
  total: number; sem1: number; sem2: number; sem3: number;
  sinIniciar: number; proceso: number; revision: number; correccion: number; aprobado: number;
}
interface PersonaStats {
  nombre: string; total: number;
  sinIniciar: number; proceso: number; revision: number; correccion: number; aprobado: number;
  cursos: { nivel: string; programa: string; asignatura: string; estado: string; estadoCat: EstadoCat; other: string }[];
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!role || !['Super Admin', 'Coordinador'].includes(role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const all = await readAllCourses();
    const NIVEL_ORDER = ['Pregrado', 'Especializaciones', 'Maestrías', 'Doctorado'];

    // Aggregate
    const programaMap = new Map<string, ProgramaStats>();
    const gestorMap   = new Map<string, PersonaStats>();
    const diMap       = new Map<string, PersonaStats>();

    for (const c of all) {
      const nivel    = String(c._nivel ?? '').trim();
      const programa = String(c._programa ?? '').trim();
      const cat      = categorize(c);
      const sem      = String(c.Semestre ?? '').trim();
      const key      = `${nivel}::${programa}`;

      if (!programaMap.has(key))
        programaMap.set(key, { nivel, programa, total: 0, sem1: 0, sem2: 0, sem3: 0, sinIniciar: 0, proceso: 0, revision: 0, correccion: 0, aprobado: 0 });
      const ps = programaMap.get(key)!;
      ps.total++; ps[cat]++;
      if (sem === '1') ps.sem1++;
      else if (sem === '2') ps.sem2++;
      else if (sem === '3') ps.sem3++;

      const g = normalizarNombre(getGestor(c));
      if (g) {
        if (!gestorMap.has(g)) gestorMap.set(g, { nombre: g, total: 0, sinIniciar: 0, proceso: 0, revision: 0, correccion: 0, aprobado: 0, cursos: [] });
        const gs = gestorMap.get(g)!;
        gs.total++; gs[cat]++;
        gs.cursos.push({ nivel, programa, asignatura: String(c.Asignatura ?? '').trim(), estado: String(c.Estado ?? '').trim(), estadoCat: cat, other: getDI(c) });
      }

      const di = normalizarNombre(getDI(c));
      if (di) {
        if (!diMap.has(di)) diMap.set(di, { nombre: di, total: 0, sinIniciar: 0, proceso: 0, revision: 0, correccion: 0, aprobado: 0, cursos: [] });
        const ds = diMap.get(di)!;
        ds.total++; ds[cat]++;
        ds.cursos.push({ nivel, programa, asignatura: String(c.Asignatura ?? '').trim(), estado: String(c.Estado ?? '').trim(), estadoCat: cat, other: g });
      }
    }

    const programas = Array.from(programaMap.values()).sort((a, b) => {
      const d = (NIVEL_ORDER.indexOf(a.nivel) || 99) - (NIVEL_ORDER.indexOf(b.nivel) || 99);
      return d !== 0 ? d : a.programa.localeCompare(b.programa, 'es');
    });
    const gestores = Array.from(gestorMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const dis      = Array.from(diMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    const wb = new ExcelJS.Workbook();
    wb.creator    = 'Virtualización Americana';
    wb.lastModifiedBy = 'Sistema';

    // ── SHEET 1: Resumen por programa ─────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Resumen Programas', { views: [{ state: 'frozen', ySplit: 4 }] });
      ws.properties.defaultRowHeight = 20;

      const COLS = [
        { header: 'Nivel',          width: 18 },
        { header: 'Programa',        width: 46 },
        { header: 'Total',           width: 8 },
        { header: '1er Sem',         width: 9 },
        { header: '2do Sem',         width: 9 },
        { header: '3er Sem',         width: 9 },
        { header: 'Aprobados DI',    width: 13 },
        { header: '% Aprobados',     width: 12 },
        { header: 'Sin iniciar',     width: 11 },
        { header: 'En proceso',      width: 11 },
        { header: 'En revisión',     width: 12 },
        { header: 'Corrección',      width: 12 },
      ];
      ws.columns = COLS.map(c => ({ width: c.width }));

      addTitle(ws, '  Resumen de virtualización por programa', COLS.length);

      // Header row
      const hRow = ws.addRow(COLS.map(c => c.header));
      hRow.height = 36;
      hRow.eachCell(cell => applyHeaderStyle(cell));

      // Enable autofilter on the header
      ws.autoFilter = { from: { row: hRow.number, column: 1 }, to: { row: hRow.number, column: COLS.length } };

      let totTotal = 0, totAprobado = 0, totSin = 0, totProceso = 0, totRevision = 0, totCorreccion = 0;
      let lastNivel = '';
      let dataRowIdx = 0;

      for (const p of programas) {
        // Nivel group header when nivel changes
        if (p.nivel !== lastNivel) {
          lastNivel = p.nivel;
          const nRow = ws.addRow([p.nivel.toUpperCase(), '', '', '', '', '', '', '', '', '', '', '']);
          nRow.height = 18;
          nRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.nivelBg } };
            cell.font = { bold: true, color: { argb: C.nivelFg }, size: 9, italic: true };
            cell.alignment = { vertical: 'middle' };
          });
          ws.mergeCells(nRow.number, 1, nRow.number, COLS.length);
          dataRowIdx = 0;
        }

        const p1 = pctNum(p.aprobado, p.total);
        const row = ws.addRow([p.nivel, p.programa, p.total, p.sem1, p.sem2, p.sem3, p.aprobado, p1, p.sinIniciar, p.proceso, p.revision, p.correccion]);
        row.height = 20;

        row.eachCell((cell, colNumber) => {
          const isCenter = colNumber >= 3;
          applyDataCell(cell, dataRowIdx, isCenter);
        });
        // Override % cell
        applyPctCell(row.getCell(8), p1);

        dataRowIdx++;
        totTotal += p.total; totAprobado += p.aprobado;
        totSin += p.sinIniciar; totProceso += p.proceso; totRevision += p.revision; totCorreccion += p.correccion;
      }

      // Totals row
      const totP = pctNum(totAprobado, totTotal);
      const totRow = ws.addRow(['', 'TOTAL', totTotal, '', '', '', totAprobado, totP, totSin, totProceso, totRevision, totCorreccion]);
      totRow.height = 24;
      totRow.eachCell((cell, colNumber) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.totalBg } };
        cell.font = { bold: true, color: { argb: C.totalFg }, size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: colNumber >= 3 ? 'center' : 'left' };
        cell.border = { top: { style: 'medium', color: { argb: C.headerBg } } };
      });
      applyPctCell(totRow.getCell(8), totP);
      totRow.getCell(8).font = { bold: true, color: { argb: pctColors(totP).fg }, size: 10 };
    }

    // ── SHEET 2: Gestores (resumen) ────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Gestores', { views: [{ state: 'frozen', ySplit: 4 }] });
      ws.properties.defaultRowHeight = 20;

      const COLS = [
        { header: 'Gestor',          width: 32 },
        { header: 'Total asignados', width: 14 },
        { header: 'Aprobados',       width: 11 },
        { header: '% Completados',   width: 14 },
        { header: 'Sin iniciar',     width: 11 },
        { header: 'En proceso',      width: 11 },
        { header: 'En revisión',     width: 12 },
        { header: 'Corrección',      width: 12 },
      ];
      ws.columns = COLS.map(c => ({ width: c.width }));

      addTitle(ws, '  Carga y avance por Gestor de Contenido', COLS.length);

      const hRow = ws.addRow(COLS.map(c => c.header));
      hRow.height = 36;
      hRow.eachCell(cell => applyHeaderStyle(cell));
      ws.autoFilter = { from: { row: hRow.number, column: 1 }, to: { row: hRow.number, column: COLS.length } };

      gestores.forEach((g, i) => {
        const p = pctNum(g.aprobado, g.total);
        const row = ws.addRow([g.nombre, g.total, g.aprobado, p, g.sinIniciar, g.proceso, g.revision, g.correccion]);
        row.height = 20;
        row.eachCell((cell, col) => applyDataCell(cell, i, col >= 2));
        applyPctCell(row.getCell(4), p);
      });
    }

    // ── SHEET 3: Detalle por Gestor ────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Detalle Gestores', { views: [{ state: 'frozen', ySplit: 4 }] });
      ws.properties.defaultRowHeight = 20;

      const COLS = [
        { header: 'Gestor',       width: 30 },
        { header: 'Nivel',        width: 18 },
        { header: 'Programa',     width: 44 },
        { header: 'Asignatura',   width: 40 },
        { header: 'Estado',       width: 14 },
        { header: 'DI responsable', width: 30 },
      ];
      ws.columns = COLS.map(c => ({ width: c.width }));

      addTitle(ws, '  Detalle de cursos por Gestor de Contenido', COLS.length);

      const hRow = ws.addRow(COLS.map(c => c.header));
      hRow.height = 36;
      hRow.eachCell(cell => applyHeaderStyle(cell));
      ws.autoFilter = { from: { row: hRow.number, column: 1 }, to: { row: hRow.number, column: COLS.length } };

      const ESTADO_COLORS: Record<EstadoCat, { bg: string; fg: string }> = {
        aprobado:   { bg: C.greenBg, fg: C.greenFg },
        revision:   { bg: C.yellowBg, fg: C.yellowFg },
        correccion: { bg: C.redBg, fg: C.redFg },
        proceso:    { bg: 'FFDBEAFE', fg: 'FF1E40AF' },
        sinIniciar: { bg: C.grayBg, fg: 'FF6B7280' },
      };

      let rowIdx = 0;
      for (const g of gestores) {
        const sorted = [...g.cursos].sort((a, b) => {
          const ni = (NIVEL_ORDER => NIVEL_ORDER.indexOf(a.nivel) - NIVEL_ORDER.indexOf(b.nivel))(['Pregrado','Especializaciones','Maestrías','Doctorado']);
          return ni !== 0 ? ni : a.programa.localeCompare(b.programa, 'es');
        });
        for (const c of sorted) {
          const row = ws.addRow([g.nombre, c.nivel, c.programa, c.asignatura, c.estado, c.other]);
          row.height = 20;
          row.eachCell((cell, col) => applyDataCell(cell, rowIdx, col === 2));
          // Color Estado cell
          const ecol = ESTADO_COLORS[c.estadoCat];
          const eCell = row.getCell(5);
          eCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ecol.bg } };
          eCell.font = { bold: true, color: { argb: ecol.fg }, size: 9 };
          eCell.alignment = { vertical: 'middle', horizontal: 'center' };
          rowIdx++;
        }
      }
    }

    // ── SHEET 4: DIs ──────────────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('DIs', { views: [{ state: 'frozen', ySplit: 4 }] });
      ws.properties.defaultRowHeight = 20;

      const COLS = [
        { header: 'Diseñador Instruccional', width: 32 },
        { header: 'Total asignados',          width: 14 },
        { header: 'Aprobados',                width: 11 },
        { header: '% Aprobados',              width: 13 },
        { header: 'En revisión',              width: 12 },
        { header: 'Corrección',               width: 12 },
        { header: 'En proceso',               width: 11 },
        { header: 'Sin iniciar',              width: 11 },
      ];
      ws.columns = COLS.map(c => ({ width: c.width }));

      addTitle(ws, '  Carga y avance por Diseñador Instruccional', COLS.length);

      const hRow = ws.addRow(COLS.map(c => c.header));
      hRow.height = 36;
      hRow.eachCell(cell => applyHeaderStyle(cell));
      ws.autoFilter = { from: { row: hRow.number, column: 1 }, to: { row: hRow.number, column: COLS.length } };

      dis.forEach((d, i) => {
        const p = pctNum(d.aprobado, d.total);
        const row = ws.addRow([d.nombre, d.total, d.aprobado, p, d.revision, d.correccion, d.proceso, d.sinIniciar]);
        row.height = 20;
        row.eachCell((cell, col) => applyDataCell(cell, i, col >= 2));
        applyPctCell(row.getCell(4), p);
      });
    }

    // ── SHEET 5: Todos los cursos ─────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Todos los cursos', { views: [{ state: 'frozen', ySplit: 4 }] });
      ws.properties.defaultRowHeight = 20;

      const COLS = [
        { header: 'Nivel',                    width: 18 },
        { header: 'Programa',                 width: 44 },
        { header: 'Asignatura',               width: 40 },
        { header: 'Estado',                   width: 14 },
        { header: 'Gestor',                   width: 30 },
        { header: 'DI responsable',           width: 30 },
        { header: 'Semestre',                 width: 10 },
        { header: 'Fecha inicio revisión DI', width: 22 },
        { header: 'Fecha fin revisión DI',    width: 22 },
        { header: 'Fecha revalidación DI',    width: 22 },
      ];
      ws.columns = COLS.map(c => ({ width: c.width }));

      addTitle(ws, '  Listado completo de cursos', COLS.length);

      const hRow = ws.addRow(COLS.map(c => c.header));
      hRow.height = 36;
      hRow.eachCell(cell => applyHeaderStyle(cell));
      ws.autoFilter = { from: { row: hRow.number, column: 1 }, to: { row: hRow.number, column: COLS.length } };

      const NIVEL_ORDER = ['Pregrado', 'Especializaciones', 'Maestrías', 'Doctorado'];
      const sorted = [...all].sort((a, b) => {
        const ai = NIVEL_ORDER.indexOf(String(a._nivel ?? '').trim());
        const bi = NIVEL_ORDER.indexOf(String(b._nivel ?? '').trim());
        const d = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        return d !== 0 ? d : String(a._programa ?? '').localeCompare(String(b._programa ?? ''), 'es');
      });

      const ESTADO_COLORS_5: Record<EstadoCat, { bg: string; fg: string }> = {
        aprobado:   { bg: C.greenBg, fg: C.greenFg },
        revision:   { bg: C.yellowBg, fg: C.yellowFg },
        correccion: { bg: C.redBg, fg: C.redFg },
        proceso:    { bg: 'FFDBEAFE', fg: 'FF1E40AF' },
        sinIniciar: { bg: C.grayBg, fg: 'FF6B7280' },
      };

      sorted.forEach((c, i) => {
        const cat = categorize(c);
        const row = ws.addRow([
          String(c._nivel ?? '').trim(),
          String(c._programa ?? '').trim(),
          String(c.Asignatura ?? '').trim(),
          String(c.Estado ?? '').trim(),
          getGestor(c),
          getDI(c),
          String(c.Semestre ?? '').trim(),
          String(c['Fecha inicio revisión DI'] ?? '').trim(),
          String(c['Fecha fin revisión DI'] ?? '').trim(),
          String(c['Fecha revalidación de DI'] ?? '').trim(),
        ]);
        row.height = 20;
        row.eachCell((cell, col) => applyDataCell(cell, i, col === 1 || col >= 7));
        const ecol = ESTADO_COLORS_5[cat];
        const eCell = row.getCell(4);
        eCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ecol.bg } };
        eCell.font = { bold: true, color: { argb: ecol.fg }, size: 9 };
        eCell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
    }

    const rawBuffer = await wb.xlsx.writeBuffer();
    const bytes = new Uint8Array(rawBuffer as ArrayBuffer);
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="dashboard_${dateStr}.xlsx"`,
      },
    });
  } catch (err) {
    console.error('[api/report/dashboard]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
