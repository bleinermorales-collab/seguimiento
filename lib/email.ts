import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { sendViaOAuth, hasToken } from '@/lib/gmail-oauth';

interface EmailOptions {
  to: string[];
  subject: string;
  html: string;
  fromEmail?: string;
  fromName?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}

// ── 1. Gmail API con Domain-Wide Delegation (método principal) ────────────────
// La cuenta de servicio impersona al usuario que tomó la acción.
// FROM es el correo REAL de esa persona — sin que configure nada.
async function sendViaDWD(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.replace(/^"|"$/g, '');
  const privateKey   = process.env.GOOGLE_PRIVATE_KEY?.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
  const fromEmail    = options.fromEmail;

  if (!serviceEmail || !privateKey || !fromEmail) {
    return { success: false, error: 'Credenciales DWD o fromEmail no configurados' };
  }

  try {
    const auth = new google.auth.JWT({
      email: serviceEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      subject: fromEmail,
    });

    const gmail = google.gmail({ version: 'v1', auth });

    const encodedName = options.fromName
      ? `=?UTF-8?B?${Buffer.from(options.fromName).toString('base64')}?=`
      : null;
    const fromHeader = encodedName ? `${encodedName} <${fromEmail}>` : fromEmail;

    let rawStr: string;
    if (options.attachments && options.attachments.length > 0) {
      const boundary = `boundary_${Date.now().toString(36)}`;
      const parts: string[] = [
        `From: ${fromHeader}`,
        `To: ${options.to.join(', ')}`,
        `Subject: =?UTF-8?B?${Buffer.from(options.subject).toString('base64')}?=`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(options.html).toString('base64'),
      ];
      for (const att of options.attachments) {
        parts.push(`--${boundary}`);
        parts.push(`Content-Type: ${att.contentType || 'application/octet-stream'}`);
        parts.push(`Content-Disposition: attachment; filename="${att.filename}"`);
        parts.push('Content-Transfer-Encoding: base64');
        parts.push('');
        parts.push(att.content.toString('base64'));
      }
      parts.push(`--${boundary}--`);
      rawStr = parts.join('\r\n');
    } else {
      rawStr = [
        `From: ${fromHeader}`,
        `To: ${options.to.join(', ')}`,
        `Subject: =?UTF-8?B?${Buffer.from(options.subject).toString('base64')}?=`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        '',
        options.html,
      ].join('\r\n');
    }

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: Buffer.from(rawStr).toString('base64url') },
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error DWD' };
  }
}

// ── 2. SMTP nodemailer (último recurso) ──────────────────────────────────────
async function sendViaSMTP(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return { success: false, error: 'SMTP no configurado' };

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: options.fromName
        ? `"${options.fromName} via Yule" <${user}>`
        : `"Seguimiento de Virtualización" <${user}>`,
      to: options.to.join(', '),
      subject: options.subject,
      html: options.html,
      replyTo: options.fromEmail,
      attachments: options.attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error SMTP' };
  }
}

// ── Principal: DWD → OAuth personal → SMTP ───────────────────────────────────
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  // 1. DWD: FROM es el correo real de quien tomó la acción (no requiere configuración por usuario)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && options.fromEmail) {
    const r = await sendViaDWD(options);
    if (r.success) {
      console.log(`[email] ✅ DWD — FROM: ${options.fromEmail} → ${options.to.join(', ')}`);
      return r;
    }
    console.warn('[email] DWD falló:', r.error);
  }

  // 2. OAuth personal (si el usuario conectó su cuenta en /connect-gmail)
  if (options.fromEmail && hasToken(options.fromEmail)) {
    const r = await sendViaOAuth(options.fromEmail, options.to, options.subject, options.html, options.fromName);
    if (r.success) {
      console.log(`[email] ✅ OAuth — FROM: ${options.fromEmail} → ${options.to.join(', ')}`);
      return r;
    }
    console.warn('[email] OAuth falló:', r.error);
  }

  // 3. SMTP como último recurso
  const r = await sendViaSMTP(options);
  if (r.success) console.log(`[email] ✅ SMTP → ${options.to.join(', ')}`);
  else console.warn('[email] ❌ Todos los métodos fallaron:', r.error);
  return r;
}

export function buildEmailHtml(params: {
  accion: string;
  gestor: string;
  di?: string;
  nivel: string;
  programa: string;
  curso: string;
  fecha: string;
  mensaje?: string;
  observaciones?: string;
  linkGC?: string;
  linkDI?: string;
}): string {
  // El enlace DI solo tiene sentido cuando hay un DI asignado en este correo
  const showLinkDI = !!(params.linkDI && params.di);
  const platformUrl = (process.env.NEXTAUTH_URL || 'https://n8n.americana.edu.co/seguimiento').replace(/\/$/, '');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f2f5;padding:32px 16px">
  <tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(19,0,253,.10)">

    <!-- Barra superior -->
    <tr><td style="height:5px;background:linear-gradient(90deg,#1300fd 0%,#ff0040 50%,#ffbb2c 100%)"></td></tr>

    <!-- Header -->
    <tr><td style="background:#1300fd;padding:32px 36px 28px">
      <div style="font-size:11px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,.6);text-transform:uppercase;margin-bottom:12px">Corporación Universitaria Americana</div>
      <div style="font-size:22px;font-weight:700;color:#fff;line-height:1.3;margin-bottom:6px">Sistema de Seguimiento<br>de Virtualización</div>
      <div style="font-size:13px;color:rgba(255,255,255,.75)">Notificación automática de actualización de estado</div>
    </td></tr>

    <!-- Badge acción -->
    <tr><td style="padding:22px 36px 0">
      <table cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#fff0f3;border:1.5px solid #ff0040;color:#ff0040;font-size:12px;font-weight:700;padding:7px 16px;border-radius:999px;letter-spacing:.3px">
        &#9679;&nbsp; ${params.accion}
      </td></tr></table>
    </td></tr>

    <!-- Cuerpo -->
    <tr><td style="padding:24px 36px 0">

      <!-- Sección: Curso -->
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1300fd;padding-bottom:8px;border-bottom:2px solid #1300fd;margin-bottom:4px">Información del curso</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f2f5;font-size:13px;color:#6b7280;font-weight:500;width:45%">Nivel académico</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f2f5;font-size:13px;color:#111827;font-weight:600;text-align:right">${params.nivel}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f2f5;font-size:13px;color:#6b7280;font-weight:500">Programa</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f2f5;font-size:13px;color:#111827;font-weight:600;text-align:right">${params.programa}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-size:13px;color:#6b7280;font-weight:500;vertical-align:top;padding-top:12px">Curso / Asignatura</td>
          <td style="padding:10px 0;font-size:14px;color:#111827;font-weight:700;text-align:right;padding-top:12px">${params.curso}</td>
        </tr>
      </table>

      <!-- Sección: Responsables -->
      <div style="height:1px;background:#e8eaf0;margin:20px 0"></div>
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1300fd;padding-bottom:8px;border-bottom:2px solid #1300fd;margin-bottom:4px">Responsables</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:10px 0;${params.di ? 'border-bottom:1px solid #f0f2f5;' : ''}font-size:13px;color:#6b7280;font-weight:500">Gestor de contenido</td>
          <td style="padding:10px 0;${params.di ? 'border-bottom:1px solid #f0f2f5;' : ''}font-size:13px;color:#111827;font-weight:600;text-align:right">${params.gestor}</td>
        </tr>
        ${params.di ? `<tr>
          <td style="padding:10px 0;font-size:13px;color:#6b7280;font-weight:500">Diseñador Instruccional</td>
          <td style="padding:10px 0;font-size:13px;color:#111827;font-weight:600;text-align:right">${params.di}</td>
        </tr>` : ''}
      </table>

      <!-- Fecha -->
      <div style="height:1px;background:#e8eaf0;margin:20px 0"></div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-size:13px;color:#6b7280;font-weight:500">Fecha de registro</td>
          <td style="font-size:13px;color:#111827;font-weight:600;text-align:right">${params.fecha}</td>
        </tr>
      </table>

      ${params.mensaje ? `
      <div style="background:#f5f3ff;border-left:3px solid #1300fd;border-radius:0 8px 8px 0;padding:14px 16px;margin-top:20px;font-size:13px;color:#1a1a2e;line-height:1.6">${params.mensaje}</div>
      ` : ''}

      ${params.observaciones ? `
      <div style="height:1px;background:#e8eaf0;margin:20px 0"></div>
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1300fd;padding-bottom:8px;border-bottom:2px solid #1300fd;margin-bottom:12px">Observaciones</div>
      <div style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 16px;font-size:13px;color:#1a1a2e;line-height:1.6">${/<[a-z][\s\S]*>/i.test(params.observaciones) ? params.observaciones : params.observaciones.replace(/\r\n/g, '\n').split('\n').map(l => l ? `<p style="margin:0 0 8px">${l}</p>` : '<p style="margin:0 0 8px">&nbsp;</p>').join('')}</div>
      ` : ''}

      ${(params.linkGC || showLinkDI) ? `
      <!-- Sección: Acceso -->
      <div style="height:1px;background:#e8eaf0;margin:20px 0"></div>
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1300fd;padding-bottom:8px;border-bottom:2px solid #1300fd;margin-bottom:16px">Acceso al curso</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        ${params.linkGC ? `<td style="padding-right:8px">
          <a href="${params.linkGC}" style="display:block;text-align:center;background:#1300fd;color:#fff;font-size:13px;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:10px">
            Abrir curso &rarr;
          </a>
        </td>` : ''}
        ${showLinkDI ? `<td style="padding-left:${params.linkGC ? '0' : '0'}">
          <a href="${params.linkDI}" style="display:block;text-align:center;background:#f5f3ff;color:#6d28d9;border:2px solid #6d28d9;font-size:13px;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:10px">
            Enlace DI &rarr;
          </a>
        </td>` : ''}
      </tr></table>
      ` : ''}

      <!-- Botón plataforma (siempre visible) -->
      <div style="height:1px;background:#e8eaf0;margin:20px 0"></div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td>
          <a href="${platformUrl}" style="display:block;text-align:center;background:#f0f2f5;color:#1300fd;border:2px solid #1300fd;font-size:13px;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:10px;letter-spacing:.2px">
            &#127968;&nbsp; Ir a la plataforma de seguimiento
          </a>
        </td>
      </tr></table>

      <div style="height:28px"></div>
    </td></tr>

    <!-- Footer -->
    <tr><td style="background:#f8f9ff;padding:18px 36px;border-top:1px solid #e8eaf0">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td>
          <div style="font-size:11px;font-weight:700;color:#1300fd;letter-spacing:.5px">Virtualización</div>
          <div style="font-size:10px;color:#9ca3af;margin-top:3px">Corporación Universitaria Americana</div>
        </td>
        <td style="text-align:right">
          <div style="font-size:10px;color:#9ca3af;line-height:1.6">Notificación automática<br>No responder a este correo</div>
        </td>
      </tr></table>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
}
