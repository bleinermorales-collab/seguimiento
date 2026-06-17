/**
 * Prueba de correos de notificación con destinatarios de prueba.
 * Uso: node scripts/test-email.mjs
 * El servidor debe estar corriendo: npm run dev
 */

import { createTransport } from 'nodemailer';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Leer .env.local manualmente
const envPath = join(__dirname, '..', '.env.local');
const envVars = {};
try {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && !k.startsWith('#')) envVars[k.trim()] = v.join('=').trim();
  });
} catch {
  console.error('❌ No se encontró .env.local. Créalo primero.');
  process.exit(1);
}

const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = envVars;

if (!SMTP_USER || !SMTP_PASS) {
  console.error('❌ Faltan SMTP_USER o SMTP_PASS en .env.local');
  process.exit(1);
}

const DESTINATARIOS_PRUEBA = [
  'moralesbleiner@gmail.com',
  'bleinermorales@americana.edu.co',
];

const transporter = createTransport({
  host: SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(SMTP_PORT || '587'),
  secure: SMTP_SECURE === 'true',
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

function html(accion, nivel, programa, curso, gestor, di) {
  return `
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;color:#333;background:#f9fafb;margin:0;padding:0}
.card{max-width:520px;margin:40px auto;background:white;border-radius:12px;box-shadow:0 1px 6px rgba(0,0,0,.08);overflow:hidden}
.header{background:#4F46E5;padding:24px 28px;color:white}
.header h1{margin:0;font-size:18px;font-weight:700}
.header p{margin:4px 0 0;font-size:13px;opacity:.85}
.body{padding:28px}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
.row:last-of-type{border-bottom:none}
.label{color:#6b7280;font-weight:500}
.value{color:#111827;text-align:right;max-width:55%}
.badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;background:#EEF2FF;color:#4F46E5}
.footer{padding:16px 28px;background:#f9fafb;font-size:12px;color:#9ca3af;text-align:center;border-top:1px solid #f1f5f9}
.test-banner{background:#fef3c7;border:1px solid #f59e0b;padding:10px 28px;font-size:12px;color:#92400e;text-align:center}
</style></head><body>
<div class="card">
  <div class="test-banner">⚠️ CORREO DE PRUEBA — destinatarios reales no fueron notificados</div>
  <div class="header">
    <h1>Seguimiento de Virtualización</h1>
    <p>Actualización de estado de curso</p>
  </div>
  <div class="body">
    <div class="row"><span class="label">Estado registrado</span><span class="value"><span class="badge">${accion}</span></span></div>
    <div class="row"><span class="label">Nivel</span><span class="value">${nivel}</span></div>
    <div class="row"><span class="label">Programa</span><span class="value">${programa}</span></div>
    <div class="row"><span class="label">Curso</span><span class="value">${curso}</span></div>
    <div class="row"><span class="label">Gestor</span><span class="value">${gestor}</span></div>
    ${di ? `<div class="row"><span class="label">Diseñador Instruccional</span><span class="value">${di}</span></div>` : ''}
    <div class="row"><span class="label">Destinatarios reales</span><span class="value" style="font-size:11px;color:#6b7280">${accion === 'Asignación de Gestor' ? 'Gestor + CDI + IE' : accion === 'Enviado' ? 'CGC + CDI + IE' : accion === 'Corregido' ? 'CGC + CDI + IE + DI' : 'CGC + CDI + IE + Gestor'}</span></div>
  </div>
  <div class="footer">Sistema de Seguimiento de Virtualización — Corporación Universitaria Americana</div>
</div>
</body></html>`;
}

async function enviar(asunto, accion, nivel, programa, curso, gestor, di) {
  try {
    await transporter.sendMail({
      from: `"Seguimiento de Virtualización [PRUEBA]" <${SMTP_USER}>`,
      to: DESTINATARIOS_PRUEBA.join(', '),
      subject: `[PRUEBA] ${asunto}`,
      html: html(accion, nivel, programa, curso, gestor, di),
    });
    console.log(`  ✅ Enviado: ${asunto}`);
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
  }
}

console.log(`\nSMTP: ${SMTP_USER} → ${SMTP_HOST}:${SMTP_PORT}`);
console.log(`Destinatarios de prueba: ${DESTINATARIOS_PRUEBA.join(', ')}\n`);

// Datos de prueba fijos
const nivel    = 'Pregrado';
const programa = 'Ingeniería de Sistemas';
const curso    = 'Curso de prueba — Notificaciones';
const gestor   = 'Claudia Navarro';
const di       = 'Andrés Felipe Velandia Espitia';

console.log('Enviando 6 correos de prueba...\n');

await enviar('Asignación de Gestor — ' + curso,   'Asignación de Gestor', nivel, programa, curso, gestor);
await enviar('Enviado — ' + curso,                 'Enviado',              nivel, programa, curso, gestor);
await enviar('Corregido — ' + curso,               'Corregido',            nivel, programa, curso, gestor, di);
await enviar('Inicio revisión — ' + curso,         'Inicio revisión',      nivel, programa, curso, gestor, di);
await enviar('Aprobado — ' + curso,                'Aprobado',             nivel, programa, curso, gestor, di);
await enviar('Devuelto para corrección — ' + curso,'Devuelto',             nivel, programa, curso, gestor, di);

console.log('\nRevisa las bandejas de:');
DESTINATARIOS_PRUEBA.forEach(e => console.log(' -', e));
