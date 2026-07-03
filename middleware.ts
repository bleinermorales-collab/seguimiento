import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.NODE_ENV === 'production' ? '/seguimiento' : '';

function redir(path: string, req: NextRequest) {
  return NextResponse.redirect(new URL(BASE + path, req.url));
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // next-auth internal routes — never touch them
  if (path.startsWith('/api/auth')) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Login page: already authenticated → send to home
  if (path.startsWith('/login')) {
    if (token) return redir('/', req);
    return NextResponse.next();
  }

  // Every other route requires a valid session
  if (!token) return redir('/login', req);

  const role = token.role as string | undefined;
  const email = token.email as string | undefined;

  // Root: redirect each role to their page
  if (path === '/') {
    if (role === 'Gestor') return redir('/gestor', req);
    if (role === 'Diseñador Instruccional') return redir('/di', req);
    if (role === 'Coordinador') {
      return email === 'coordinacion_di@americana.edu.co'
        ? redir('/coordinador-di', req)
        : redir('/coordinador', req);
    }
    if (role === 'Super Admin') return redir('/admin', req);
  }

  // Legacy alias
  if (path.startsWith('/asignador')) return redir('/coordinador', req);

  // Role-based route guards
  if (path.startsWith('/gestor') && role !== 'Gestor') return redir('/login', req);
  if (path.startsWith('/di') && role !== 'Diseñador Instruccional') return redir('/login', req);
  if (path.startsWith('/coordinador-di')) {
    if (role !== 'Coordinador' || email !== 'coordinacion_di@americana.edu.co')
      return redir('/login', req);
  } else if (path.startsWith('/coordinador') && role !== 'Coordinador') {
    return redir('/login', req);
  }
  if (path.startsWith('/admin') && role !== 'Super Admin') return redir('/login', req);

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
