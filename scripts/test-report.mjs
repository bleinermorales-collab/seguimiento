// Prueba del reporte de aprobados
// Uso: node scripts/test-report.mjs
// Requiere el servidor corriendo: npm run dev

const BASE = 'http://localhost:3000';

// 1. Login para obtener la cookie de sesión
const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    username: 'yule',
    password: 'americana2025',
    redirect: 'false',
    json: 'true',
    csrfToken: '',
  }),
  redirect: 'manual',
});

// Obtener la cookie de sesión
const setCookie = loginRes.headers.get('set-cookie') ?? '';
const sessionCookie = setCookie.split(',').map(s => s.split(';')[0]).join('; ');

if (!sessionCookie.includes('session')) {
  // Intentar obtener el csrf token primero
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookie = csrfRes.headers.get('set-cookie') ?? '';

  const login2 = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': csrfCookie.split(';')[0],
    },
    body: new URLSearchParams({
      username: 'yule',
      password: 'americana2025',
      redirect: 'false',
      csrfToken,
    }),
    redirect: 'manual',
  });

  const allCookies = [
    csrfCookie.split(';')[0],
    ...(login2.headers.get('set-cookie') ?? '').split(',').map(s => s.split(';')[0]),
  ].join('; ');

  console.log('Sesión iniciada. Llamando al reporte...\n');
  await callReport(allCookies);
} else {
  console.log('Sesión iniciada. Llamando al reporte...\n');
  await callReport(sessionCookie);
}

async function callReport(cookie) {
  // 2. Preview (GET) — sin enviar correo
  const previewRes = await fetch(`${BASE}/api/report/approved`, {
    headers: { Cookie: cookie },
  });
  const preview = await previewRes.json();

  console.log('=== PREVIEW DEL REPORTE ===');
  console.log('Fecha:', preview.date);
  console.log('Aprobados HOY:', preview.countToday);
  console.log('Aprobados históricos:', preview.countTotal);
  console.log('\n--- TEXTO QUE SE ENVIARIA ---');
  console.log(preview.plainText ?? '(sin aprobaciones hoy)');

  if (preview.countToday === 0) {
    console.log('\n⚠ No hay cursos aprobados hoy/ayer. El correo no se enviará.');
    console.log('Para probar, puedes editar manualmente "Fecha fin revisión DI" en el Excel a la fecha de hoy.');
    return;
  }

  // 3. Preguntar si enviar
  console.log('\n=== ¿Enviar el correo? (Ctrl+C para cancelar, Enter para continuar) ===');
  await new Promise(resolve => process.stdin.once('data', resolve));

  const sendRes = await fetch(`${BASE}/api/report/approved`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  const result = await sendRes.json();

  if (result.ok) {
    console.log(`\n✅ Correo enviado — ${result.count} cursos aprobados hoy.`);
  } else {
    console.log('\n❌ Error:', result.error ?? 'Fallo al enviar');
  }
}
