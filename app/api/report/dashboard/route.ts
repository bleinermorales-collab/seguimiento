import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readAllCourses } from '@/lib/sheets';
import * as XLSX from 'xlsx';

type Curso = Record<string, unknown>;
type EstadoCat = 'sinIniciar' | 'proceso' | 'revision' | 'correccion' | 'aprobado';

function categorize(c: Curso): EstadoCat {
  const e = String(c.Estado ?? '').trim();
  const revalidacion = String(c['Estado de la revalidación DI'] ?? '').trim();
  if (e === 'Aprobado DI' || e === 'Aprobado' || revalidacion === 'Aprobado') return 'aprobado';
  if (e === 'En revisión') return 'revision';
  const ec = String(c['Estado curso'] ?? '').trim();
  if (e === 'Corrección' || ec === 'Corrección') return 'correccion';
  if (e === 'En proceso') return 'proceso';
  return 'sinIniciar';
}

function pct(n: number, d: number): string {
  return d === 0 ? '0%' : `${Math.round((n / d) * 100)}%`;
}

function getGestor(c: Curso): string {
  return String(c['Gestor responsable'] ?? c['Gestor responsable '] ?? c['Gestor asignado'] ?? '').trim();
}

function getDI(c: Curso): string {
  return String(c['DI responsable'] ?? '').trim();
}

interface ProgramaStats {
  nivel: string;
  programa: string;
  total: number; sem1: number; sem2: number; sem3: number;
  sinIniciar: number; proceso: number; revision: number; correccion: number; aprobado: number;
}

interface GestorStats {
  gestor: string;
  total: number;
  sinIniciar: number; proceso: number; revision: number; correccion: number; aprobado: number;
  cursos: { nivel: string; programa: string; asignatura: string; estado: string; estadoCat: EstadoCat; di: string }[];
}

interface DIStats {
  di: string;
  total: number;
  revision: number; aprobado: number; correccion: number; proceso: number; sinIniciar: number;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!role || !['Super Admin', 'Coordinador'].includes(role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const all = await readAllCourses();

    const programaMap = new Map<string, ProgramaStats>();
    const gestorMap = new Map<string, GestorStats>();
    const diMap = new Map<string, DIStats>();

    for (const c of all) {
      const nivel = String(c._nivel ?? '').trim();
      const programa = String(c._programa ?? '').trim();
      const key = `${nivel}::${programa}`;
      const cat = categorize(c);
      const sem = String(c.Semestre ?? '').trim();

      if (!programaMap.has(key)) {
        programaMap.set(key, { nivel, programa, total: 0, sem1: 0, sem2: 0, sem3: 0, sinIniciar: 0, proceso: 0, revision: 0, correccion: 0, aprobado: 0 });
      }
      const ps = programaMap.get(key)!;
      ps.total++;
      ps[cat]++;
      if (sem === '1') ps.sem1++;
      else if (sem === '2') ps.sem2++;
      else if (sem === '3') ps.sem3++;

      const g = getGestor(c);
      if (g) {
        if (!gestorMap.has(g)) {
          gestorMap.set(g, { gestor: g, total: 0, sinIniciar: 0, proceso: 0, revision: 0, correccion: 0, aprobado: 0, cursos: [] });
        }
        const gs = gestorMap.get(g)!;
        gs.total++;
        gs[cat]++;
        gs.cursos.push({
          nivel, programa,
          asignatura: String(c.Asignatura ?? '').trim(),
          estado: String(c.Estado ?? '').trim(),
          estadoCat: cat,
          di: getDI(c),
        });
      }

      const di = getDI(c);
      if (di) {
        if (!diMap.has(di)) {
          diMap.set(di, { di, total: 0, revision: 0, aprobado: 0, correccion: 0, proceso: 0, sinIniciar: 0 });
        }
        const ds = diMap.get(di)!;
        ds.total++;
        ds[cat]++;
      }
    }

    const NIVEL_ORDER = ['Pregrado', 'Especializaciones', 'Maestrías', 'Doctorado'];
    const programas = Array.from(programaMap.values()).sort((a, b) => {
      const ia = NIVEL_ORDER.indexOf(a.nivel);
      const ib = NIVEL_ORDER.indexOf(b.nivel);
      if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return a.programa.localeCompare(b.programa, 'es');
    });

    const gestores = Array.from(gestorMap.values()).sort((a, b) => a.gestor.localeCompare(b.gestor, 'es'));
    const dis = Array.from(diMap.values()).sort((a, b) => a.di.localeCompare(b.di, 'es'));

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Resumen por Programa ────────────────────────────────────────
    const S1_HEADERS = ['Nivel', 'Programa', 'Total', '1er Sem', '2do Sem', '3er Sem',
      'Aprobados DI', '% Aprobados', 'Sin iniciar', 'En proceso', 'En revisión', 'Corrección'];
    const s1rows: (string | number)[][] = [S1_HEADERS];

    let totTotal = 0, totAprobado = 0, totSin = 0, totProceso = 0, totRevision = 0, totCorreccion = 0;
    let lastNivel = '';

    for (const p of programas) {
      if (p.nivel !== lastNivel && lastNivel) {
        s1rows.push(['', '', '', '', '', '', '', '', '', '', '', '']); // blank separator
      }
      lastNivel = p.nivel;
      s1rows.push([p.nivel, p.programa, p.total, p.sem1, p.sem2, p.sem3,
        p.aprobado, pct(p.aprobado, p.total),
        p.sinIniciar, p.proceso, p.revision, p.correccion]);
      totTotal += p.total; totAprobado += p.aprobado;
      totSin += p.sinIniciar; totProceso += p.proceso;
      totRevision += p.revision; totCorreccion += p.correccion;
    }
    s1rows.push(['', '', '', '', '', '', '', '', '', '', '', '']);
    s1rows.push(['TOTAL', '', totTotal, '', '', '', totAprobado, pct(totAprobado, totTotal),
      totSin, totProceso, totRevision, totCorreccion]);

    const ws1 = XLSX.utils.aoa_to_sheet(s1rows);
    ws1['!cols'] = [
      { wch: 18 }, { wch: 46 }, { wch: 7 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 13 }, { wch: 11 }, { wch: 11 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen Programas');

    // ── Sheet 2: Resumen por Gestor ──────────────────────────────────────────
    const S2_HEADERS = ['Gestor', 'Total', 'Aprobados', '% Completados', 'Sin iniciar', 'En proceso', 'En revisión', 'Corrección'];
    const s2rows: (string | number)[][] = [S2_HEADERS];
    for (const g of gestores) {
      s2rows.push([g.gestor, g.total, g.aprobado, pct(g.aprobado, g.total),
        g.sinIniciar, g.proceso, g.revision, g.correccion]);
    }
    const ws2 = XLSX.utils.aoa_to_sheet(s2rows);
    ws2['!cols'] = [
      { wch: 32 }, { wch: 7 }, { wch: 10 }, { wch: 14 }, { wch: 11 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, 'Gestores');

    // ── Sheet 3: Detalle cursos por Gestor ───────────────────────────────────
    const S3_HEADERS = ['Gestor', 'Nivel', 'Programa', 'Asignatura', 'Estado', 'DI responsable'];
    const s3rows: string[][] = [S3_HEADERS];
    for (const g of gestores) {
      const sorted = [...g.cursos].sort((a, b) => {
        const NORDER = ['Pregrado', 'Especializaciones', 'Maestrías', 'Doctorado'];
        const ni = NORDER.indexOf(a.nivel) - NORDER.indexOf(b.nivel);
        if (ni !== 0) return ni;
        return a.programa.localeCompare(b.programa, 'es');
      });
      for (const c of sorted) {
        s3rows.push([g.gestor, c.nivel, c.programa, c.asignatura, c.estado, c.di]);
      }
    }
    const ws3 = XLSX.utils.aoa_to_sheet(s3rows);
    ws3['!cols'] = [
      { wch: 32 }, { wch: 18 }, { wch: 46 }, { wch: 42 }, { wch: 15 }, { wch: 32 },
    ];
    XLSX.utils.book_append_sheet(wb, ws3, 'Detalle Gestores');

    // ── Sheet 4: Resumen DIs ──────────────────────────────────────────────────
    const S4_HEADERS = ['DI', 'Total asignados', 'Aprobados', '% Aprobados', 'En revisión', 'Corrección', 'En proceso', 'Sin iniciar'];
    const s4rows: (string | number)[][] = [S4_HEADERS];
    for (const d of dis) {
      s4rows.push([d.di, d.total, d.aprobado, pct(d.aprobado, d.total),
        d.revision, d.correccion, d.proceso, d.sinIniciar]);
    }
    const ws4 = XLSX.utils.aoa_to_sheet(s4rows);
    ws4['!cols'] = [
      { wch: 32 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 11 },
    ];
    XLSX.utils.book_append_sheet(wb, ws4, 'DIs');

    // ── Sheet 5: Todos los cursos ─────────────────────────────────────────────
    const S5_HEADERS = ['Nivel', 'Programa', 'Asignatura', 'Estado', 'Gestor', 'DI responsable',
      'Semestre', 'Fecha inicio revisión DI', 'Fecha fin revisión DI', 'Fecha revalidación DI'];
    const s5rows: string[][] = [S5_HEADERS];
    for (const c of all) {
      const cat = categorize(c);
      const estadoDisplay = cat === 'aprobado' ? 'Aprobado' : String(c.Estado ?? '').trim();
      s5rows.push([
        String(c._nivel ?? '').trim(),
        String(c._programa ?? '').trim(),
        String(c.Asignatura ?? '').trim(),
        estadoDisplay,
        getGestor(c),
        getDI(c),
        String(c.Semestre ?? '').trim(),
        String(c['Fecha inicio revisión DI'] ?? '').trim(),
        String(c['Fecha fin revisión DI'] ?? '').trim(),
        String(c['Fecha revalidación de DI'] ?? '').trim(),
      ]);
    }
    const ws5 = XLSX.utils.aoa_to_sheet(s5rows);
    ws5['!cols'] = [
      { wch: 18 }, { wch: 46 }, { wch: 42 }, { wch: 12 }, { wch: 32 }, { wch: 32 },
      { wch: 9 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, ws5, 'Todos los cursos');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    return new NextResponse(buffer, {
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
