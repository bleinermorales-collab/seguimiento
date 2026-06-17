import { NextResponse } from 'next/server';
import { readAllCourses } from '@/lib/sheets';
import { mergeLinksDI } from '@/lib/course-links';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = mergeLinksDI(await readAllCourses());
    return NextResponse.json({ data });
  } catch (err) {
    console.error('[api/admin]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
