import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllUsers, addUser, updateUser, deleteUser, toggleUserActive, type DynamicUser } from '@/lib/user-management';
import { setPassword, hasCustomPassword } from '@/lib/passwords';

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  return role === 'Super Admin';
}

export async function GET() {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const users = getAllUsers().map(u => ({
    ...u,
    hasCustomPassword: hasCustomPassword(u.username),
  }));
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const body = await req.json();
    const { action } = body as { action: string };

    if (action === 'create') {
      const { username, nombre, email, role } = body as Partial<DynamicUser>;
      if (!username || !nombre || !email || !role) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
      const result = addUser({ username: username.trim().toLowerCase(), nombre, email, role, active: true });
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === 'update') {
      const { username, nombre, email, role } = body as { username: string } & Partial<DynamicUser>;
      if (!username) return NextResponse.json({ error: 'Falta username' }, { status: 400 });
      const updates: Partial<Omit<DynamicUser, 'username'>> = {};
      if (nombre !== undefined) updates.nombre = nombre;
      if (email !== undefined) updates.email = email;
      if (role !== undefined) updates.role = role;
      const result = updateUser(username, updates);
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === 'toggle') {
      const { username } = body as { username: string };
      const result = toggleUserActive(username);
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, active: result.active });
    }

    if (action === 'delete') {
      const { username } = body as { username: string };
      const result = deleteUser(username);
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === 'password') {
      const { username, newPassword } = body as { username: string; newPassword: string };
      if (!username || !newPassword) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
      if (newPassword.length < 6) return NextResponse.json({ error: 'Min. 6 caracteres' }, { status: 400 });
      await setPassword(username, newPassword);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (err) {
    console.error('[api/admin/users]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
