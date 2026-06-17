import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, buildEmailHtml } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { destinatarios, asunto, accion, gestor, di, nivel, programa, curso, mensaje } = body as {
      destinatarios: string[];
      asunto: string;
      accion: string;
      gestor: string;
      di?: string;
      nivel: string;
      programa: string;
      curso: string;
      mensaje?: string;
    };

    if (!destinatarios?.length) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const fecha = new Date().toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const html = buildEmailHtml({ accion, gestor, di, nivel, programa, curso, fecha, mensaje });

    const result = await sendEmail({ to: destinatarios, subject: asunto, html });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/send-email]', err);
    return NextResponse.json({ error: 'Error al enviar correo' }, { status: 500 });
  }
}
