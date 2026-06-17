'use client';

import { SessionProvider } from 'next-auth/react';

const basePath = process.env.NODE_ENV === 'production' ? '/seguimiento' : '';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider basePath={`${basePath}/api/auth`}>{children}</SessionProvider>;
}
