import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { USERS } from '@/config/users';
import { setPassword, hasCustomPassword } from '@/lib/passwords';

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'Super Admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const users = USERS.map(u => ({
    username: u.username,
    nombre: u.nombre,
    role: u.role,
    hasCustomPassword: hasCustomPassword(u.username),
  }));

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'Super Admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { username, newPassword } = await req.json() as { username: string; newPassword: string };

    if (!username || !newPassword) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const user = USERS.find(u => u.username === username);
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    await setPassword(username, newPassword);

    return NextResponse.json({ success: true, isAdmin: user.role === 'Super Admin' });
  } catch (err) {
    console.error('[api/admin/passwords]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
