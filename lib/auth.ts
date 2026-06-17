import CredentialsProvider from 'next-auth/providers/credentials';
import { NextAuthOptions } from 'next-auth';
import { getUserByUsername } from '@/lib/user-management';
import { verifyPassword } from '@/lib/passwords';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const user = getUserByUsername(credentials.username.trim().toLowerCase());
        if (!user) return null;
        const valid = await verifyPassword(user.username, credentials.password);
        if (!valid) return null;
        return {
          id: user.username,
          name: user.nombre,
          email: user.email || undefined,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as unknown as Record<string, unknown>).role as string;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).role = token.role;
        (session.user as Record<string, unknown>).email = token.email;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production',
};
