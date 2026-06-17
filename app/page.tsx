import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const user = session.user as { role?: string; email?: string };
  const role = user.role;
  if (role === 'Gestor') redirect('/gestor');
  if (role === 'Diseñador Instruccional') redirect('/di');
  if (role === 'Coordinador') {
    if (user.email === 'coordinacion_di@americana.edu.co') redirect('/coordinador-di');
    redirect('/coordinador');
  }
  if (role === 'Asignador') redirect('/asignador');
  if (role === 'Super Admin') redirect('/admin');
  redirect('/login');
}
