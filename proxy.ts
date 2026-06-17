import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

const BASE = process.env.NODE_ENV === 'production' ? '/seguimiento' : '';

function redir(path: string, req: { url: string }) {
  return NextResponse.redirect(new URL(BASE + path, req.url));
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    if (path.startsWith('/login') || path.startsWith('/api/auth')) {
      return NextResponse.next();
    }

    if (!token) {
      return redir('/login', req);
    }

    const role = token.role as string | undefined;

    if (path === '/') {
      if (role === 'Gestor') return redir('/gestor', req);
      if (role === 'Diseñador Instruccional') return redir('/di', req);
      if (role === 'Coordinador') {
        const email = token.email as string | undefined;
        if (email === 'coordinacion_di@americana.edu.co') return redir('/coordinador-di', req);
        return redir('/coordinador', req);
      }
      if (role === 'Super Admin') return redir('/admin', req);
    }

    if (path.startsWith('/asignador')) return redir('/coordinador', req);

    if (path.startsWith('/gestor') && role !== 'Gestor') return redir('/login', req);
    if (path.startsWith('/di') && role !== 'Diseñador Instruccional') return redir('/login', req);
    if (path.startsWith('/coordinador') && role !== 'Coordinador') return redir('/login', req);
    if (path.startsWith('/admin') && role !== 'Super Admin') return redir('/login', req);

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: () => true,
    },
  }
);

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
